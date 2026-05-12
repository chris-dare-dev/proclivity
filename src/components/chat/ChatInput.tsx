import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";

/*
 * ChatInput — textarea with send button.
 *
 * Enter submits; Shift+Enter inserts a newline.
 * Input and button are disabled while `disabled` is true (generation in
 * flight — AC #2 send-while-generating: reject).
 */

interface ChatInputProps {
  disabled: boolean;
  onSend: (text: string) => void;
}

export function ChatInput({ disabled, onSend }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    // Return focus to textarea after send.
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <textarea
        ref={textareaRef}
        className="chat-input__textarea"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? "Nano is thinking…" : "Message Nano…"}
        disabled={disabled}
        rows={2}
        aria-label="Chat message"
      />
      <button
        type="submit"
        className="chat-input__send"
        disabled={disabled || !value.trim()}
        aria-label="Send"
      >
        Send
      </button>
    </form>
  );
}
