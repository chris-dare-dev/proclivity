/**
 * GooglePhotosPane — connect to Google Photos and manage the cached
 * photo set that powers the Photos slideshow widget.
 *
 * Live state (subscribes to photosStore directly rather than going through
 * useStore) because the cache lives under its own chrome.storage key and is
 * intentionally NOT in the main ProclivityState tree — see store.ts for the
 * rationale.
 *
 * Slideshow preferences (interval / fit / shuffle) DO live in UserSettings
 * and use the staged-on-Done pattern via the props passed from
 * SettingsModal.tsx.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { SegmentedControl, ToggleSwitch } from "../SettingsControls";
import {
  EMPTY_PHOTOS_STATE,
  photosStore,
  type PhotosState,
} from "@/lib/googlePhotos/store";
import { runPickerFlow } from "@/lib/googlePhotos/picker";
import {
  collectDiagnostics,
  formatDiagnostics,
  GoogleAuthError,
  getToken,
  revoke,
  type PhotosDiagnostics,
} from "@/lib/googlePhotos/auth";
import type { UserSettings } from "@/types";

interface LiveUpdater {
  <K extends keyof UserSettings>(key: K, value: UserSettings[K]): void;
}

export interface GooglePhotosPaneProps {
  /** Resolved settings — used to read current slideshow prefs. */
  slideshowIntervalSeconds: number;
  displayMode: "crop" | "full" | "compact";
  shuffle: boolean;
  pendingPhotosVisible: boolean;
  setPendingPhotosVisible: (v: boolean) => void;
  live: LiveUpdater;
}

type ConnState =
  | { kind: "checking" }
  | { kind: "disconnected" }
  | { kind: "connected" }
  | { kind: "picking"; pickerUri: string | null }
  | { kind: "error"; message: string; diagnostics: PhotosDiagnostics };

export function GooglePhotosPane({
  slideshowIntervalSeconds,
  displayMode,
  shuffle,
  pendingPhotosVisible,
  setPendingPhotosVisible,
  live,
}: GooglePhotosPaneProps) {
  const [photos, setPhotos] = useState<PhotosState>(EMPTY_PHOTOS_STATE);
  const [conn, setConn] = useState<ConnState>({ kind: "checking" });
  const [lastSkipped, setLastSkipped] = useState<
    Array<{ filename: string; reason: string }>
  >([]);
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  // Live-subscribe to the photos cache.
  useEffect(() => {
    let mounted = true;
    void photosStore.get().then((s) => {
      if (mounted) setPhotos(s);
    });
    const unsub = photosStore.subscribe((s) => {
      if (mounted) setPhotos(s);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  // Probe the token cache so we can render the right CTA on mount.
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const token = await getToken({ interactive: false });
        if (!mounted) return;
        setConn({ kind: token ? "connected" : "disconnected" });
      } catch (err) {
        if (!mounted) return;
        setConn({
          kind: "error",
          message: err instanceof Error ? err.message : String(err),
          diagnostics:
            err instanceof GoogleAuthError ? err.diagnostics : collectDiagnostics(),
        });
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const onPick = useCallback(async () => {
    cancelRef.current = { cancelled: false };
    setLastSkipped([]);
    setConn({ kind: "picking", pickerUri: null });
    try {
      const result = await runPickerFlow({
        openPickerUri: (url) => {
          setConn({ kind: "picking", pickerUri: url });
          try {
            window.open(url, "_blank", "noopener,noreferrer");
          } catch {
            // Pop-up blocked — the UI still surfaces the link as a fallback
            // ("Open Picker" button reads the URL from the picking state).
          }
        },
        shouldCancel: () => cancelRef.current.cancelled,
      });
      setLastSkipped(result.skipped);
      setConn({ kind: "connected" });
      // Auto-reveal the Photos tab once a successful pick lands (only if
      // the user hasn't explicitly toggled it off in this session). The
      // pending-visibility toggle on this pane is the user-facing override.
      if (result.photos.length > 0 && !pendingPhotosVisible) {
        setPendingPhotosVisible(true);
      }
    } catch (err) {
      setConn({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
        diagnostics:
          err instanceof GoogleAuthError ? err.diagnostics : collectDiagnostics(),
      });
    }
  }, [pendingPhotosVisible, setPendingPhotosVisible]);

  const onCancelPick = useCallback(() => {
    cancelRef.current.cancelled = true;
    setConn({ kind: "connected" });
  }, []);

  const onClearPhotos = useCallback(async () => {
    await photosStore.clear();
    setLastSkipped([]);
  }, []);

  const onDisconnect = useCallback(async () => {
    try {
      const token = await getToken({ interactive: false });
      if (token) await revoke(token);
    } catch {
      // ignore — revoke is best-effort
    }
    await photosStore.clear();
    setConn({ kind: "disconnected" });
    setLastSkipped([]);
  }, []);

  const onIntervalChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const n = Number(e.target.value);
      if (!Number.isFinite(n)) return;
      const clamped = Math.max(3, Math.min(300, Math.round(n)));
      live("googlePhotos", {
        slideshowIntervalSeconds: clamped,
        displayMode,
        shuffle,
      });
    },
    [live, displayMode, shuffle],
  );

  return (
    <div
      role="tabpanel"
      id="settings-pane-googlePhotos"
      aria-labelledby="settings-tab-googlePhotos"
      className="settings-pane"
    >
      <section className="settings-section">
        <h3 className="settings-section-heading">Google Photos</h3>
        <p className="settings-hint" style={{ marginTop: 0 }}>
          Pick photos from your Google account to use as a rotating
          slideshow on the dashboard. Photos are downloaded and cached
          locally — nothing leaves your browser after the pick.
        </p>

        {conn.kind === "checking" && (
          <p className="settings-hint">Checking connection…</p>
        )}

        {conn.kind === "disconnected" && (
          <button type="button" onClick={() => void onPick()}>
            Connect Google Photos
          </button>
        )}

        {conn.kind === "connected" && (
          <div className="settings-row">
            <button type="button" onClick={() => void onPick()}>
              {photos.photos.length === 0 ? "Pick photos" : "Re-pick photos"}
            </button>
            {photos.photos.length > 0 && (
              <button type="button" onClick={() => void onClearPhotos()}>
                Clear cached photos
              </button>
            )}
            <button type="button" onClick={() => void onDisconnect()}>
              Disconnect
            </button>
          </div>
        )}

        {conn.kind === "picking" && (
          <div className="settings-row">
            <span className="settings-hint">
              {conn.pickerUri
                ? "Waiting for you to pick photos in the new tab…"
                : "Opening picker…"}
            </span>
            {conn.pickerUri && (
              <a
                href={conn.pickerUri}
                target="_blank"
                rel="noopener noreferrer"
              >
                Re-open picker
              </a>
            )}
            <button type="button" onClick={onCancelPick}>
              Cancel
            </button>
          </div>
        )}

        {conn.kind === "error" && (
          <DiagnosticsBlock
            headline={conn.message}
            diagnostics={conn.diagnostics}
            onRetry={() => void onPick()}
          />
        )}

        <dl className="settings-hint" style={{ marginTop: 16 }}>
          <dt>Cached photos</dt>
          <dd>
            {photos.photos.length} photo
            {photos.photos.length === 1 ? "" : "s"}
            {photos.lastPickedAt
              ? ` · last picked ${new Date(photos.lastPickedAt).toLocaleString()}`
              : ""}
          </dd>
        </dl>

        {lastSkipped.length > 0 && (
          <details className="settings-hint" style={{ marginTop: 8 }}>
            <summary>
              {lastSkipped.length} item
              {lastSkipped.length === 1 ? "" : "s"} skipped during last pick
            </summary>
            <ul style={{ paddingLeft: 18, marginTop: 6 }}>
              {lastSkipped.map((s, i) => (
                <li key={`${s.filename}-${i}`}>
                  <code>{s.filename}</code>: {s.reason}
                </li>
              ))}
            </ul>
          </details>
        )}

        {photos.photos.length > 0 && (
          <ThumbnailGrid photos={photos.photos} />
        )}

        {/* Always-visible diagnostics expander — the error block above is
            only shown after a failed call, but the user can also inspect the
            current runtime state on demand (e.g. before clicking Connect to
            preflight that they're in the loaded extension and not the dev
            server). */}
        <RuntimeDiagnostics />
      </section>

      <section className="settings-section">
        <h3 className="settings-section-heading">Slideshow</h3>

        <ToggleSwitch
          label="Show Photos banner on the dashboard"
          checked={pendingPhotosVisible}
          onChange={setPendingPhotosVisible}
          hint="When off, the slideshow banner above the tab bar is hidden even if you have cached photos."
        />

        <div className="settings-field">
          <label htmlFor="photos-interval" className="settings-label">
            Slide interval (seconds)
          </label>
          <input
            id="photos-interval"
            type="number"
            min={3}
            max={300}
            step={1}
            value={slideshowIntervalSeconds}
            onChange={onIntervalChange}
          />
          <span className="settings-hint">
            How long each photo is shown before fading to the next.
          </span>
        </div>

        <SegmentedControl<"crop" | "full" | "compact">
          name="settings-photos-display"
          legend="Display style"
          options={[
            { value: "crop", label: "Banner" },
            { value: "full", label: "Full" },
            { value: "compact", label: "Compact" },
          ]}
          value={displayMode}
          onChange={(v) =>
            live("googlePhotos", {
              slideshowIntervalSeconds,
              displayMode: v,
              shuffle,
            })
          }
          hint="Banner is a fixed-height strip with the image cropped to fill. Full grows the banner so the whole image is visible. Compact shows a smaller centered version with breathing room around it."
        />

        <ToggleSwitch
          label="Shuffle"
          checked={shuffle}
          onChange={(v) =>
            live("googlePhotos", {
              slideshowIntervalSeconds,
              displayMode,
              shuffle: v,
            })
          }
          hint="Randomise slide order each time the page loads."
        />
      </section>
    </div>
  );
}

/**
 * Renders an error headline plus a copy-pasteable diagnostics blob. Used in
 * the `error` connection state so the user can grab the exact runtime
 * snapshot at the moment of failure.
 */
function DiagnosticsBlock({
  headline,
  diagnostics,
  onRetry,
}: {
  headline: string;
  diagnostics: PhotosDiagnostics;
  onRetry: () => void;
}) {
  const formatted = formatDiagnostics(diagnostics);
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard write may fail in restricted contexts; the <pre> is also
      // user-selectable so the data is still retrievable manually.
    }
  }, [formatted]);
  return (
    <div className="settings-hint" role="alert" style={{ marginTop: 8 }}>
      <strong>Couldn’t reach Google Photos:</strong> {headline}
      <div className="settings-row" style={{ marginTop: 8 }}>
        <button type="button" onClick={onRetry}>
          Try again
        </button>
        <button type="button" onClick={() => void onCopy()}>
          {copied ? "Copied!" : "Copy diagnostics"}
        </button>
      </div>
      <details style={{ marginTop: 8 }}>
        <summary>Show technical details</summary>
        <pre
          style={{
            marginTop: 8,
            padding: 8,
            border: "1px solid var(--border, rgba(255,255,255,0.12))",
            borderRadius: 4,
            maxHeight: 240,
            overflow: "auto",
            fontSize: 11,
            lineHeight: 1.4,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {formatted}
        </pre>
      </details>
    </div>
  );
}

/**
 * Always-visible diagnostics expander, intended for pre-flight checks.
 * Recomputes on every open so the snapshot is fresh (e.g. after the user
 * reloads the extension to pick up a manifest edit).
 */
function RuntimeDiagnostics() {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<PhotosDiagnostics | null>(null);
  const [copied, setCopied] = useState(false);
  const refresh = useCallback(() => {
    setSnapshot(collectDiagnostics());
  }, []);
  const formatted = snapshot ? formatDiagnostics(snapshot) : "";
  const onCopy = useCallback(async () => {
    if (!formatted) return;
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — <pre> below is selectable
    }
  }, [formatted]);
  return (
    <details
      style={{ marginTop: 16 }}
      open={open}
      onToggle={(e) => {
        const isOpen = (e.currentTarget as HTMLDetailsElement).open;
        setOpen(isOpen);
        if (isOpen) refresh();
      }}
    >
      <summary className="settings-hint">Runtime diagnostics</summary>
      <p className="settings-hint" style={{ marginTop: 6 }}>
        Snapshot of <code>chrome.identity</code>, manifest permissions, and
        OAuth config at the time you opened this section. Paste it into a
        bug report if Connect is failing.
      </p>
      {snapshot && (
        <div className="settings-row">
          <button type="button" onClick={refresh}>
            Refresh
          </button>
          <button type="button" onClick={() => void onCopy()}>
            {copied ? "Copied!" : "Copy diagnostics"}
          </button>
        </div>
      )}
      {snapshot && (
        <pre
          style={{
            marginTop: 8,
            padding: 8,
            border: "1px solid var(--border, rgba(255,255,255,0.12))",
            borderRadius: 4,
            maxHeight: 240,
            overflow: "auto",
            fontSize: 11,
            lineHeight: 1.4,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {formatted}
        </pre>
      )}
    </details>
  );
}

function ThumbnailGrid({
  photos,
}: {
  photos: ReadonlyArray<{
    id: string;
    dataUrl: string;
    filename: string;
    kind?: "photo" | "video";
  }>;
}) {
  const tileStyle: React.CSSProperties = {
    width: "100%",
    aspectRatio: "1 / 1",
    objectFit: "cover",
    borderRadius: 4,
    display: "block",
    background: "rgba(0, 0, 0, 0.4)",
  };
  return (
    <div
      style={{
        marginTop: 12,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
        gap: 6,
        maxHeight: 220,
        overflowY: "auto",
      }}
    >
      {photos.map((p) =>
        p.kind === "video" ? (
          <div
            key={p.id}
            style={{ position: "relative" }}
            title={p.filename}
            aria-label={`Video: ${p.filename}`}
          >
            {/* <video> with no `controls`/`autoplay` paints its first frame
                once metadata loads — gives us a cheap poster without
                shipping a separate thumbnail asset. */}
            <video
              src={p.dataUrl}
              muted
              playsInline
              preload="metadata"
              style={tileStyle}
            />
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                right: 4,
                bottom: 4,
                fontSize: 11,
                lineHeight: 1,
                padding: "2px 5px",
                borderRadius: 3,
                // Theme-invariant dark backdrop so the Play icon stays
                // legible over any thumbnail in both light + dark themes (M7 rect).
                background: "oklch(0 0 0 / 0.55)",
                color: "var(--accent-on)",
                pointerEvents: "none",
              }}
            >
              <Play size={11} aria-hidden="true" />
            </span>
          </div>
        ) : (
          <img
            key={p.id}
            src={p.dataUrl}
            alt={p.filename}
            loading="lazy"
            style={tileStyle}
          />
        ),
      )}
    </div>
  );
}
