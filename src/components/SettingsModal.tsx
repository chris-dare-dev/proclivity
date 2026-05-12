import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { useStore } from "@/storage/useStore";
import {
  availability as nanoAvailability,
  createSession as nanoCreateSession,
  NanoUnavailableError,
  type NanoAvailability,
} from "@/llm/nano";
import "./SettingsModal.css";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface NanoState {
  availability: NanoAvailability | "checking";
  /** Download progress 0.0–1.0; populated only while availability === "downloading". */
  downloadProgress: number | null;
  /** Last test-prompt response, if any. */
  testResponse: string | null;
  /** Inline error for the user's last action. */
  error: string | null;
  /** Spinner state for the Test Prompt button. */
  testInFlight: boolean;
}

const initialNanoState: NanoState = {
  availability: "checking",
  downloadProgress: null,
  testResponse: null,
  error: null,
  testInFlight: false,
};

/**
 * Settings modal triggered from the header gear icon. Edits the user's
 * display name and surfaces the on-device Gemini Nano availability status.
 * Designed to grow as preferences accumulate (work hours, theme, etc.).
 */
export function SettingsModal({ open, onClose }: Props) {
  const { state, update } = useStore();
  const [name, setName] = useState(state.settings.name ?? "");
  const [nano, setNano] = useState<NanoState>(initialNanoState);
  // Abort handle so closing the modal mid-prompt cancels in-flight work.
  const abortRef = useRef<AbortController | null>(null);

  // Re-sync local form state whenever the modal is re-opened — the underlying
  // store may have changed since the last close.
  useEffect(() => {
    if (open) setName(state.settings.name ?? "");
  }, [open, state.settings.name]);

  // Re-check Nano availability whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setNano((s) => ({ ...s, availability: "checking", error: null }));
    nanoAvailability().then(
      (result) => {
        if (!cancelled) setNano((s) => ({ ...s, availability: result }));
      },
      (err: unknown) => {
        if (cancelled) return;
        setNano((s) => ({
          ...s,
          availability: "unavailable",
          error: err instanceof Error ? err.message : String(err),
        }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Abort any in-flight prompt when the modal closes.
  useEffect(() => {
    if (!open && abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, [open]);

  const save = async () => {
    const next = name.trim();
    await update((s) => ({
      ...s,
      settings: {
        ...s.settings,
        name: next || undefined,
      },
    }));
    onClose();
  };

  const runTestPrompt = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    // Capture the signal into a local so the inner await sites don't
    // depend on abortRef.current still being non-null after the
    // microtask gap — the close-effect can null it out between awaits
    // and dereferencing `null.signal` would throw a TypeError that
    // bypasses our AbortError silencer (rect M1).
    const signal = controller.signal;
    setNano((s) => ({
      ...s,
      testInFlight: true,
      testResponse: null,
      error: null,
    }));
    try {
      const session = await nanoCreateSession({
        signal,
        monitor: (m) => {
          m.addEventListener("downloadprogress", (e) => {
            // ProgressEvent.loaded is a byte count, NOT a 0–1 fraction.
            // Normalise against e.total when present; fall back to null
            // (the badge will render without a percentage) otherwise.
            // (rect H1)
            const fraction =
              e.total > 0 ? Math.min(e.loaded / e.total, 1) : null;
            setNano((s) => ({
              ...s,
              availability: "downloading",
              downloadProgress: fraction,
            }));
          });
        },
      });
      try {
        const response = await session.prompt("Say hi in 5 words.", {
          signal,
        });
        setNano((s) => ({
          ...s,
          availability: "available",
          downloadProgress: null,
          testResponse: response.trim(),
          testInFlight: false,
        }));
      } finally {
        session.destroy();
      }
    } catch (err: unknown) {
      // AbortError on modal close — silent.
      if (err instanceof Error && err.name === "AbortError") {
        setNano((s) => ({ ...s, testInFlight: false }));
        return;
      }
      const message =
        err instanceof NanoUnavailableError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Test prompt failed";
      setNano((s) => ({ ...s, error: message, testInFlight: false }));
    } finally {
      abortRef.current = null;
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <form
        className="modal-body settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className="settings-field">
          <span className="settings-label">Your name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What should we call you?"
            maxLength={48}
            autoFocus
          />
          <span className="settings-hint">
            Appears in the greeting at the top of the page. Leave blank to
            omit.
          </span>
        </label>

        <div className="settings-field">
          <span className="settings-label">Gemini Nano (on-device)</span>
          <NanoStatusBlock
            nano={nano}
            onTestPrompt={runTestPrompt}
          />
        </div>
      </form>
      <div className="modal-footer">
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="modal-btn-primary" onClick={save}>
          Save
        </button>
      </div>
    </Modal>
  );
}

/* ─── Gemini Nano status block ───────────────────────────────────── */

interface NanoStatusBlockProps {
  nano: NanoState;
  onTestPrompt: () => void;
}

function NanoStatusBlock({ nano, onTestPrompt }: NanoStatusBlockProps) {
  const { availability, downloadProgress, testResponse, error, testInFlight } =
    nano;

  return (
    <div className="settings-nano">
      <div className="settings-nano-row">
        <NanoBadge availability={availability} progress={downloadProgress} />
        <button
          type="button"
          onClick={onTestPrompt}
          disabled={
            testInFlight ||
            availability === "checking" ||
            availability === "unavailable"
          }
        >
          {testInFlight ? "Running…" : "Test prompt"}
        </button>
      </div>

      {availability === "unavailable" && (
        <span className="settings-hint">
          Your Chrome doesn't expose the Prompt API. On stable Chrome, enable{" "}
          <code>chrome://flags/#prompt-api-for-gemini-nano</code> and restart,
          or use a Dev/Canary channel. See{" "}
          <a
            href="https://developer.chrome.com/docs/ai/get-started"
            target="_blank"
            rel="noreferrer"
          >
            Chrome built-in AI docs
          </a>
          .
        </span>
      )}

      {availability === "downloadable" && (
        <span className="settings-hint">
          The on-device model isn't downloaded yet. Click <em>Test prompt</em>{" "}
          to start the ~4 GB download (one-time).
        </span>
      )}

      {testResponse && (
        <div className="settings-nano-response" role="status">
          <span className="settings-label">Nano said:</span>
          <p>{testResponse}</p>
        </div>
      )}

      {error && (
        <div className="settings-nano-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

interface NanoBadgeProps {
  availability: NanoState["availability"];
  progress: number | null;
}

function NanoBadge({ availability, progress }: NanoBadgeProps) {
  switch (availability) {
    case "checking":
      return <span className="settings-nano-badge checking">Checking…</span>;
    case "available":
      return <span className="settings-nano-badge ready">Ready</span>;
    case "downloading":
      return (
        <span className="settings-nano-badge downloading">
          Downloading{progress !== null && ` ${Math.round(progress * 100)}%`}
        </span>
      );
    case "downloadable":
      return (
        <span className="settings-nano-badge downloadable">
          Downloadable (~4 GB)
        </span>
      );
    case "unavailable":
      return (
        <span className="settings-nano-badge unavailable">Unavailable</span>
      );
  }
}
