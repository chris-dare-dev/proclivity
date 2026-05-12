import { useEffect, useRef } from "react";
import { useChatSession } from "@/hooks/useChatSession";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import "./ChatPanel.css";

/*
 * ChatPanel — right-side slide-in panel for on-device chat with Gemini Nano.
 *
 * Acceptance criteria met here:
 *   AC #1  — panel is only mounted when chatEnabled AND chatOpen (gated in
 *            App.tsx). Unmount on close releases session + abort via the
 *            useChatSession cleanup effect (rect H1+H2).
 *   AC #2  — slides in at ~380px, bottom drawer on ≤900px (CSS).
 *   AC #3  — session created lazily by useChatSession on first send.
 *   AC #4  — contextoverflow + QuotaExceededError handled in useChatSession.
 *   AC #5  — "Clear chat" calls useChatSession.clear().
 *   AC #7  — AbortController per prompt handled in useChatSession.
 *
 * Default export required for React.lazy(() => import("@/components/chat/ChatPanel")).
 */

interface ChatPanelProps {
  onClose: () => void;
}

export default function ChatPanel({ onClose }: ChatPanelProps) {
  const { messages, generating, send, clear, undo } = useChatSession();
  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const trapFocus = useFocusTrap(panelRef);

  // Auto-scroll to the latest message. Panel is always mounted when open
  // (gated in App.tsx), so we don't need an `open` guard here.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Escape closes the panel.
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="chat-panel chat-panel--open"
      role="complementary"
      aria-label="Gemini Nano chat"
      onKeyDown={trapFocus}
    >
      {/* Header */}
      <div className="chat-panel__header">
        <h2 className="chat-panel__title">Chat</h2>
        <span className="chat-panel__attribution">
          Powered by Gemini Nano · on-device
        </span>
        <button
          type="button"
          className="chat-panel__clear"
          onClick={clear}
          disabled={messages.length === 0 && !generating}
          aria-label="Clear chat"
          title="Clear chat"
        >
          Clear
        </button>
        <button
          type="button"
          className="chat-panel__close"
          onClick={onClose}
          aria-label="Close chat panel"
          title="Close"
        >
          <CloseIcon />
        </button>
      </div>

      {/*
        Message list. aria-live deliberately NOT set here (rect M1) — each
        <ChatMessage> with role="system-notice" already declares aria-live,
        and the .chat-panel__thinking indicator carries its own. Nesting two
        live regions caused duplicate / garbled announcements on some
        screen readers.
      */}
      <div className="chat-panel__messages">
        {messages.length === 0 && !generating ? (
          <p className="chat-panel__empty">
            Ask Gemini Nano anything — your conversation stays on-device.
          </p>
        ) : null}

        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            msg={msg}
            onUndo={msg.payload !== undefined ? undo : undefined}
          />
        ))}

        {generating ? (
          <div className="chat-panel__thinking" aria-live="polite">
            <span>Nano is thinking</span>
            <span className="chat-panel__thinking-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput disabled={generating} onSend={send} />
    </div>
  );
}

/* ── Close icon ──────────────────────────────────────────────────── */

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="2" y1="2" x2="14" y2="14" />
      <line x1="14" y1="2" x2="2" y2="14" />
    </svg>
  );
}
