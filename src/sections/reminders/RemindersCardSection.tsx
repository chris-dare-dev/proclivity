/**
 * RemindersCardSection — lazy-loaded reminder render for both list and card modes.
 *
 * Handles both card mode and list mode so the entire reminders task render is
 * behind a lazy boundary. RemindersManager only renders the add-form and this
 * lazy boundary; no card/list branching logic in the hot path.
 *
 * A1 fix: card-mode uses shared <TaskCard> primitive.
 * A2 fix: uses useCardLayout hook for position management.
 * A3 fix: DraggableCard onDragStart removed — z managed in useCardLayout.
 * D3 fix: cards rendered as <article> with aria-label via TaskCard.
 * H1 fix: positions seeded synchronously via useCardLayout.
 *
 * Loaded only on first render of the reminders section.
 */

import { useEffect, useMemo, useState } from "react";
import type { Reminder, Tag, CardLayoutMap } from "@/types";
import type { ProclivityState } from "@/types";
import { TagFilterToolbar } from "@/components/TagFilterToolbar";
import { TagChip } from "@/components/TagChip";
import { filterByTags } from "@/storage/tags";
import { CardCanvas } from "@/components/card/CardCanvas";
import { DraggableCard } from "@/components/card/DraggableCard";
import { TaskCard } from "@/components/card/TaskCard";
import { useCardLayout } from "@/hooks/useCardLayout";
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

/* ─── List-mode reminder item ──────────────────────────────────── */

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

interface CardCanvasInternalProps {
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
}: CardCanvasInternalProps) {
  // A2: all position management in one hook
  const { getPosition, canvasMinHeight, canvasElRef, handlers } = useCardLayout({
    items: allReminders,
    cardLayouts,
    update,
  });

  // All visible filtered reminder ids
  const filteredIds = useMemo(
    () => new Set([...filteredUpcoming.map((r) => r.id), ...filteredFired.map((r) => r.id)]),
    [filteredUpcoming, filteredFired],
  );

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
        onPositionChange={handlers.onPositionChange}
        onDragEnd={handlers.onDragEnd}
        filteredOut={isFilteredOut}
      >
        {/* A1+D3: shared TaskCard with role="article" + aria-label */}
        <TaskCard
          title={r.title}
          done={r.fired}
          tags={resolvedTags}
          itemId={r.id}
          ariaLabel={`${r.title}${r.fired ? " (fired)" : ""}`}
          onEdit={() => onEdit(r.id)}
          onDelete={() => void onDelete(r.id)}
          extra={
            <div className="task-card-fireat">
              <RelativeTime fireAt={r.fireAt} />
              {recLabel && <span className="reminder-badge">{recLabel}</span>}
              {r.fired && <span className="reminder-badge fired">fired</span>}
              {linkedTodoTitle && (
                <span className="task-card-notes">→ {linkedTodoTitle}</span>
              )}
            </div>
          }
        />
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
          onClick={() => void handlers.onResetLayout()}
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
