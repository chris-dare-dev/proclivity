import { useEffect, useState } from "react";
import type { ChatRole, ChatMessage as ChatMessageData } from "@/hooks/useChatSession";

/*
 * ChatMessage — renders a single message in the chat thread.
 *
 * Roles:
 *   "user"          — the user's own message (right-aligned badge)
 *   "assistant"     — Gemini Nano's reply (left-aligned badge)
 *   "system-notice" — trim notices and inline errors (centred, muted)
 *
 * m3: when `msg.payload?.type === "tool-result"`, renders a record card
 * with a summary and an Undo button. The button fades after 10 seconds
 * (driven by `payload.expiresAt`).
 */

interface ChatMessageProps {
  msg: ChatMessageData;
  onUndo?: ((undoToken: string) => void) | undefined;
}

const ROLE_LABELS: Record<ChatRole, string> = {
  user: "You",
  assistant: "Nano",
  "system-notice": "",
};

export function ChatMessage({ msg, onUndo }: ChatMessageProps) {
  const { role, text, payload } = msg;

  if (role === "system-notice") {
    return (
      <div className="chat-message chat-message--notice" aria-live="polite">
        <span className="chat-message__text">{text}</span>
      </div>
    );
  }

  // Tool-result card — assistant message with a ToolResultPayload.
  if (role === "assistant" && payload?.type === "tool-result") {
    return (
      <ToolResultCard
        summary={payload.summary}
        undoToken={payload.undoToken}
        expiresAt={payload.expiresAt}
        onUndo={onUndo}
      />
    );
  }

  return (
    <div className={`chat-message chat-message--${role}`}>
      <span className="chat-message__badge">{ROLE_LABELS[role]}</span>
      <p className="chat-message__text">{text}</p>
    </div>
  );
}

// ── Tool-result card ──────────────────────────────────────────────────────

interface ToolResultCardProps {
  summary: string;
  undoToken: string;
  expiresAt: number;
  onUndo?: ((undoToken: string) => void) | undefined;
}

function ToolResultCard({
  summary,
  undoToken,
  expiresAt,
  onUndo,
}: ToolResultCardProps) {
  // `expired` drives the CSS fade. Initialise from the payload's expiresAt
  // so if this message is re-rendered after the timeout has already fired
  // (e.g., React StrictMode double-mount), it starts in the correct state.
  const [expired, setExpired] = useState(() => expiresAt <= Date.now());

  useEffect(() => {
    if (expiresAt <= Date.now()) {
      setExpired(true);
      return;
    }
    const remaining = expiresAt - Date.now();
    const t = setTimeout(() => setExpired(true), remaining);
    return () => clearTimeout(t);
  }, [expiresAt]);

  const handleUndo = () => {
    if (!expired && onUndo) {
      onUndo(undoToken);
    }
  };

  return (
    <div className="chat-message chat-message--assistant">
      <span className="chat-message__badge">{ROLE_LABELS["assistant"]}</span>
      <div className="chat-panel__tool-result">
        <span className="chat-panel__tool-summary">{summary}</span>
        <button
          type="button"
          className={`chat-panel__undo-btn${expired ? " chat-panel__undo-btn--expired" : ""}`}
          onClick={handleUndo}
          disabled={expired}
          aria-label="Undo this action"
          title={expired ? "Undo window expired" : "Undo"}
        >
          Undo
        </button>
      </div>
    </div>
  );
}
