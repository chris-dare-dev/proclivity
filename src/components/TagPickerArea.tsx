/**
 * TagPickerArea — shared tag assignment control.
 *
 * Renders the row of assigned tag chips + "[+ Add tag]" trigger button.
 * Opens an inline popover (NOT a portal) for search/create/select so the
 * Modal focus trap continues to work (CRITICAL fix #5).
 *
 * Escape handling: the popover attaches its own onKeyDown with
 * e.stopPropagation() BEFORE the event bubbles to Modal's backdrop handler,
 * so Escape closes the picker without closing the modal (CRITICAL fix #5).
 *
 * Flip behavior: after the popover opens, we measure its bottom edge via
 * getBoundingClientRect() and flip it above the trigger if it would overflow
 * the viewport.
 *
 * Empty picker state: shows "Type a name to create your first tag." hint when
 * state.tags is empty and no text has been typed (covers critique MEDIUM #23).
 *
 * Tags in filter toolbar only: see TagFilterToolbar for per-section toolbar.
 */

import {
  useRef,
  useState,
  useEffect,
  useId,
  useCallback,
  type KeyboardEvent,
} from "react";
import { TagChip } from "./TagChip";
import { DEFAULT_TAG_COLOR } from "@/storage/tags";
import type { Tag } from "@/types";
import "./TagPickerArea.css";

interface TagPickerAreaProps {
  /** All global tags (from state.tags). */
  allTags: Tag[];
  /** Ids of tags currently assigned to this item. */
  assignedTagIds: string[];
  /** Called when a tag is toggled on/off for this item. */
  onToggle: (tagId: string) => void;
  /**
   * Called when the user creates a new tag (types a name, presses Enter or
   * clicks "+ Create"). Returns the new tag so it can be added immediately.
   */
  onCreate: (label: string, color: string) => Promise<Tag>;
}

export function TagPickerArea({
  allTags,
  assignedTagIds,
  onToggle,
  onCreate,
}: TagPickerAreaProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIdx, setHighlightedIdx] = useState<number>(-1);
  const [flipped, setFlipped] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  // Resolve assigned tags from allTags — skip orphan ids silently
  const assignedTags = assignedTagIds
    .map((id) => allTags.find((t) => t.id === id))
    .filter((t): t is Tag => t !== undefined);

  // Filter allTags by query for the picker list
  const filteredTags = allTags.filter((t) =>
    t.label.toLowerCase().includes(query.toLowerCase()),
  );

  // Whether the "+ Create" row should show (no exact match)
  const exactMatch = allTags.some(
    (t) => t.label.toLowerCase() === query.toLowerCase().trim(),
  );
  const showCreate = query.trim().length > 0 && !exactMatch;

  // Total items in the navigable list (filtered tags + optional create row)
  const listLength = filteredTags.length + (showCreate ? 1 : 0);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHighlightedIdx(-1);
    setFlipped(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  // Open handler: set open state then measure for flip
  const openPicker = () => {
    setOpen(true);
    setQuery("");
    setHighlightedIdx(-1);
  };

  // After open, focus the search input and check if we should flip
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();

    // Measure popover position after paint
    const raf = requestAnimationFrame(() => {
      const pop = popoverRef.current;
      if (!pop) return;
      const rect = pop.getBoundingClientRect();
      if (rect.bottom > window.innerHeight - 16) {
        setFlipped(true);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Close on outside click (document-level mousedown — matches headless-ui pattern)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const trigger = triggerRef.current;
      const popover = popoverRef.current;
      if (!trigger || !popover) return;
      if (!trigger.contains(e.target as Node) && !popover.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  // Popover keyboard handler — Escape captured here, NOT bubbled to Modal
  const handlePopoverKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      // stopPropagation prevents Modal's backdrop onKeyDown from also firing
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.min(i + 1, listLength - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.max(i - 1, -1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      // highlightedIdx -1 means nothing highlighted, attempt inline create
      if (highlightedIdx === -1 || highlightedIdx === filteredTags.length) {
        // Create row or bare Enter with typed text
        if (showCreate) {
          void handleCreate();
        } else if (highlightedIdx >= 0 && highlightedIdx < filteredTags.length) {
          const tag = filteredTags[highlightedIdx];
          if (tag) onToggle(tag.id);
        }
      } else {
        const tag = filteredTags[highlightedIdx];
        if (tag) onToggle(tag.id);
      }
      return;
    }
  };

  const handleCreate = async () => {
    const label = query.trim();
    if (!label) return;
    const newTag = await onCreate(label, DEFAULT_TAG_COLOR);
    onToggle(newTag.id);
    setQuery("");
    setHighlightedIdx(-1);
  };

  return (
    <div className="tag-picker-area">
      {/* Assigned chips with remove buttons */}
      <div className="tag-picker-chips">
        {assignedTags.map((tag) => (
          <TagChip
            key={tag.id}
            label={tag.label}
            color={tag.color}
            onRemove={() => onToggle(tag.id)}
          />
        ))}
        <button
          ref={triggerRef}
          type="button"
          className="tag-picker-trigger"
          onClick={openPicker}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
        >
          + Add tag
        </button>
      </div>

      {/* Inline popover — NOT a portal so Modal focus trap includes it */}
      {open && (
        <div
          ref={popoverRef}
          className={`tag-picker-popover${flipped ? " tag-picker-popover--flipped" : ""}`}
          onKeyDown={handlePopoverKeyDown}
          // Prevent click inside picker from bubbling to backdrop close
          onMouseDown={(e) => e.stopPropagation()}
        >
          <input
            ref={inputRef}
            type="text"
            className="tag-picker-search"
            placeholder="Search or create tag…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlightedIdx(-1);
            }}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={true}
            aria-haspopup="listbox"
            aria-controls={listId}
            aria-activedescendant={
              highlightedIdx >= 0 ? `${listId}-item-${highlightedIdx}` : undefined
            }
          />
          <ul
            className="tag-picker-list"
            role="listbox"
            id={listId}
            aria-label="Available tags"
          >
            {filteredTags.length === 0 && !showCreate && (
              <li className="tag-picker-empty">
                {allTags.length === 0
                  ? "Type a name to create your first tag."
                  : "No tags match. Type to create one."}
              </li>
            )}
            {filteredTags.map((tag, idx) => {
              const selected = assignedTagIds.includes(tag.id);
              const highlighted = idx === highlightedIdx;
              return (
                <li
                  key={tag.id}
                  id={`${listId}-item-${idx}`}
                  className={`tag-picker-item${highlighted ? " is-highlighted" : ""}`}
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(e) => {
                    e.preventDefault(); // don't steal focus from search input
                    onToggle(tag.id);
                  }}
                  onMouseEnter={() => setHighlightedIdx(idx)}
                >
                  <span
                    className="tag-picker-item-swatch"
                    style={{ background: tag.color }}
                    aria-hidden="true"
                  />
                  <span className="tag-picker-item-label">{tag.label}</span>
                  {selected && (
                    <span className="tag-picker-item-check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </li>
              );
            })}
            {showCreate && (
              <li
                id={`${listId}-item-${filteredTags.length}`}
                className={`tag-picker-create${highlightedIdx === filteredTags.length ? " is-highlighted" : ""}`}
                role="option"
                aria-selected={false}
                onMouseDown={(e) => {
                  e.preventDefault();
                  void handleCreate();
                }}
                onMouseEnter={() => setHighlightedIdx(filteredTags.length)}
              >
                + Create &ldquo;{query.trim()}&rdquo;
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
