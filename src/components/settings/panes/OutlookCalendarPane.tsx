import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, RefreshCw, ShieldCheck } from "lucide-react";
import { isOutlookIcsSnapshotStale } from "@/hooks/useOutlookIcsCalendar";
import { parseOutlookIcsFile } from "@/lib/outlookIcs/parser";
import { outlookIcsStore } from "@/lib/outlookIcs/store";
import type {
  OutlookIcsSnapshot,
  OutlookIcsState,
} from "@/lib/outlookIcs/types";

type PaneStatus = "checking" | "idle" | "importing" | "removing" | "error";
type ErrorAction = "checked" | "imported" | "removed";

const EMPTY_OUTLOOK_ICS_STATE: OutlookIcsState = { snapshot: null };

export function OutlookCalendarPane() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chooseFileButtonRef = useRef<HTMLButtonElement>(null);
  const [integration, setIntegration] = useState<OutlookIcsState>(
    EMPTY_OUTLOOK_ICS_STATE,
  );
  const [status, setStatus] = useState<PaneStatus>("checking");
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<ErrorAction>("imported");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let revision = 0;
    const unsubscribe = outlookIcsStore.subscribe((next) => {
      revision += 1;
      if (mounted) {
        setIntegration(next);
        setError(null);
        setStatus((current) =>
          current === "importing" || current === "removing"
            ? current
            : "idle",
        );
      }
    });
    const initialRevision = revision;
    void outlookIcsStore
      .get()
      .then((stored) => {
        if (!mounted || revision !== initialRevision) return;
        setIntegration(stored);
        setStatus("idle");
      })
      .catch((cause: unknown) => {
        if (!mounted || revision !== initialRevision) return;
        setStatus("error");
        setErrorAction("checked");
        setError(errorMessage(cause));
      });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const chooseFile = useCallback(() => {
    setError(null);
    setNotice(null);
    setStatus("idle");
    const input = fileInputRef.current;
    if (!input) return;
    input.value = "";
    input.click();
  }, []);

  const importSnapshot = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      if (!file) return;

      setStatus("importing");
      setError(null);
      setNotice(null);
      try {
        const mutationId = await outlookIcsStore.beginImport();
        const result = await parseOutlookIcsFile(file);
        const committed = await outlookIcsStore.commitImport(
          mutationId,
          result.snapshot,
        );
        if (!committed) {
          setStatus("idle");
          setNotice(
            "Import cancelled because a newer replace or remove action took precedence.",
          );
          return;
        }
        setIntegration({ snapshot: result.snapshot });
        setStatus("idle");
        setNotice(
          `Imported ${result.importedCount} Outlook event${result.importedCount === 1 ? "" : "s"}.`,
        );
      } catch (cause: unknown) {
        setStatus("error");
        setErrorAction("imported");
        setError(errorMessage(cause));
      }
    },
    [],
  );

  const removeSnapshot = useCallback(async () => {
    setStatus("removing");
    setError(null);
    setNotice(null);
    try {
      await outlookIcsStore.clear();
      setIntegration(EMPTY_OUTLOOK_ICS_STATE);
      setStatus("idle");
      setNotice("Removed the Outlook snapshot from this browser.");
      requestAnimationFrame(() => chooseFileButtonRef.current?.focus());
    } catch (cause: unknown) {
      setStatus("error");
      setErrorAction("removed");
      setError(errorMessage(cause));
    }
  }, []);

  const snapshot = integration.snapshot;
  const stale = isOutlookIcsSnapshotStale(snapshot);
  const busy =
    status === "checking" || status === "importing" || status === "removing";

  return (
    <div
      role="tabpanel"
      id="settings-pane-outlookCalendar"
      aria-labelledby="settings-tab-outlookCalendar"
      className="settings-pane"
      aria-busy={busy}
    >
      <section className="settings-section">
        <h3 className="settings-section-heading">Imported Outlook snapshot</h3>

        <div className="calendar-integration-boundary calendar-integration-boundary--outlook">
          <ShieldCheck size={18} aria-hidden="true" />
          <div>
            <strong>Local snapshot — never connected or synced</strong>
            <p>
              Proclivity reads only the .ics file you select. It does not sign
              in to Outlook, contact Microsoft or your workplace, upload the
              file, or send local Proclivity events anywhere.
            </p>
          </div>
        </div>

        <p className="settings-hint">
          Only sanitized event titles and times are kept as calendar content;
          a one-way hashed key distinguishes occurrences. Descriptions,
          locations, attendees, organizer addresses, conferencing details,
          attachments, and raw source identifiers are discarded. Private and
          confidential titles are stored as “Private work event.”
        </p>
        <p className="settings-hint">
          Importing and removing a snapshot apply immediately. The Settings
          footer only saves or cancels ordinary preference changes.
        </p>

        {status === "checking" ? (
          <p className="settings-hint" role="status">
            Checking for an imported Outlook snapshot…
          </p>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          accept=".ics,text/calendar"
          className="outlook-calendar-file-input"
          onChange={(event) => void importSnapshot(event)}
          disabled={busy}
          tabIndex={-1}
          aria-hidden="true"
        />
        <div className="settings-row outlook-calendar-actions">
          <button
            ref={chooseFileButtonRef}
            type="button"
            className="calendar-integration-action"
            onClick={chooseFile}
            disabled={busy}
          >
            {snapshot ? (
              <RefreshCw size={16} aria-hidden="true" />
            ) : (
              <CalendarDays size={16} aria-hidden="true" />
            )}
            {status === "importing"
              ? "Importing snapshot…"
              : snapshot
                ? "Replace Outlook snapshot"
                : "Choose Outlook .ics file"}
          </button>
          {snapshot ? (
            <button
              type="button"
              onClick={() => void removeSnapshot()}
              disabled={busy}
            >
              {status === "removing" ? "Removing…" : "Remove snapshot"}
            </button>
          ) : null}
        </div>

        {error ? (
          <div className="settings-hint settings-hint--error" role="alert">
            <strong>Outlook snapshot couldn’t be {errorAction}.</strong> {error}
          </div>
        ) : null}
        {notice ? (
          <p className="settings-hint settings-hint--info" role="status">
            {notice}
          </p>
        ) : null}

        {snapshot ? <SnapshotFacts snapshot={snapshot} stale={stale} /> : null}

        <div className="outlook-calendar-export">
          <h4>Export a snapshot from classic Outlook</h4>
          <ol>
            <li>Open Calendar and select the work calendar to export.</li>
            <li>
              Choose <strong>File → Save Calendar</strong>.
            </li>
            <li>
              Choose <strong>More Options</strong>, select a useful date range,
              such as six weeks back through one year ahead, then choose
              <strong> Limited details</strong> so event titles are included,
              or <strong>Availability only</strong> to keep just busy blocks.
            </li>
            <li>Save the iCalendar file, then choose that .ics file above.</li>
          </ol>
          <p className="settings-hint">
            Repeat this about once a week. Each import fully replaces the
            previous Outlook snapshot, so moved and cancelled events disappear
            from Proclivity instead of accumulating.
          </p>
        </div>
      </section>
    </div>
  );
}

function SnapshotFacts({
  snapshot,
  stale,
}: {
  snapshot: OutlookIcsSnapshot;
  stale: boolean;
}) {
  return (
    <>
      {stale ? (
        <p className="settings-hint settings-hint--warn" role="status">
          This snapshot is over 7 days old. Export a fresh .ics file when you
          next have Outlook open.
        </p>
      ) : null}
      <dl className="calendar-integration-facts outlook-calendar-facts">
        <div>
          <dt>Status</dt>
          <dd>{stale ? "Replacement recommended" : "Imported snapshot"}</dd>
        </div>
        <div>
          <dt>Events kept</dt>
          <dd>{snapshot.events.length}</dd>
        </div>
        <div>
          <dt>Imported</dt>
          <dd>{formatDateTime(snapshot.importedAt)}</dd>
        </div>
        <div>
          <dt>Display window</dt>
          <dd>{formatBounds(snapshot.windowStart, snapshot.windowEnd)}</dd>
        </div>
        <div>
          <dt>Titles redacted</dt>
          <dd>{snapshot.redactedCount}</dd>
        </div>
        <div>
          <dt>Entries skipped</dt>
          <dd>{snapshot.skippedCount}</dd>
        </div>
      </dl>
    </>
  );
}

function formatBounds(windowStart: number, windowEnd: number): string {
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${formatter.format(windowStart)} – ${formatter.format(windowEnd - 1)}`;
}

function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error
    ? cause.message
    : "The selected file could not be read.";
}
