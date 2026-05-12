import type { ChatRole } from "@/hooks/useChatSession";

/*
 * ChatMessage — renders a single message in the chat thread.
 *
 * Roles:
 *   "user"          — the user's own message (right-aligned badge)
 *   "assistant"     — Gemini Nano's reply (left-aligned badge)
 *   "system-notice" — trim notices and inline errors (centred, muted)
 */

interface ChatMessageProps {
  role: ChatRole;
  text: string;
}

const ROLE_LABELS: Record<ChatRole, string> = {
  user: "You",
  assistant: "Nano",
  "system-notice": "",
};

export function ChatMessage({ role, text }: ChatMessageProps) {
  if (role === "system-notice") {
    return (
      <div className="chat-message chat-message--notice" aria-live="polite">
        <span className="chat-message__text">{text}</span>
      </div>
    );
  }

  return (
    <div className={`chat-message chat-message--${role}`}>
      <span className="chat-message__badge">{ROLE_LABELS[role]}</span>
      <p className="chat-message__text">{text}</p>
    </div>
  );
}
