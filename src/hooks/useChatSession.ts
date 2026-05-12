import { useCallback, useEffect, useRef, useState } from "react";
import { createSession as nanoCreateSession } from "@/llm/nano";
import {
  TOOL_SCHEMA,
  buildSystemPrompt,
  parseToolCall,
  applyToolCall,
  type ToolResultPayload,
} from "@/llm/tools";
import { useStore } from "@/storage/useStore";

/*
 * Chat message shape. `system-notice` is used for trimmed-history notices
 * and inline errors — it renders differently from user/assistant messages.
 */
export type ChatRole = "user" | "assistant" | "system-notice";

export interface ChatMessage {
  id: number;
  role: ChatRole;
  text: string;
  /**
   * Present only on assistant messages that resulted from a successful tool
   * call. Carries the Undo affordance data and pre-call snapshot.
   */
  payload?: ToolResultPayload | undefined;
}

/*
 * useChatSession — encapsulates the Gemini Nano session lifecycle for the
 * ChatPanel.
 *
 * - Session is created lazily on first `send()` call (AC #3).
 * - System prompt injected via `initialPrompts` at session-create time (m3).
 * - `responseConstraint: TOOL_SCHEMA` passed on every `prompt()` call (m3).
 * - `contextoverflow` listener trims the oldest user+assistant pair and
 *   inserts a notice (AC #4).
 * - `clear()` aborts any in-flight prompt before destroying the session,
 *   then nulls the ref (AC #5). Next `send()` recreates lazily.
 * - Visible history cap: 100 messages (50 exchanges); oldest trimmed from
 *   React state when exceeded (synthesis note, not session-side trim).
 */

const MAX_MESSAGES = 100;
let nextId = 0;

function makeMsg(
  role: ChatRole,
  text: string,
  payload?: ToolResultPayload,
): ChatMessage {
  const msg: ChatMessage = { id: nextId++, role, text };
  if (payload !== undefined) msg.payload = payload;
  return msg;
}

export interface UseChatSessionResult {
  messages: readonly ChatMessage[];
  generating: boolean;
  send: (text: string) => Promise<void>;
  clear: () => void;
  /** Undo a tool call by restoring the pre-call snapshot.
   *  No-op if the undo window has expired or the token is unknown. */
  undo: (undoToken: string) => Promise<void>;
}

export function useChatSession(): UseChatSessionResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [generating, setGenerating] = useState(false);
  const { state, update } = useStore();

  const sessionRef = useRef<LanguageModel | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Mirror of `messages` state kept in sync for reads outside React's update cycle.
  const messagesRef = useRef<ChatMessage[]>([]);
  // Pending undo-expiry timer ids — cleared on clear() / unmount (rect M2).
  const undoTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  // Stable ref for the state so ensureSession / send don't rebuild on every state change.
  const stateRef = useRef(state);
  // Keep stateRef in sync on every render.
  stateRef.current = state;

  /*
   * Bind the contextoverflow listener once per new session. When it fires
   * the browser has already trimmed one exchange from the session-side
   * history. We mirror that by removing the first visible user+assistant
   * pair and inserting a notice line.
   */
  const bindOverflowListener = useCallback((session: LanguageModel) => {
    session.addEventListener("contextoverflow", () => {
      setMessages((prev) => {
        const next = [...prev];
        // Find the first user message index. The paired assistant message
        // is immediately after it (our send() always appends them in order).
        const firstUserIdx = next.findIndex((m) => m.role === "user");
        if (firstUserIdx !== -1) {
          // Remove user + assistant pair (2 items).
          next.splice(firstUserIdx, 2);
        }
        // Insert a notice at the top of the visible list.
        const notice = makeMsg("system-notice", "(older messages trimmed)");
        const result = [notice, ...next];
        messagesRef.current = result;
        return result;
      });
    });
  }, []);

  /*
   * Ensure a live session exists; create one if not.
   * The system prompt (tool-call instructions + available tags/charts) is
   * injected via `initialPrompts` at session-create time and is guaranteed
   * never to be evicted when the context window fills.
   */
  const ensureSession = useCallback(async (): Promise<LanguageModel> => {
    if (sessionRef.current) return sessionRef.current;
    // Read from stateRef at session-create time so this callback has a stable
    // reference (no state.tags / state.ganttCharts in the dep array).
    const systemContent = buildSystemPrompt({
      tags: stateRef.current.tags,
      ganttCharts: stateRef.current.ganttCharts,
    });
    const session = await nanoCreateSession({
      initialPrompts: [{ role: "system", content: systemContent }],
    });
    bindOverflowListener(session);
    sessionRef.current = session;
    return session;
  }, [bindOverflowListener]);

  /*
   * Append messages helper — enforces the MAX_MESSAGES cap and keeps messagesRef in sync.
   */
  const appendMessages = useCallback(
    (newMsgs: ChatMessage[]) => {
      setMessages((prev) => {
        let next = [...prev, ...newMsgs];
        if (next.length > MAX_MESSAGES) {
          next = next.slice(next.length - MAX_MESSAGES);
        }
        messagesRef.current = next;
        return next;
      });
    },
    [],
  );

  /*
   * Send a user message. Appends user message immediately, then awaits
   * the assistant reply. Handles QuotaExceededError (single message too
   * large) as a distinct inline error (AC #4).
   *
   * m3: passes `responseConstraint: TOOL_SCHEMA` on every prompt() call,
   * parses the JSON response, dispatches to the appropriate tool action,
   * and emits a tool-result message with Undo affordance.
   */
  const send = useCallback(
    async (userText: string): Promise<void> => {
      if (generating) return;

      const trimmed = userText.trim();
      if (!trimmed) return;

      setGenerating(true);

      // Append user message to visible history.
      const userMsg = makeMsg("user", trimmed);
      appendMessages([userMsg]);

      // Per-prompt AbortController.
      const controller = new AbortController();
      abortRef.current = controller;
      const signal = controller.signal;

      try {
        const session = await ensureSession();
        const raw = await session.prompt(trimmed, {
          signal,
          responseConstraint: TOOL_SCHEMA,
        });

        const parsed = parseToolCall(raw.trim());

        if (parsed.kind === "chat") {
          // Plain conversational response — existing path.
          appendMessages([makeMsg("assistant", parsed.text)]);
          return;
        }

        if (parsed.kind === "parse-failed") {
          // Could not parse JSON or unrecognised type — demote to system-notice.
          appendMessages([
            makeMsg(
              "system-notice",
              `(Could not parse response — showing raw output: ${parsed.raw.slice(0, 200)})`,
            ),
          ]);
          return;
        }

        // Tool call — capture pre-snapshot, validate, apply.
        const preSnapshot = stateRef.current;
        const result = applyToolCall(parsed, preSnapshot);

        if (result === null) {
          // Validation failed (bad chartId, past fireAt, etc.)
          let notice: string;
          if (parsed.kind === "add_gantt_task") {
            const available = stateRef.current.ganttCharts
              .map((c) => `"${c.name}"`)
              .join(", ");
            notice =
              `Couldn't find chart "${parsed.chartId}". Available charts: ${available || "(none)"}`;
          } else if (parsed.kind === "set_reminder") {
            notice =
              "Reminder time must be in the future. Please try again with a future date/time.";
          } else {
            notice = "Tool call validation failed — please try again.";
          }
          appendMessages([makeMsg("system-notice", notice)]);
          return;
        }

        // Write the new state.
        await update(() => result.newState);

        // Build messages to append.
        const toAppend: ChatMessage[] = [];

        // Optional system-notice for dropped tags.
        if (result.systemNotice !== null) {
          toAppend.push(makeMsg("system-notice", result.systemNotice));
        }

        // Tool-result message with the Undo payload.
        const toolResultMsg = makeMsg(
          "assistant",
          result.payload.summary,
          result.payload,
        );
        toAppend.push(toolResultMsg);

        // AC5 disambiguation (rect M1): when the model returns a tool call
        // accompanied by a top-level `text` field (e.g. "Sure, I added
        // that!"), surface it as a sibling assistant message so both the
        // record card AND the prose render. TS knows we're in a non-chat
        // branch here; chat already routed its `text` through the
        // assistant-message path above.
        if (typeof parsed.accompanyingText === "string") {
          const proseText = parsed.accompanyingText.trim();
          if (proseText) {
            toAppend.push(makeMsg("assistant", proseText));
          }
        }

        appendMessages(toAppend);

        // Schedule the undo-button expiry: after 10 s mark the message
        // as expired so the UI fades the button. Store the timer id so
        // clear() and unmount can cancel it (rect M2).
        const msgId = toolResultMsg.id;
        const timerId = setTimeout(() => {
          undoTimersRef.current.delete(timerId);
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== msgId || m.payload === undefined) return m;
              // Rebuild with an expired token — set expiresAt to now so the
              // UI check (payload.expiresAt <= Date.now()) becomes true.
              return {
                ...m,
                payload: { ...m.payload, expiresAt: 0 },
              };
            }),
          );
        }, 10_000);
        undoTimersRef.current.add(timerId);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          // Cleared during generation — the clear() handler already
          // emptied the history; nothing else to do.
          return;
        }
        // QuotaExceededError: single message too large for the context window.
        const isQuota =
          err instanceof Error && err.name === "QuotaExceededError";
        const errorText = isQuota
          ? "Message too long — try a shorter message."
          : err instanceof Error
            ? `Error: ${err.message}`
            : "Unknown error — try again.";
        appendMessages([makeMsg("system-notice", errorText)]);
      } finally {
        abortRef.current = null;
        setGenerating(false);
      }
    },
    [generating, ensureSession, update, appendMessages],
  );

  /*
   * Undo a tool call by restoring the pre-call snapshot. No-op if the
   * undo window has expired (expiresAt <= Date.now()) or the token is unknown.
   * Reads from messagesRef to avoid the functional-updater side-effect anti-pattern.
   */
  const undo = useCallback(
    async (undoToken: string): Promise<void> => {
      // Guard against racing with an in-flight prompt (rect M5). If we
      // restored the pre-call snapshot now, the in-flight send()'s final
      // update() would overwrite our restore and the undo would silently fail.
      if (generating) return;

      const msg = messagesRef.current.find(
        (m) => m.payload?.undoToken === undoToken,
      );
      if (!msg || msg.payload === undefined) return;
      if (msg.payload.expiresAt <= Date.now()) return; // expired

      const snapshotToRestore = msg.payload.snapshot;
      const msgId = msg.id;

      // Apply the restore FIRST. Only remove the tool-result message from the
      // visible thread once the storage write succeeds — otherwise an
      // update() rejection (storage error, quota, etc.) would orphan the user
      // with no Undo affordance AND no rollback (rect M3).
      try {
        await update(() => snapshotToRestore);
        setMessages((prev) => {
          const next = prev.filter((m) => m.id !== msgId);
          messagesRef.current = next;
          return next;
        });
      } catch {
        appendMessages([
          makeMsg(
            "system-notice",
            "Undo failed — could not restore previous state. The action was not reverted.",
          ),
        ]);
      }
    },
    [generating, update, appendMessages],
  );

  /*
   * Clear chat: abort in-flight prompt first (synchronous signal), then
   * destroy the session, null the ref, empty history (AC #5).
   * Per brief-2 §1: abort() before destroy() to avoid stale state writes.
   */
  const clear = useCallback((): void => {
    abortRef.current?.abort();
    abortRef.current = null;

    sessionRef.current?.destroy();
    sessionRef.current = null;

    // Cancel any pending undo-expiry timers — the messages they target are
    // being removed, so their setMessages callbacks would be no-ops at best
    // (rect M2).
    for (const id of undoTimersRef.current) clearTimeout(id);
    undoTimersRef.current.clear();

    messagesRef.current = [];
    setMessages([]);
    setGenerating(false);
  }, []);

  /*
   * Unmount cleanup (rect H1): abort any in-flight prompt and destroy the
   * session when the hook's owning component unmounts. Without this, toggling
   * `chatEnabled` off (or H2's panel-close path) would tear down the hook
   * instance while a session was still holding GPU/CPU inference resources.
   * Same abort-before-destroy ordering as `clear()`.
   */
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      sessionRef.current?.destroy();
      sessionRef.current = null;
      // Also clear any pending undo-expiry timers so they don't fire
      // setMessages on an unmounted component (rect M2).
      for (const id of undoTimersRef.current) clearTimeout(id);
      undoTimersRef.current.clear();
    };
  }, []);

  return { messages, generating, send, clear, undo };
}
