/**
 * RemindersManager — reminders section with add form, filter toolbar, and edit modal.
 *
 * Filter state: transient per-session useState (same rationale as TodoList).
 *
 * Edit modal: ReminderEditModal defined below. Concrete field signature
 * (no Partial<>) per CRITICAL fix #2.
 *
 * Past-fireAt behavior (HIGH fix #14): if the user saves an edit with a past
 * fireAt and no recurrence, the reminder is marked fired immediately.
 * Rationale: service-worker diffAndSyncAlarms skips alarms where fireAt <= now,
 * so the reminder would sit in "upcoming" forever. Marking fired immediately
 * is cleaner UX than the warning-but-save footgun.
 */

import { useState, useEffect, useMemo } from "react";
import { useStore } from "@/storage/useStore";
import { uid } from "@/storage/storage";
import type { Reminder, Tag, Todo } from "@/types";
import { Modal } from "@/components/Modal";
import { TagPickerArea } from "@/components/TagPickerArea";
import { TagFilterToolbar } from "@/components/TagFilterToolbar";
import { TagChip } from "@/components/TagChip";
import { filterByTags, createTag } from "@/storage/tags";
import {
  relativeTime,
  tsToDatetimeLocal,
  datetimeLocalToTs,
  formatFireAt,
} from "./reminderUtils";
import "../sections.css";
import "./reminders.css";

/* ─── Add Reminder Form ─────────────────────────────────────── */

interface AddReminderFormProps {
  onSave: (reminder: Omit<Reminder, "id" | "fired">) => void;
  todos: Todo[];
  allTags: Tag[];
}

function AddReminderForm({ onSave, todos, allTags }: AddReminderFormProps) {
  const defaultFireAt = () => {
    const d = new Date(Date.now() + 60 * 60_000);
    d.setSeconds(0, 0);
    return tsToDatetimeLocal(d.getTime());
  };

  const [title, setTitle] = useState("");
  const [fireAtVal, setFireAtVal] = useState(defaultFireAt);
  const [recurrence, setRecurrence] = useState<Reminder["recurrence"]>("none");
  const [linkedTodoId, setLinkedTodoId] = useState<string>("");
  const [tagIds, setTagIds] = useState<string[]>([]);

  const handleSave = () => {
    const t = title.trim();
    if (!t || !fireAtVal) return;
    onSave({
      title: t,
      fireAt: datetimeLocalToTs(fireAtVal),
      recurrence: recurrence ?? "none",
      linkedTodoId: linkedTodoId || undefined,
      tags: tagIds,
    });
    setTitle("");
    setFireAtVal(defaultFireAt());
    setRecurrence("none");
    setLinkedTodoId("");
    setTagIds([]);
  };

  const handleToggleTag = (tagId: string) => {
    setTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  const handleCreateTag = async (label: string, color: string): Promise<Tag> => {
    return createTag(label, color);
  };

  return (
    <div className="reminder-form">
      <h4>Add Reminder</h4>
      <div className="reminder-form-grid">
        <div className="reminder-form-field reminder-form-field-full">
          <label>Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Reminder title…"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
        </div>
        <div className="reminder-form-field">
          <label>Fire at</label>
          <input
            type="datetime-local"
            value={fireAtVal}
            onChange={(e) => setFireAtVal(e.target.value)}
          />
        </div>
        <div className="reminder-form-field">
          <label>Recurrence</label>
          <select
            value={recurrence}
            onChange={(e) =>
              setRecurrence(e.target.value as Reminder["recurrence"])
            }
          >
            <option value="none">None</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
        <div className="reminder-form-field reminder-form-field-full">
          <label>Link to todo (optional)</label>
          <select
            value={linkedTodoId}
            onChange={(e) => setLinkedTodoId(e.target.value)}
          >
            <option value="">— none —</option>
            {todos.map((t) => (
              <option key={t.id} value={t.id}>
                [{t.scope}] {t.title}
              </option>
            ))}
          </select>
        </div>
        <div className="reminder-form-field reminder-form-field-full">
          <label>Tags</label>
          <TagPickerArea
            allTags={allTags}
            assignedTagIds={tagIds}
            onToggle={handleToggleTag}
            onCreate={handleCreateTag}
          />
        </div>
      </div>
      <div className="reminder-form-actions">
        <button onClick={handleSave}>Add Reminder</button>
      </div>
    </div>
  );
}

/* ─── RelativeTime — owns its own 30s tick so the parent doesn't re-render */

function RelativeTime({ fireAt }: { fireAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const absolute = formatFireAt(fireAt);
  return <span title={absolute}>{relativeTime(fireAt, now)}</span>;
}

/* ─── Reminder Item ─────────────────────────────────────────── */

interface ReminderItemProps {
  reminder: Reminder;
  linkedTodoTitle?: string | undefined;
  allTags: Tag[];
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}

function ReminderItem({
  reminder,
  linkedTodoTitle,
  allTags,
  onDelete,
  onEdit,
}: ReminderItemProps) {
  const absolute = formatFireAt(reminder.fireAt);
  const recLabel =
    reminder.recurrence && reminder.recurrence !== "none"
      ? reminder.recurrence
      : null;

  // Resolve tag objects — skip orphan ids silently
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
          {recLabel && (
            <span className="reminder-badge">{recLabel}</span>
          )}
          {reminder.fired && (
            <span className="reminder-badge fired">fired</span>
          )}
          {linkedTodoTitle && (
            <span className="reminder-linked-todo">
              → {linkedTodoTitle}
            </span>
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
          onClick={() => onDelete(reminder.id)}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

/* ─── Reminder Edit Modal ───────────────────────────────────── */

interface ReminderEditFields {
  title: string;
  fireAt: number;
  recurrence: NonNullable<Reminder["recurrence"]>;
  linkedTodoId: string | undefined;
  tags: string[];
}

interface ReminderEditModalProps {
  open: boolean;
  reminder: Reminder;
  todos: Todo[];
  allTags: Tag[];
  onClose: () => void;
  /** Concrete fields — no Partial<> per exactOptionalPropertyTypes (CRITICAL fix #2). */
  onSave: (id: string, fields: ReminderEditFields) => void;
}

function ReminderEditModal({
  open,
  reminder,
  todos,
  allTags,
  onClose,
  onSave,
}: ReminderEditModalProps) {
  const [title, setTitle] = useState(reminder.title);
  const [fireAtVal, setFireAtVal] = useState(tsToDatetimeLocal(reminder.fireAt));
  const [recurrence, setRecurrence] = useState<NonNullable<Reminder["recurrence"]>>(
    reminder.recurrence ?? "none",
  );
  const [linkedTodoId, setLinkedTodoId] = useState<string>(reminder.linkedTodoId ?? "");
  const [tagIds, setTagIds] = useState<string[]>([...reminder.tags]);
  const [titleError, setTitleError] = useState<string | null>(null);

  // Reset on open with new reminder
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    if (open) {
      setTitle(reminder.title);
      setFireAtVal(tsToDatetimeLocal(reminder.fireAt));
      setRecurrence(reminder.recurrence ?? "none");
      setLinkedTodoId(reminder.linkedTodoId ?? "");
      setTagIds([...reminder.tags]);
      setTitleError(null);
    }
  }, [open, reminder.id]);

  const fireAtTs = datetimeLocalToTs(fireAtVal);
  const isPast = fireAtTs < Date.now();

  const handleSave = () => {
    const trimmed = title.trim();
    if (!trimmed) { setTitleError("Title is required."); return; }
    // On save: filter tagIds against current allTags (CRITICAL fix #6)
    const knownIds = new Set(allTags.map((t) => t.id));
    const validTagIds = tagIds.filter((id) => knownIds.has(id));
    onSave(reminder.id, {
      title: trimmed,
      fireAt: fireAtTs,
      recurrence,
      linkedTodoId: linkedTodoId || undefined,
      tags: validTagIds,
    });
    onClose();
  };

  const handleToggleTag = (tagId: string) => {
    setTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  const handleCreateTag = async (label: string, color: string): Promise<Tag> => {
    return createTag(label, color);
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit reminder">
      <div className="modal-body reminder-edit-form">
        <label className="todo-edit-field">
          <span className="todo-edit-label">Title</span>
          <input
            type="text"
            value={title}
            autoFocus
            onChange={(e) => { setTitle(e.target.value); setTitleError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
          />
          {titleError && <span className="todo-edit-error" role="alert">{titleError}</span>}
        </label>

        <label className="todo-edit-field">
          <span className="todo-edit-label">Fire at</span>
          <input
            type="datetime-local"
            value={fireAtVal}
            onChange={(e) => setFireAtVal(e.target.value)}
          />
          {isPast && (
            <span className="settings-hint settings-hint--info" role="status">
              This time is in the past.{" "}
              {recurrence === "none"
                ? "The reminder will be marked fired immediately on save."
                : "The next occurrence will be scheduled automatically."}
            </span>
          )}
        </label>

        <label className="todo-edit-field">
          <span className="todo-edit-label">Repeat</span>
          <select
            value={recurrence}
            onChange={(e) =>
              setRecurrence(e.target.value as NonNullable<Reminder["recurrence"]>)
            }
          >
            <option value="none">None</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>

        <label className="todo-edit-field">
          <span className="todo-edit-label">Link to todo (optional)</span>
          <select
            value={linkedTodoId}
            onChange={(e) => setLinkedTodoId(e.target.value)}
          >
            <option value="">— none —</option>
            {todos.map((t) => (
              <option key={t.id} value={t.id}>
                [{t.scope}] {t.title}
              </option>
            ))}
          </select>
        </label>

        <div className="todo-edit-field">
          <span className="todo-edit-label">Tags</span>
          <TagPickerArea
            allTags={allTags}
            assignedTagIds={tagIds}
            onToggle={handleToggleTag}
            onCreate={handleCreateTag}
          />
        </div>
      </div>

      <div className="modal-footer">
        <button type="button" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="modal-btn-primary"
          onClick={handleSave}
        >
          Save changes
        </button>
      </div>
    </Modal>
  );
}

/* ─── Main RemindersManager ─────────────────────────────────── */

export function RemindersManager() {
  const { state, update, loading } = useStore();
  // Transient filter — same rationale as TodoList: ephemeral newtab state
  const [activeTagIds, setActiveTagIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // All hooks must run unconditionally — the `if (loading)` guard sits below
  // them. Otherwise React error #310 ("rendered more hooks than the previous
  // render") fires when loading flips from true to false.
  const { reminders, todos, tags: allTags } = state;

  const upcoming = useMemo(
    () => reminders.filter((r) => !r.fired).sort((a, b) => a.fireAt - b.fireAt),
    [reminders],
  );

  const fired = useMemo(
    () => reminders.filter((r) => r.fired).sort((a, b) => b.fireAt - a.fireAt),
    [reminders],
  );

  // Tags used in any reminder (for filter toolbar)
  const availableTags = useMemo(() => {
    const usedIds = new Set(reminders.flatMap((r) => r.tags));
    return allTags.filter((tag) => usedIds.has(tag.id));
  }, [reminders, allTags]);

  // Prune activeTagIds when tags are deleted
  const effectiveActiveTagIds = useMemo(() => {
    const knownIds = new Set(allTags.map((t) => t.id));
    return activeTagIds.filter((id) => knownIds.has(id));
  }, [activeTagIds, allTags]);

  const filteredUpcoming = useMemo(
    () => filterByTags(upcoming, effectiveActiveTagIds),
    [upcoming, effectiveActiveTagIds],
  );

  const filteredFired = useMemo(
    () => filterByTags(fired, effectiveActiveTagIds),
    [fired, effectiveActiveTagIds],
  );

  if (loading) return null;

  const todoMap = new Map(todos.map((t) => [t.id, t.title]));

  const editingReminder = editingId
    ? reminders.find((r) => r.id === editingId) ?? null
    : null;

  const addReminder = async (
    reminder: Omit<Reminder, "id" | "fired">,
  ) => {
    const id = uid();
    await update((s) => ({
      ...s,
      reminders: [...s.reminders, { ...reminder, id, fired: false }],
    }));
  };

  const deleteReminder = async (id: string) => {
    await update((s) => ({
      ...s,
      reminders: s.reminders.filter((r) => r.id !== id),
    }));
  };

  const handleEditSave = async (id: string, fields: ReminderEditFields) => {
    const now = Date.now();
    // HIGH fix #14: past fireAt + no recurrence → mark fired immediately.
    // Otherwise the reminder sits in "upcoming" but never fires.
    const markFired =
      fields.fireAt < now && (fields.recurrence === "none" || !fields.recurrence);

    await update((s) => ({
      ...s,
      reminders: s.reminders.map((r) => {
        if (r.id !== id) return r;
        return {
          ...r,
          title: fields.title,
          fireAt: fields.fireAt,
          recurrence: fields.recurrence,
          linkedTodoId: fields.linkedTodoId,
          tags: fields.tags,
          fired: markFired ? true : r.fired,
        };
      }),
    }));
  };

  const toggleFilter = (tagId: string) => {
    setActiveTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  const isFiltered = effectiveActiveTagIds.length > 0;

  return (
    <div>
      <AddReminderForm onSave={addReminder} todos={todos} allTags={allTags} />

      <TagFilterToolbar
        availableTags={availableTags}
        activeTagIds={effectiveActiveTagIds}
        totalCount={reminders.length}
        filteredCount={filteredUpcoming.length + filteredFired.length}
        onToggle={toggleFilter}
        onClearAll={() => setActiveTagIds([])}
      />

      {/* Upcoming */}
      <div className="reminders-section">
        <div className="reminders-section-heading">
          Upcoming ({filteredUpcoming.length})
        </div>
        {filteredUpcoming.length === 0 ? (
          <div className="section-empty">
            {isFiltered
              ? <>No upcoming reminders match the selected tags. <button type="button" className="inline-clear-link" onClick={() => setActiveTagIds([])}>Clear the filter</button></>
              : "No upcoming reminders."}
          </div>
        ) : (
          filteredUpcoming.map((r) => (
            <ReminderItem
              key={r.id}
              reminder={r}
              linkedTodoTitle={r.linkedTodoId ? todoMap.get(r.linkedTodoId) : undefined}
              allTags={allTags}
              onDelete={deleteReminder}
              onEdit={(id) => setEditingId(id)}
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
            <div className="section-empty">No fired reminders match the selected tags.</div>
          ) : (
            filteredFired.map((r) => (
              <ReminderItem
                key={r.id}
                reminder={r}
                linkedTodoTitle={r.linkedTodoId ? todoMap.get(r.linkedTodoId) : undefined}
                allTags={allTags}
                onDelete={deleteReminder}
                onEdit={(id) => setEditingId(id)}
              />
            ))
          )}
        </div>
      )}

      {editingReminder && (
        <ReminderEditModal
          open={editingId !== null}
          reminder={editingReminder}
          todos={todos}
          allTags={allTags}
          onClose={() => setEditingId(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
}
