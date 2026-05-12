import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  availability as nanoAvailability,
  createSession as nanoCreateSession,
  NanoUnavailableError,
  type NanoAvailability,
} from "@/llm/nano";
import "./NanoSection.css";

/*
 * Gemini Nano (on-device LLM) settings section. Recovered from
 * `b99a92b:src/components/SettingsModal.tsx` after Settings v2 inadvertently
 * dropped it during the modal-restructure. The H1 / M1 / M2 rectify fixes
 * from b99a92b are preserved verbatim:
 *
 *   - H1: ProgressEvent.loaded is a byte count; normalise against e.total.
 *   - M1: Capture the AbortSignal into a local before the first await so
 *         the close-effect setting abortRef.current = null doesn't cause
 *         a TypeError between awaits.
 *   - M2: Widen createSession initialPrompts to accept the system-message-
 *         first overload (handled inside @/llm/nano).
 *
 * Lives inside `src/components/settings/` to match v2's convention of
 * one-file-per-section. Renders inside the v2 modal between Account and
 * Data sections.
 */

/** Local SectionHeader to avoid coupling to SettingsModal's private one. */
function SectionHeader({ children }: { children: ReactNode }) {
  return <h3 className="settings-section-heading">{children}</h3>;
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

export function NanoSection() {
  const [nano, setNano] = useState<NanoState>(initialNanoState);
  // Abort handle so closing the modal mid-prompt cancels in-flight work.
  const abortRef = useRef<AbortController | null>(null);

  // Check availability on mount. The Modal returns null while closed, so
  // this section only mounts when the user has just opened Settings —
  // re-mount = re-check.
  useEffect(() => {
    let cancelled = false;
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
      // Abort any in-flight test prompt when the section unmounts (modal close).
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, []);

  const runTestPrompt = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    // Capture the signal into a local so the inner await sites don't depend
    // on abortRef.current still being non-null after the microtask gap (M1).
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
            // (the badge renders without a percentage) otherwise (H1).
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

  const { availability, downloadProgress, testResponse, error, testInFlight } =
    nano;

  return (
    <section className="settings-section">
      <SectionHeader>Gemini Nano</SectionHeader>
      <div className="settings-field">
        <span className="settings-label">On-device model status</span>
        <div className="settings-nano">
          <div className="settings-nano-row">
            <NanoBadge
              availability={availability}
              progress={downloadProgress}
            />
            <button
              type="button"
              onClick={runTestPrompt}
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
              Your Chrome doesn't expose the Prompt API. On stable Chrome,
              enable{" "}
              <code>chrome://flags/#prompt-api-for-gemini-nano</code> and
              restart, or use a Dev/Canary channel. See{" "}
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
              The on-device model isn't downloaded yet. Click{" "}
              <em>Test prompt</em> to start the ~4 GB download (one-time).
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
      </div>
    </section>
  );
}

/* ─── Internal: status badge ─────────────────────────────────── */

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
