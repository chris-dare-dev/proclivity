import { memo } from "react";
import type { DayItems, MonthGridCell } from "./calendarUtils";
import type { Tag } from "@/types";

/** Max visible chips on desktop. A "+N more" chip appears for any overflow. */
const MAX_CHIPS_DESKTOP = 3;
/** Max visible chips on mobile (≤720px) — enforced via the `data-mobile` CSS class. */
const MAX_CHIPS_MOBILE = 2;

interface DayCellProps {
  cell: MonthGridCell;
  items: DayItems;
  tagById: Map<string, Tag>;
  /** Lane count for this cell's week-row — set as `data-lanes` so CSS can
   *  apply the correct padding-top without a CSS-variable scoping issue. */
  lanes: number;
  compact: boolean;
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
}: DayCellProps) {
  const dayNum = new Date(cell.ts).getDate();

  // Merge all item types into one ordered list for cap/overflow logic.
  type ChipItem =
    | { kind: "reminder"; id: string; title: string; done: boolean; tags: string[] }
    | { kind: "today"; id: string; title: string; done: boolean; tags: string[] }
    | { kind: "long"; id: string; title: string; done: boolean; tags: string[] };

  const allChips: ChipItem[] = [
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
      aria-label={new Date(cell.ts).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })}
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
        {visibleChips.map((chip) => {
          if (chip.kind === "reminder") {
            return (
              <li
                key={`r-${chip.id}-${cell.ts}`}
                className="calendar-chip calendar-chip--reminder"
                title={`Reminder: ${chip.title}`}
              >
                {/* H6: glyph inside dot so color-blind users have a shape cue */}
                <span className="calendar-chip__dot" aria-hidden="true">R</span>
                <span className="calendar-chip__label">{chip.title}</span>
                <TagSwatches ids={chip.tags} tagById={tagById} />
              </li>
            );
          }
          if (chip.kind === "today") {
            return (
              <li
                key={`t-${chip.id}`}
                className={`calendar-chip calendar-chip--today${chip.done ? " is-done" : ""}`}
                title={`Today: ${chip.title}`}
              >
                <span className="calendar-chip__dot" aria-hidden="true">T</span>
                <span className="calendar-chip__label">{chip.title}</span>
                <TagSwatches ids={chip.tags} tagById={tagById} />
              </li>
            );
          }
          // kind === "long"
          return (
            <li
              key={`l-${chip.id}`}
              className="calendar-chip calendar-chip--long"
              title={`Long-term due: ${chip.title}`}
            >
              <span className="calendar-chip__dot" aria-hidden="true">L</span>
              <span className="calendar-chip__label">{chip.title}</span>
              <TagSwatches ids={chip.tags} tagById={tagById} />
            </li>
          );
        })}
        {remaining > 0 && (
          <li className="calendar-chip calendar-chip--more">
            +{remaining} more
          </li>
        )}
      </ul>
    </div>
  );
});

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
