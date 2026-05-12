/**
 * TagFilterToolbar — per-section tag filter row.
 *
 * Renders only when the section has at least one tag present on its items
 * (callers pass `availableTags` filtered to the section's items).
 * Filter state is owned by the section manager component, not here; this
 * component is pure display + callbacks.
 *
 * Accessibility:
 * - role="toolbar" on the container with aria-label
 * - Each chip is a <button aria-pressed> toggle (NOT radio — multi-select)
 * - role="status" aria-live="polite" for "Showing N of M" (LOW fix #31:
 *   role="status" already implies polite, so aria-live is omitted here)
 * - Status text announced via debounced state update (300ms) to avoid
 *   rapid announcements on quick toggling
 *
 * NOT using opacity:0.55 at rest (critique HIGH #15 / WCAG 1.4.3) —
 * uses .is-inactive CSS class with dim text tokens instead.
 *
 * Chip border stays 1px always; box-shadow inset is used for "selected" visual
 * (critique LOW #32 — avoids reflow from 1px→2px border change).
 */

import { useEffect, useRef, useState } from "react";
import type { Tag } from "@/types";
import { TagChip } from "./TagChip";
import "./TagFilterToolbar.css";

interface TagFilterToolbarProps {
  /** Tags that appear on at least one item in this section. */
  availableTags: Tag[];
  /** Currently active filter tag ids. */
  activeTagIds: string[];
  /** Total item count before filtering. */
  totalCount: number;
  /** Filtered item count. */
  filteredCount: number;
  onToggle: (tagId: string) => void;
  onClearAll: () => void;
}

export function TagFilterToolbar({
  availableTags,
  activeTagIds,
  totalCount,
  filteredCount,
  onToggle,
  onClearAll,
}: TagFilterToolbarProps) {
  // Don't render toolbar if there are no tags in this section
  if (availableTags.length === 0) return null;

  const isActive = activeTagIds.length > 0;

  return (
    <div className={`tag-filter-toolbar${isActive ? " is-active" : " is-inactive"}`}>
      <div
        role="toolbar"
        aria-label="Filter by tag"
        className="tag-filter-chips"
      >
        {availableTags.map((tag) => {
          const selected = activeTagIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              className={`tag-filter-chip${selected ? " is-selected" : ""}`}
              style={
                selected
                  ? ({ "--chip-color": tag.color } as React.CSSProperties)
                  : undefined
              }
              aria-pressed={selected}
              aria-label={`Filter by ${tag.label}`}
              onClick={() => onToggle(tag.id)}
            >
              <TagChip label={tag.label} color={tag.color} />
            </button>
          );
        })}
        {isActive && (
          <button
            type="button"
            className="tag-filter-clear"
            onClick={onClearAll}
            aria-label="Clear all tag filters"
          >
            Clear
          </button>
        )}
      </div>
      {isActive && (
        <FilterStatus
          filteredCount={filteredCount}
          totalCount={totalCount}
          activeCount={activeTagIds.length}
        />
      )}
    </div>
  );
}

/** Debounced status announcement so rapid toggle clicks don't spam screen readers. */
function FilterStatus({
  filteredCount,
  totalCount,
  activeCount,
}: {
  filteredCount: number;
  totalCount: number;
  activeCount: number;
}) {
  const [announced, setAnnounced] = useState({ filteredCount, totalCount, activeCount });
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setAnnounced({ filteredCount, totalCount, activeCount });
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [filteredCount, totalCount, activeCount]);

  const suffix = announced.activeCount > 1 ? " — matches any selected tag" : "";
  return (
    <div role="status" className="tag-filter-status">
      Showing {announced.filteredCount} of {announced.totalCount} items{suffix}
    </div>
  );
}
