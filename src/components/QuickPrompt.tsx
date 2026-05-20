/*
 * QuickPrompt — always-visible one-shot Nano prompt above the tabs.
 *
 * Placement: rendered in App.tsx between <Header /> and <nav className="tabs">.
 * Gated on:
 *   - `state.settings.geminiNano.chatEnabled` (same toggle as the side panel)
 *   - `LanguageModel.availability() !== "unavailable"`
 *   - layoutMode !== "card" (card canvases want their full vertical room)
 *
 * One submit = one fresh session + one prompt() + one inline result.
 * Tool actions (add_todo / add_gantt_task / set_reminder) land in the
 * usual sections; this surface only shows the summary + a 10 s Undo.
 * Chat-classified responses render as one-line text, dismissible or
 * auto-fading after 8 s.
 */

import { useEffect, useState } from "react";
import { useStore } from "@/storage/useStore";
import { resolvedSettings } from "@/storage/constants";
import { availability as nanoAvailability, type NanoAvailability } from "@/llm/nano";
import { useQuickPrompt } from "@/hooks/useQuickPrompt";
import { Check, X } from "lucide-react";
import "./QuickPrompt.css";

const PLACEHOLDER =
  "How can I help? Try: 'add a todo to call the dentist tomorrow'";

export function QuickPrompt() {
  const { state } = useStore();
  const rs = resolvedSettings(state.settings);
  const [availability, setAvailability] =
    useState<NanoAvailability | "checking">("checking");
  const [input, setInput] = useState("");
  const { generating, result, ask, dismiss, undo } = useQuickPrompt();

  // Availability check on mount. Re-checks aren't needed at this surface —
  // if the model status flips mid-session, the Settings → Nano section is
  // the canonical place for that signal.
  useEffect(() => {
    let cancelled = false;
    void nanoAvailability().then((a) => {
      if (!cancelled) setAvailability(a);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Visibility gates (in priority order so we exit early on each):
  // 1. Feature toggle off → render nothing (consistent with the chat bubble).
  // 2. Nano explicitly unavailable → render nothing (hint lives in Settings).
  // 3. Card layout mode → render nothing (the canvases want full height).
  // The "checking" state DOES render — the input is usable optimistically;
  // the first submit will surface a real error if Nano never resolves.
  if (!rs.geminiNano.chatEnabled) return null;
  if (availability === "unavailable") return null;
  if (rs.layoutMode === "card") return null;

  const submit = () => {
    const trimmed = input.trim();
    if (!trimmed || generating) return;
    setInput("");
    void ask(trimmed);
  };

  return (
    <div className="quick-prompt" role="region" aria-label="Ask Gemini Nano">
      <div className="quick-prompt-row">
        <input
          type="text"
          className="quick-prompt-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            } else if (e.key === "Escape" && result !== null) {
              dismiss();
            }
          }}
          placeholder={PLACEHOLDER}
          disabled={generating}
          aria-label="Ask Gemini Nano"
          spellCheck={false}
        />
        <button
          type="button"
          className="quick-prompt-submit"
          onClick={submit}
          disabled={!input.trim() || generating}
          aria-label="Send to Nano"
        >
          {generating ? "Thinking…" : "Ask"}
        </button>
      </div>

      {result !== null && (
        <QuickResultBanner result={result} onDismiss={dismiss} onUndo={undo} />
      )}
    </div>
  );
}

/* ── Result banner ────────────────────────────────────────────────── */

interface BannerProps {
  result: ReturnType<typeof useQuickPrompt>["result"];
  onDismiss: () => void;
  onUndo: () => Promise<void>;
}

function QuickResultBanner({ result, onDismiss, onUndo }: BannerProps) {
  if (result === null) return null;
  if (result.kind === "action") {
    return (
      <div className="quick-prompt-banner action" role="status">
        <span className="quick-prompt-banner-text"><Check size={13} aria-hidden="true" /> {result.summary}</span>
        <div className="quick-prompt-banner-actions">
          <button
            type="button"
            className="quick-prompt-undo"
            onClick={() => void onUndo()}
          >
            Undo
          </button>
          <button
            type="button"
            className="quick-prompt-dismiss"
            onClick={onDismiss}
            aria-label="Dismiss"
            title="Dismiss"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }
  if (result.kind === "chat") {
    return (
      <div className="quick-prompt-banner chat" role="status">
        <span className="quick-prompt-banner-text">{result.text}</span>
        <button
          type="button"
          className="quick-prompt-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss"
          title="Dismiss"
        >
          ✕
        </button>
      </div>
    );
  }
  // error
  return (
    <div className="quick-prompt-banner error" role="alert">
      <span className="quick-prompt-banner-text">{result.text}</span>
      <button
        type="button"
        className="quick-prompt-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss"
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
