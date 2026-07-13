import { memo } from "react";
import type { DayItems, MonthGridCell } from "./calendarUtils";
import type { Tag, TimeFormat } from "@/types";
import { startOfDay } from "@/lib/dateUtils";
import { Modal } from "@/components/Modal";

/** Max visible chips on desktop. A "+N more" chip appears for any overflow. */
const MAX_CHIPS_DESKTOP = 3;
/** Max visible chips on mobile (≤720px) — enforced via the `data-mobile` CSS class. */
const MAX_CHIPS_MOBILE = 2;

export type CalendarChipItem =
  | {
      kind: "google";
      id: string;
      title: string;
      label: string;
      htmlLink?: string | undefined;
    }
  | { kind: "reminder"; id: string; title: string; done: boolean; tags: string[] }
  | { kind: "today"; id: string; title: string; done: boolean; tags: string[] }
  | { kind: "long"; id: string; title: string; done: boolean; tags: string[] };

export interface CalendarDayDetails {
  cellTs: number;
  dateLabel: string;
  chips: CalendarChipItem[];
}

interface DayCellProps {
  cell: MonthGridCell;
  items: DayItems;
  tagById: Map<string, Tag>;
  /** Lane count for this cell's week-row — set as `data-lanes` so CSS can
   *  apply the correct padding-top without a CSS-variable scoping issue. */
  lanes: number;
  compact: boolean;
  timeFormat: TimeFormat;
  detailsOpen: boolean;
  onOpenDetails: (
    details: CalendarDayDetails,
    trigger: HTMLButtonElement,
  ) => void;
}

/**
 * One day square in the month grid. Renders the day number plus any
 * reminders / long-term-due / today-scope todos that the parent's
 * indexer assigned to this cell. Sprint bars overlay this cell from
 * outside — DayCell intentionally doesn't know about them.
 *
 * Memoized because re-rendering a single cell is essentially free and
 * shallow-equality on `cell` / `items` keeps tab-switch churn quiet.
 */
export const DayCell = memo(function DayCell({
  cell,
  items,
  tagById,
  lanes,
  compact,
  timeFormat,
  detailsOpen,
  onOpenDetails,
}: DayCellProps) {
  const dayNum = new Date(cell.ts).getDate();
  const dateLabel = new Date(cell.ts).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Merge all item types into one ordered list for cap/overflow logic.
  const googleChips: CalendarChipItem[] = items.googleEvents.map((event) => ({
    kind: "google" as const,
    id: event.id,
    title: event.title,
    label: googleEventLabel(event, cell.ts, timeFormat),
    ...(event.htmlLink ? { htmlLink: event.htmlLink } : {}),
  }));
  const localChips: CalendarChipItem[] = [
    ...items.reminders.map((r) => ({
      kind: "reminder" as const,
      id: r.id,
      title: r.title,
      done: false,
      tags: r.tags,
    })),
    ...items.todayTodos.map((t) => ({
      kind: "today" as const,
      id: t.id,
      title: t.title,
      done: t.done,
      tags: t.tags,
    })),
    ...items.longTermDue.map((t) => ({
      kind: "long" as const,
      id: t.id,
      title: t.title,
      done: false, // M6: completed long-term todos are filtered in indexDayItems
      tags: t.tags,
    })),
  ];
  // Keep one Google event prominent without allowing a meeting-heavy day to
  // push every local reminder/todo behind the compact-cell cap.
  const allChips: CalendarChipItem[] = googleChips.length
    ? [googleChips[0]!, ...localChips, ...googleChips.slice(1)]
    : localChips;

  const totalItems = allChips.length;
  const cap = compact ? MAX_CHIPS_MOBILE : MAX_CHIPS_DESKTOP;
  const visibleChips = allChips.slice(0, cap);
  const remaining = totalItems - cap;

  return (
    <div
      className={[
        "calendar-cell",
        cell.inMonth ? "" : "calendar-cell--out",
        cell.isToday ? "calendar-cell--today" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="group"
      aria-label={dateLabel}
      data-lanes={lanes > 0 ? lanes : undefined}
    >
      <div className="calendar-cell__head">
        <span className="calendar-cell__date">{dayNum}</span>
        {cell.isToday ? (
          <span className="calendar-cell__today-pill" aria-hidden="true">
            Today
          </span>
        ) : null}
      </div>

      <ul className="calendar-cell__items">
        {visibleChips.map((chip) => (
          <CalendarChip
            key={`${chip.kind}-${chip.id}-${cell.ts}`}
            chip={chip}
            dateLabel={dateLabel}
            tagById={tagById}
          />
        ))}
        {remaining > 0 && (
          <li className="calendar-chip calendar-chip--more">
            <button
              type="button"
              className="calendar-chip__more-button"
              onClick={(event) =>
                onOpenDetails(
                  {
                    cellTs: cell.ts,
                    dateLabel,
                    chips: allChips,
                  },
                  event.currentTarget,
                )
              }
              aria-haspopup="dialog"
              aria-expanded={detailsOpen}
              aria-controls={`calendar-day-details-${cell.ts}`}
            >
              +{remaining} more
            </button>
          </li>
        )}
      </ul>
    </div>
  );
});

/** One grid-level modal preserves focus restoration without 42 modal portals. */
export function CalendarDayDetailsModal({
  details,
  tagById,
  returnFocusTo,
  onClose,
}: {
  details: CalendarDayDetails | null;
  tagById: Map<string, Tag>;
  returnFocusTo: HTMLElement | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={details !== null}
      onClose={onClose}
      title={details ? `Schedule for ${details.dateLabel}` : "Day schedule"}
      returnFocusTo={returnFocusTo}
      panelClassName="calendar-day-details-modal"
    >
      <div
        className="calendar-day-details"
        id={details ? `calendar-day-details-${details.cellTs}` : undefined}
      >
        <ul className="calendar-day-details__items">
          {details?.chips.map((chip) => (
            <CalendarChip
              key={`details-${chip.kind}-${chip.id}-${details.cellTs}`}
              chip={chip}
              dateLabel={details.dateLabel}
              tagById={tagById}
            />
          ))}
        </ul>
        <div className="modal-footer">
          <button type="button" onClick={onClose} autoFocus>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CalendarChip({
  chip,
  dateLabel,
  tagById,
}: {
  chip: CalendarChipItem;
  dateLabel: string;
  tagById: Map<string, Tag>;
}) {
  if (chip.kind === "google") {
    const content = (
      <>
        <span className="calendar-chip__dot" aria-hidden="true">G</span>
        <span className="calendar-chip__label">{chip.label}</span>
      </>
    );
    return (
      <li
        className="calendar-chip calendar-chip--google"
        title={`Google Calendar: ${chip.title}`}
      >
        {chip.htmlLink ? (
          <a
            className="calendar-chip__link"
            href={chip.htmlLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${chip.label}, ${dateLabel} — open in Google Calendar`}
          >
            {content}
          </a>
        ) : content}
      </li>
    );
  }
  if (chip.kind === "reminder") {
    return (
      <li
        className="calendar-chip calendar-chip--reminder"
        title={`Reminder: ${chip.title}`}
      >
        <span className="calendar-chip__dot" aria-hidden="true">R</span>
        <span className="calendar-chip__label">{chip.title}</span>
        <TagSwatches ids={chip.tags} tagById={tagById} />
      </li>
    );
  }
  if (chip.kind === "today") {
    return (
      <li
        className={`calendar-chip calendar-chip--today${chip.done ? " is-done" : ""}`}
        title={`Today: ${chip.title}`}
      >
        <span className="calendar-chip__dot" aria-hidden="true">T</span>
        <span className="calendar-chip__label">{chip.title}</span>
        <TagSwatches ids={chip.tags} tagById={tagById} />
      </li>
    );
  }
  return (
    <li
      className="calendar-chip calendar-chip--long"
      title={`Long-term due: ${chip.title}`}
    >
      <span className="calendar-chip__dot" aria-hidden="true">L</span>
      <span className="calendar-chip__label">{chip.title}</span>
      <TagSwatches ids={chip.tags} tagById={tagById} />
    </li>
  );
}

function googleEventLabel(
  event: DayItems["googleEvents"][number],
  cellTs: number,
  timeFormat: TimeFormat,
): string {
  if (event.allDay) return event.title;
  if (startOfDay(event.start) !== cellTs) return `Continues · ${event.title}`;
  const options: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    ...(timeFormat === "auto" ? {} : { hour12: timeFormat === "12h" }),
  };
  return `${new Intl.DateTimeFormat(undefined, options).format(event.start)} · ${event.title}`;
}

// Exported so mobile-breakpoint CSS knows the mobile cap value.
export const MOBILE_CHIP_CAP = MAX_CHIPS_MOBILE;

function TagSwatches({
  ids,
  tagById,
}: {
  ids: string[];
  tagById: Map<string, Tag>;
}) {
  if (ids.length === 0) return null;
  return (
    <span className="calendar-chip__tags" aria-hidden="true">
      {ids.slice(0, 3).map((id) => {
        const tag = tagById.get(id);
        if (!tag) return null;
        return (
          <span
            key={id}
            className="calendar-chip__tag"
            style={{ background: tag.color }}
          />
        );
      })}
    </span>
  );
}
