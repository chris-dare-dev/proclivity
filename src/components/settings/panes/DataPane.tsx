/**
 * DataPane — settings pane for data export, import, and destructive actions.
 *
 * Owns:
 *   - Export data (immediate action, no Done/Cancel lifecycle)
 *   - Import data (immediate action, closes modal on success)
 *   - Clear local planning data (two-step confirm, closes modal on confirm)
 *
 * Tag mutations in TagsPane also bypass Done/Cancel; same pattern applies here.
 *
 * Agent B inserts into this pane:
 *   - 'lastExportAt' recency display above the Export button — shows "Last
 *     exported: N days ago" with a warning color past 30 days. The field
 *     is written by exportData() in src/storage/exportImport.ts.
 */

import { useEffect, useRef, type ReactNode } from "react";

function SectionHeader({ children }: { children: ReactNode }) {
  return <h3 className="settings-section-heading">{children}</h3>;
}

export interface DataPaneProps {
  exportFlash: boolean;
  importError: string | null;
  clearStage: "rest" | "confirm";
  setClearStage: (v: "rest" | "confirm") => void;
  onExport: () => void;
  onImportClick: () => void;
  onClearConfirm: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Epoch ms of the last successful export, or undefined if never exported. */
  lastExportAt: number | undefined;
}

/** Format "last exported" as a human-readable recency string. */
function formatLastExport(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function DataPane({
  exportFlash,
  importError,
  clearStage,
  setClearStage,
  onExport,
  onImportClick,
  onClearConfirm,
  fileInputRef,
  onFileSelected,
  lastExportAt,
}: DataPaneProps) {
  const previousClearStage = useRef(clearStage);
  const clearTriggerRef = useRef<HTMLButtonElement>(null);
  const clearCancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (previousClearStage.current === clearStage) return;
    previousClearStage.current = clearStage;
    const target =
      clearStage === "confirm" ? clearCancelRef.current : clearTriggerRef.current;
    const raf = requestAnimationFrame(() => target?.focus());
    return () => cancelAnimationFrame(raf);
  }, [clearStage]);

  const daysSinceExport =
    lastExportAt !== undefined
      ? Math.floor((Date.now() - lastExportAt) / 86_400_000)
      : null;
  return (
    <div
      role="tabpanel"
      id="settings-pane-data"
      aria-labelledby="settings-tab-data"
      className="settings-pane"
    >
      <section className="settings-section settings-danger-zone">
        <SectionHeader>Data</SectionHeader>

        <p
          className={`settings-hint${daysSinceExport !== null && daysSinceExport > 30 ? " settings-hint--warn" : ""}`}
        >
          {lastExportAt === undefined
            ? "Never exported. Export regularly to keep a backup."
            : `Last exported: ${formatLastExport(lastExportAt)}.${daysSinceExport !== null && daysSinceExport > 30 ? " Consider exporting soon." : ""}`}
        </p>

        <div className="settings-action-row">
          <button
            type="button"
            className="settings-action-btn"
            onClick={onExport}
          >
            Export data
          </button>
          <button
            type="button"
            className="settings-action-btn"
            onClick={onImportClick}
          >
            Import data
          </button>
          {exportFlash ? (
            <span className="settings-action-flash" role="status">
              Exported
            </span>
          ) : null}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: "none" }}
          onChange={onFileSelected}
        />
        {importError ? (
          <span className="settings-hint settings-hint--error" role="alert">
            {importError}
          </span>
        ) : (
          <span className="settings-hint">
            Export downloads all your todos, sprints, Gantt charts, reminders,
            and local calendar events as a JSON file. Import replaces your
            current data.
          </span>
        )}

        <div className="settings-clear-zone">
          {clearStage === "rest" ? (
            <button
              ref={clearTriggerRef}
              type="button"
              className="btn-danger"
              onClick={() => setClearStage("confirm")}
            >
              Clear local planning data
            </button>
          ) : (
            <div className="settings-clear-confirm">
              <p>
                This will permanently delete all your todos, sprints, Gantt
                charts, reminders, local calendar events, tags, saved card
                layouts, and the imported Outlook snapshot. Your preferences
                stay unchanged. This action cannot be undone.
              </p>
              <div className="settings-clear-buttons">
                <button
                  ref={clearCancelRef}
                  type="button"
                  onClick={() => setClearStage("rest")}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={onClearConfirm}
                >
                  Delete listed data
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
