/*
 * useQuickPrompt — one-shot Nano prompt dispatcher for the always-visible
 * QuickPrompt bar above the tabs.
 *
 * Different from useChatSession (the side-panel hook): no persistent
 * session, no history, no contextoverflow bookkeeping. Each call to
 * `ask()` creates a fresh LanguageModelSession, runs ONE prompt() with
 * the m3 tool-call schema, applies any resulting tool action, surfaces
 * a single inline result, then destroys the session.
 *
 * Trade-off: ~100–300 ms session-create overhead per prompt vs. zero
 * memory bookkeeping and no leak surface. For one-shot quick actions
 * this is the right cut — the chat panel is still where you go for
 * multi-turn conversation.
 *
 * Reuses src/llm/tools.ts (TOOL_SCHEMA + parseToolCall + applyToolCall)
 * so the same tool actions land here as in the chat panel.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createSession as nanoCreateSession } from "@/llm/nano";
import {
  TOOL_SCHEMA,
  buildSystemPrompt,
  parseToolCall,
  applyToolCall,
} from "@/llm/tools";
import { useStore } from "@/storage/useStore";
import { getLogger } from "@/observability/logger";

const log = getLogger("nano:quick");

/** Result variants the bar surfaces inline. */
export type QuickResult =
  | { kind: "action"; summary: string; undoToken: string; snapshot: import("@/types").ProclivityState; expiresAt: number }
  | { kind: "chat"; text: string }
  | { kind: "error"; text: string };

export interface UseQuickPromptResult {
  generating: boolean;
  result: QuickResult | null;
  ask: (input: string) => Promise<void>;
  /** Dismiss the visible result without applying an undo. */
  dismiss: () => void;
  /** Restore the pre-call snapshot if the result is an action that hasn't expired. */
  undo: () => Promise<void>;
}

/** How long each result variant stays visible before auto-dismissing. */
const ACTION_VISIBLE_MS = 10_000;
const CHAT_VISIBLE_MS = 8_000;
const ERROR_VISIBLE_MS = 6_000;

export function useQuickPrompt(): UseQuickPromptResult {
  const { state, update } = useStore();
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<QuickResult | null>(null);

  // Stable ref so ask() doesn't rebuild on every state change.
  const stateRef = useRef(state);
  stateRef.current = state;

  // Per-call abort handle. Aborted by dismiss() and on unmount.
  const abortRef = useRef<AbortController | null>(null);
  // Auto-dismiss timer.
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current !== null) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const scheduleDismiss = useCallback(
    (ms: number) => {
      clearDismissTimer();
      dismissTimerRef.current = setTimeout(() => {
        setResult(null);
        dismissTimerRef.current = null;
      }, ms);
    },
    [clearDismissTimer],
  );

  const dismiss = useCallback(() => {
    abortRef.current?.abort();
    clearDismissTimer();
    setResult(null);
  }, [clearDismissTimer]);

  const ask = useCallback(
    async (input: string): Promise<void> => {
      const trimmed = input.trim();
      if (!trimmed || generating) return;

      // Cancel any prior in-flight call AND any visible result.
      abortRef.current?.abort();
      clearDismissTimer();
      setResult(null);
      setGenerating(true);

      const controller = new AbortController();
      abortRef.current = controller;
      const signal = controller.signal;

      let session: LanguageModel | null = null;
      const start = performance.now();
      try {
        // Build the system prompt fresh per call — it includes current
        // tag/chart context, which the user may have just edited.
        const systemContent = buildSystemPrompt({
          tags: stateRef.current.tags,
          ganttCharts: stateRef.current.ganttCharts,
        });
        session = await nanoCreateSession({
          signal,
          initialPrompts: [{ role: "system", content: systemContent }],
        });
        const raw = await session.prompt(trimmed, {
          signal,
          responseConstraint: TOOL_SCHEMA,
        });
        const parsed = parseToolCall(raw.trim());
        const latencyMs = Math.round(performance.now() - start);
        log.debug("response", {
          kind: parsed.kind,
          latencyMs,
          promptChars: trimmed.length,
          rawChars: raw.length,
        });

        if (parsed.kind === "chat") {
          const text = parsed.text.trim();
          if (text) {
            setResult({ kind: "chat", text });
            scheduleDismiss(CHAT_VISIBLE_MS);
          }
          return;
        }
        if (parsed.kind === "parse-failed") {
          log.warn("parse-failed", {
            rawChars: raw.length,
            rawPreview: parsed.raw.slice(0, 500),
          });
          setResult({
            kind: "error",
            text: "Couldn't understand that — try rephrasing.",
          });
          scheduleDismiss(ERROR_VISIBLE_MS);
          return;
        }

        // Tool call — apply.
        const preSnapshot = stateRef.current;
        const applied = applyToolCall(parsed, preSnapshot);
        if (applied === null) {
          // Validation failure — give the user a useful hint per kind.
          let text: string;
          if (parsed.kind === "add_gantt_task") {
            const available = preSnapshot.ganttCharts.map((c) => `"${c.name}"`).join(", ");
            text = `Couldn't find that chart. Available: ${available || "(none)"}`;
          } else if (parsed.kind === "set_reminder") {
            text = "Reminder time must be in the future — try again with a future date/time.";
          } else {
            text = "I couldn't apply that — try slightly different wording.";
          }
          setResult({ kind: "error", text });
          scheduleDismiss(ERROR_VISIBLE_MS);
          return;
        }

        await update(() => applied.newState);
        setResult({
          kind: "action",
          summary: applied.payload.summary,
          undoToken: applied.payload.undoToken,
          snapshot: applied.payload.snapshot,
          expiresAt: applied.payload.expiresAt,
        });
        scheduleDismiss(ACTION_VISIBLE_MS);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          // Silenced — caller aborted (dismiss or unmount).
          return;
        }
        const message =
          err instanceof Error && err.name === "QuotaExceededError"
            ? "That message is too long — try shorter."
            : err instanceof Error
              ? `Error: ${err.message}`
              : "Unknown error — try again.";
        setResult({ kind: "error", text: message });
        scheduleDismiss(ERROR_VISIBLE_MS);
      } finally {
        session?.destroy();
        abortRef.current = null;
        setGenerating(false);
      }
    },
    [generating, update, scheduleDismiss, clearDismissTimer],
  );

  const undo = useCallback(async (): Promise<void> => {
    if (result === null || result.kind !== "action") return;
    if (result.expiresAt <= Date.now()) return; // expired
    try {
      await update(() => result.snapshot);
      clearDismissTimer();
      setResult(null);
    } catch {
      // Best-effort — if storage rejects, leave the affordance up so
      // the user can try the manual delete path.
    }
  }, [result, update, clearDismissTimer]);

  // Unmount: abort in-flight, clear timer.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      if (dismissTimerRef.current !== null) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  }, []);

  return { generating, result, ask, dismiss, undo };
}
