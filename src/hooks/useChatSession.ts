import { useCallback, useRef, useState } from "react";
import { createSession as nanoCreateSession } from "@/llm/nano";

/*
 * Chat message shape. `system-notice` is used for trimmed-history notices
 * and inline errors — it renders differently from user/assistant messages.
 */
export type ChatRole = "user" | "assistant" | "system-notice";

export interface ChatMessage {
  id: number;
  role: ChatRole;
  text: string;
}

/*
 * useChatSession — encapsulates the Gemini Nano session lifecycle for the
 * ChatPanel.
 *
 * - Session is created lazily on first `send()` call (AC #3).
 * - `contextoverflow` listener trims the oldest user+assistant pair and
 *   inserts a notice (AC #4).
 * - `clear()` aborts any in-flight prompt before destroying the session,
 *   then nulls the ref (AC #5). Next `send()` recreates lazily.
 * - Visible history cap: 100 messages (50 exchanges); oldest trimmed from
 *   React state when exceeded (synthesis note, not session-side trim).
 */

const MAX_MESSAGES = 100;
let nextId = 0;

function makeMsg(role: ChatRole, text: string): ChatMessage {
  return { id: nextId++, role, text };
}

export interface UseChatSessionResult {
  messages: readonly ChatMessage[];
  generating: boolean;
  send: (text: string) => Promise<void>;
  clear: () => void;
}

export function useChatSession(): UseChatSessionResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [generating, setGenerating] = useState(false);

  const sessionRef = useRef<LanguageModel | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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
        return [notice, ...next];
      });
    });
  }, []);

  /*
   * Ensure a live session exists; create one if not.
   */
  const ensureSession = useCallback(async (): Promise<LanguageModel> => {
    if (sessionRef.current) return sessionRef.current;
    const session = await nanoCreateSession();
    bindOverflowListener(session);
    sessionRef.current = session;
    return session;
  }, [bindOverflowListener]);

  /*
   * Send a user message. Appends user message immediately, then awaits
   * the assistant reply. Handles QuotaExceededError (single message too
   * large) as a distinct inline error (AC #4).
   */
  const send = useCallback(
    async (userText: string): Promise<void> => {
      if (generating) return;

      const trimmed = userText.trim();
      if (!trimmed) return;

      setGenerating(true);

      // Append user message to visible history.
      const userMsg = makeMsg("user", trimmed);
      setMessages((prev) => {
        const next = [...prev, userMsg];
        // Enforce visible cap: drop oldest messages beyond MAX_MESSAGES.
        if (next.length > MAX_MESSAGES) {
          return next.slice(next.length - MAX_MESSAGES);
        }
        return next;
      });

      // Per-prompt AbortController (AC #7 / brief-2 §1).
      const controller = new AbortController();
      abortRef.current = controller;
      const signal = controller.signal;

      try {
        const session = await ensureSession();
        const reply = await session.prompt(trimmed, { signal });
        const assistantMsg = makeMsg("assistant", reply.trim());
        setMessages((prev) => {
          const next = [...prev, assistantMsg];
          if (next.length > MAX_MESSAGES) {
            return next.slice(next.length - MAX_MESSAGES);
          }
          return next;
        });
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
        const errorMsg = makeMsg("system-notice", errorText);
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        abortRef.current = null;
        setGenerating(false);
      }
    },
    [generating, ensureSession],
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

    setMessages([]);
    setGenerating(false);
  }, []);

  return { messages, generating, send, clear };
}
