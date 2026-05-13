/**
 * DataPane — settings pane for data export, import, and destructive actions.
 *
 * Owns:
 *   - Export data (immediate action, no Done/Cancel lifecycle)
 *   - Import data (immediate action, closes modal on success)
 *   - Clear all data (two-step confirm, closes modal on confirm)
 *
 * Tag mutations in TagsPane also bypass Done/Cancel; same pattern applies here.
 *
 * Agent B inserts into this pane:
 *   - 'lastExportAt' recency display above the Export button — shows "Last
 *     exported: N days ago" with a warning color past 30 days. The field
 *     is written by exportData() in src/storage/exportImport.ts.
 */

import type { ReactNode } from "react";

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
}: DataPaneProps) {
  return (
    <div
      role="tabpanel"
      id="settings-pane-data"
      aria-labelledby="settings-tab-data"
      className="settings-pane"
    >
      <section className="settings-section settings-danger-zone">
        <SectionHeader>Data</SectionHeader>

        {/* Agent B: insert 'lastExportAt' recency display here (above Export button) */}
        {/* Read rs.lastExportAt; show "Last exported: N days ago" or "Never exported". */}
        {/* Apply warning styling when > 30 days since last export. */}

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
            Export downloads all your todos, sprints, Gantt charts, and
            reminders as a JSON file. Import replaces your current data.
          </span>
        )}

        <div className="settings-clear-zone">
          {clearStage === "rest" ? (
            <button
              type="button"
              className="btn-danger"
              onClick={() => setClearStage("confirm")}
            >
              Clear all data
            </button>
          ) : (
            <div className="settings-clear-confirm">
              <p>
                This will permanently delete all your todos, sprints, Gantt
                charts, and reminders. This action cannot be undone.
              </p>
              <div className="settings-clear-buttons">
                <button type="button" onClick={() => setClearStage("rest")}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={onClearConfirm}
                >
                  Delete everything
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
