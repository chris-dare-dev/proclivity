/**
 * RemindersCardSection — lazy-loaded reminder render for both list and card modes.
 *
 * Handles both card mode and list mode so the entire reminders task render is
 * behind a lazy boundary. RemindersManager only renders the add-form and this
 * lazy boundary; no card/list branching logic in the hot path.
 *
 * Loaded only on first render of the reminders section.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"; // useEffect used for H1 fix and RelativeTime
import type { Reminder, Tag, CardLayoutMap, CardPosition } from "@/types";
import type { ProclivityState } from "@/types";
import { TagFilterToolbar } from "@/components/TagFilterToolbar";
import { TagChip } from "@/components/TagChip";
import { filterByTags } from "@/storage/tags";
import {
  setCardPositionToFront,
  resetCardPositions,
  computeCascadeLayout,
  CASCADE_CARD_H,
} from "@/storage/cardLayouts";
import { CardCanvas } from "@/components/card/CardCanvas";
import { DraggableCard } from "@/components/card/DraggableCard";
import { formatFireAt, relativeTime } from "./reminderUtils";

/* ─── Inline RelativeTime (no state leak from parent) ──────────── */

function RelativeTime({ fireAt }: { fireAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const absolute = formatFireAt(fireAt);
  return <span title={absolute}>{relativeTime(fireAt, now)}</span>;
}

interface Props {
  layoutMode: "list" | "card";
  upcoming: Reminder[];
  fired: Reminder[];
  allTags: Tag[];
  effectiveActiveTagIds: string[];
  availableTags: Tag[];
  todoMap: Map<string, string>;
  cardLayouts: CardLayoutMap | undefined;
  cardHintSeen: boolean;
  onDelete: (id: string) => Promise<void>;
  onEdit: (id: string) => void;
  onToggleFilter: (tagId: string) => void;
  onClearFilter: () => void;
  onDismissHint: () => void;
  update: (fn: (s: ProclivityState) => ProclivityState) => Promise<void>;
}

export function RemindersCardSection({
  layoutMode,
  upcoming,
  fired,
  allTags,
  effectiveActiveTagIds,
  availableTags,
  todoMap,
  cardLayouts,
  cardHintSeen,
  onDelete,
  onEdit,
  onToggleFilter,
  onClearFilter,
  onDismissHint,
  update,
}: Props) {
  const allReminders = useMemo(() => [...upcoming, ...fired], [upcoming, fired]);

  const filteredUpcoming = useMemo(
    () => filterByTags(upcoming, effectiveActiveTagIds),
    [upcoming, effectiveActiveTagIds],
  );

  const filteredFired = useMemo(
    () => filterByTags(fired, effectiveActiveTagIds),
    [fired, effectiveActiveTagIds],
  );

  const isFiltered = effectiveActiveTagIds.length > 0;

  // ── List mode ───────────────────────────────────────────────────
  if (layoutMode === "list") {
    return (
      <>
        <TagFilterToolbar
          availableTags={availableTags}
          activeTagIds={effectiveActiveTagIds}
          totalCount={allReminders.length}
          filteredCount={filteredUpcoming.length + filteredFired.length}
          onToggle={onToggleFilter}
          onClearAll={onClearFilter}
        />

        {/* Upcoming */}
        <div className="reminders-section">
          <div className="reminders-section-heading">
            Upcoming ({filteredUpcoming.length})
          </div>
          {filteredUpcoming.length === 0 ? (
            <div className="section-empty">
              {isFiltered ? (
                <>
                  No upcoming reminders match the selected tags.{" "}
                  <button
                    type="button"
                    className="inline-clear-link"
                    onClick={onClearFilter}
                  >
                    Clear the filter
                  </button>
                </>
              ) : (
                "No upcoming reminders."
              )}
            </div>
          ) : (
            filteredUpcoming.map((r) => (
              <ReminderListItem
                key={r.id}
                reminder={r}
                linkedTodoTitle={r.linkedTodoId ? todoMap.get(r.linkedTodoId) : undefined}
                allTags={allTags}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            ))
          )}
        </div>

        {/* Fired */}
        {fired.length > 0 && (
          <div className="reminders-section">
            <div className="reminders-section-heading">
              Fired ({filteredFired.length})
            </div>
            {filteredFired.length === 0 ? (
              <div className="section-empty">
                No fired reminders match the selected tags.
              </div>
            ) : (
              filteredFired.map((r) => (
                <ReminderListItem
                  key={r.id}
                  reminder={r}
                  linkedTodoTitle={r.linkedTodoId ? todoMap.get(r.linkedTodoId) : undefined}
                  allTags={allTags}
                  onDelete={onDelete}
                  onEdit={onEdit}
                />
              ))
            )}
          </div>
        )}
      </>
    );
  }

  // ── Card mode ────────────────────────────────────────────────────
  return (
    <ReminderCardCanvas
      allReminders={allReminders}
      filteredUpcoming={filteredUpcoming}
      filteredFired={filteredFired}
      allTags={allTags}
      effectiveActiveTagIds={effectiveActiveTagIds}
      availableTags={availableTags}
      todoMap={todoMap}
      cardLayouts={cardLayouts}
      cardHintSeen={cardHintSeen}
      onDelete={onDelete}
      onEdit={onEdit}
      onToggleFilter={onToggleFilter}
      onClearFilter={onClearFilter}
      onDismissHint={onDismissHint}
      update={update}
    />
  );
}

/* ─── List-mode reminder item (inline, same shape as RemindersManager.ReminderItem) */

interface ReminderListItemProps {
  reminder: Reminder;
  linkedTodoTitle?: string | undefined;
  allTags: Tag[];
  onDelete: (id: string) => Promise<void>;
  onEdit: (id: string) => void;
}

function ReminderListItem({
  reminder,
  linkedTodoTitle,
  allTags,
  onDelete,
  onEdit,
}: ReminderListItemProps) {
  const absolute = formatFireAt(reminder.fireAt);
  const recLabel =
    reminder.recurrence && reminder.recurrence !== "none"
      ? reminder.recurrence
      : null;
  const tags = reminder.tags
    .map((id) => allTags.find((t) => t.id === id))
    .filter((t): t is Tag => t !== undefined);

  return (
    <div className={`reminder-item ${reminder.fired ? "fired" : ""}`}>
      <div className="reminder-item-body">
        <div className="reminder-item-title">{reminder.title}</div>
        <div className="reminder-item-meta">
          <RelativeTime fireAt={reminder.fireAt} />
          <span>·</span>
          <span>{absolute}</span>
          {recLabel && <span className="reminder-badge">{recLabel}</span>}
          {reminder.fired && <span className="reminder-badge fired">fired</span>}
          {linkedTodoTitle && (
            <span className="reminder-linked-todo">→ {linkedTodoTitle}</span>
          )}
          {tags.map((tag) => (
            <TagChip key={tag.id} label={tag.label} color={tag.color} />
          ))}
        </div>
      </div>
      <div className="reminder-item-actions">
        <button
          className="reminder-edit"
          aria-label={`Edit reminder: ${reminder.title}`}
          onClick={() => onEdit(reminder.id)}
        >
          ✎
        </button>
        <button
          className="btn-danger"
          aria-label={`Delete reminder: ${reminder.title}`}
          onClick={() => void onDelete(reminder.id)}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

/* ─── Card-mode canvas ──────────────────────────────────────────── */

interface CardCanvasProps {
  allReminders: Reminder[];
  filteredUpcoming: Reminder[];
  filteredFired: Reminder[];
  allTags: Tag[];
  effectiveActiveTagIds: string[];
  availableTags: Tag[];
  todoMap: Map<string, string>;
  cardLayouts: CardLayoutMap | undefined;
  cardHintSeen: boolean;
  onDelete: (id: string) => Promise<void>;
  onEdit: (id: string) => void;
  onToggleFilter: (tagId: string) => void;
  onClearFilter: () => void;
  onDismissHint: () => void;
  update: (fn: (s: ProclivityState) => ProclivityState) => Promise<void>;
}

function ReminderCardCanvas({
  allReminders,
  filteredUpcoming,
  filteredFired,
  allTags,
  effectiveActiveTagIds,
  availableTags,
  todoMap,
  cardLayouts,
  cardHintSeen,
  onDelete,
  onEdit,
  onToggleFilter,
  onClearFilter,
  onDismissHint,
  update,
}: CardCanvasProps) {
  // H1 fix: canvas ref for width measurement; initial positions seeded synchronously.
  const canvasElRef = useRef<HTMLDivElement | null>(null);

  const computeInitialPositions = useCallback((): Record<string, CardPosition> => {
    const unsaved = allReminders.filter((r) => !cardLayouts?.[r.id]);
    if (!unsaved.length) return {};
    const canvasWidth = canvasElRef.current?.offsetWidth ?? 800;
    const cascade = computeCascadeLayout(unsaved.map((r) => r.id), canvasWidth);
    const CARD_ROW_H = CASCADE_CARD_H + 16;
    let offsetY = 0;
    for (const r of allReminders) {
      const pos = cardLayouts?.[r.id];
      if (pos) offsetY = Math.max(offsetY, pos.y + CARD_ROW_H);
    }
    if (offsetY > 0) {
      for (const id of Object.keys(cascade)) {
        const entry = cascade[id];
        if (entry) entry.y += offsetY;
      }
    }
    return cascade;
  }, [allReminders, cardLayouts]);

  // Pre-seed localPositions so the first paint never shows cards at (0,0).
  const [localPositions, setLocalPositions] = useState<Record<string, CardPosition>>(
    () => computeInitialPositions(),
  );
  // D7/L2: hint shown until cardHintSeen is persisted (per-extension, not per-tab).

  // Persist to storage after paint (H1 fix: async after sync seed).
  useEffect(() => {
    const unsaved = allReminders.filter((r) => !cardLayouts?.[r.id]);
    if (!unsaved.length) return;
    const cascade = computeInitialPositions();
    if (!Object.keys(cascade).length) return;
    void update((s) => ({
      ...s,
      cardLayouts: { ...(s.cardLayouts ?? {}), ...cascade },
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allReminders.map((r) => r.id).join(","), cardLayouts === undefined ? "undef" : "def"]);

  // All visible filtered reminder ids
  const filteredIds = useMemo(
    () => new Set([...filteredUpcoming.map((r) => r.id), ...filteredFired.map((r) => r.id)]),
    [filteredUpcoming, filteredFired],
  );

  const getPosition = useCallback(
    (id: string): CardPosition =>
      localPositions[id] ?? cardLayouts?.[id] ?? { x: 0, y: 0, z: 0 },
    [localPositions, cardLayouts],
  );

  const canvasMinHeight = useMemo(() => {
    let maxY = 400;
    for (const r of allReminders) {
      const pos = localPositions[r.id] ?? cardLayouts?.[r.id];
      if (pos) maxY = Math.max(maxY, pos.y + 180);
    }
    return maxY;
  }, [allReminders, localPositions, cardLayouts]);

  const handlePositionChange = useCallback((id: string, pos: CardPosition) => {
    setLocalPositions((prev) => ({ ...prev, [id]: pos }));
  }, []);

  // C2 fix: z-bump computed atomically inside the updater — no stale closure.
  const handleDragEnd = useCallback(
    async (id: string, pos: CardPosition) => {
      await update(setCardPositionToFront(id, { x: pos.x, y: pos.y }));
    },
    [update],
  );

  const handleResetLayout = useCallback(async () => {
    const ids = allReminders.map((r) => r.id);
    setLocalPositions({});
    await update(resetCardPositions(ids));
  }, [allReminders, update]);

  const renderCard = (r: Reminder) => {
    const isFilteredOut =
      effectiveActiveTagIds.length > 0 && !filteredIds.has(r.id);
    const resolvedTags = r.tags
      .map((id) => allTags.find((tag) => tag.id === id))
      .filter((tag): tag is Tag => tag !== undefined);
    const recLabel =
      r.recurrence && r.recurrence !== "none" ? r.recurrence : null;
    const linkedTodoTitle = r.linkedTodoId ? todoMap.get(r.linkedTodoId) : undefined;

    return (
      <DraggableCard
        key={r.id}
        itemId={r.id}
        position={getPosition(r.id)}
        onPositionChange={handlePositionChange}
        onDragEnd={handleDragEnd}
        filteredOut={isFilteredOut}
      >
        <div className={`task-card${r.fired ? " is-done" : ""}`} data-item-id={r.id}>
          <div className="task-card-header">
            <span className="task-card-title">{r.title}</span>
            <button
              className="task-card-edit"
              onClick={(e) => { e.stopPropagation(); onEdit(r.id); }}
              aria-label={`Edit: ${r.title}`}
              tabIndex={0}
            >
              ✎
            </button>
          </div>
          <p className="task-card-fireat">
            <RelativeTime fireAt={r.fireAt} />
            {recLabel && <span className="reminder-badge">{recLabel}</span>}
            {r.fired && <span className="reminder-badge fired">fired</span>}
          </p>
          {linkedTodoTitle && (
            <p className="task-card-notes" title={linkedTodoTitle}>
              → {linkedTodoTitle}
            </p>
          )}
          {resolvedTags.length > 0 && (
            <div className="task-card-tags">
              {resolvedTags.slice(0, 3).map((tag) => (
                <TagChip key={tag.id} label={tag.label} color={tag.color} />
              ))}
              {resolvedTags.length > 3 && (
                <span className="task-card-tags-overflow">+{resolvedTags.length - 3}</span>
              )}
            </div>
          )}
          <button
            className="task-card-delete"
            onClick={(e) => { e.stopPropagation(); void onDelete(r.id); }}
            aria-label={`Delete: ${r.title}`}
            tabIndex={0}
          >
            ✕
          </button>
        </div>
      </DraggableCard>
    );
  };

  return (
    <>
      <div className="card-toolbar-row">
        <TagFilterToolbar
          availableTags={availableTags}
          activeTagIds={effectiveActiveTagIds}
          totalCount={allReminders.length}
          filteredCount={filteredUpcoming.length + filteredFired.length}
          onToggle={onToggleFilter}
          onClearAll={onClearFilter}
        />
        <button
          type="button"
          className="card-reset-btn"
          onClick={() => void handleResetLayout()}
          title="Reset card positions to default"
        >
          ↺ Reset layout
        </button>
      </div>

      <CardCanvas ariaLabel="Reminders canvas">
        {/* Canvas width measurement ref */}
        <div
          ref={(el) => {
            canvasElRef.current = el?.parentElement as HTMLDivElement | null;
          }}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        />
        <div style={{ height: canvasMinHeight, pointerEvents: "none" }} />

        {allReminders.length === 0 ? (
          <div
            className="section-empty"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              whiteSpace: "nowrap",
            }}
          >
            No reminders yet. Add one above.
          </div>
        ) : (
          allReminders.map(renderCard)
        )}

        {!cardHintSeen && allReminders.length > 0 && (
          <div className="card-onboarding-hint">
            Drag cards to rearrange. They snap to a grid.
            <button type="button" onClick={onDismissHint}>
              Got it
            </button>
          </div>
        )}
      </CardCanvas>

      {/* Narrow-viewport fallback list (shown at <600px via CSS) */}
      <ul className="todo-list card-fallback-list">
        {[...filteredUpcoming, ...filteredFired].map((r) => (
          <ReminderListItem
            key={r.id}
            reminder={r}
            linkedTodoTitle={r.linkedTodoId ? todoMap.get(r.linkedTodoId) : undefined}
            allTags={allTags}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        ))}
      </ul>
    </>
  );
}
