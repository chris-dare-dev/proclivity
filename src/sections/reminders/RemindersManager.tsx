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

import { lazy, Suspense, useState, useEffect, useMemo } from "react";
import { useStore } from "@/storage/useStore";
import { uid } from "@/storage/storage";
import { resolvedSettings } from "@/storage/constants";
import type { Reminder, Tag, Todo } from "@/types";
import { Modal } from "@/components/Modal";
import { TagPickerArea } from "@/components/TagPickerArea";
import { createTag } from "@/storage/tags";

/* ─── Lazy card/list section — only loaded on first render ───── */
const RemindersCardSection = lazy(() =>
  import("./RemindersCardSection").then((m) => ({ default: m.RemindersCardSection })),
);
import {
  tsToDatetimeLocal,
  datetimeLocalToTs,
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
            {/* Closed todos are hidden — a reminder for something the user
                already finished is rarely the intent. */}
            {todos
              .filter((t) => !t.done)
              .map((t) => (
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

  // H5 fix: useEffect (side-effect semantics) instead of the anti-pattern
  // useMemo+setState that required an eslint-disable. Same behaviour: resets
  // form fields when the modal opens for a different reminder.
  useEffect(() => {
    if (open) {
      setTitle(reminder.title);
      setFireAtVal(tsToDatetimeLocal(reminder.fireAt));
      setRecurrence(reminder.recurrence ?? "none");
      setLinkedTodoId(reminder.linkedTodoId ?? "");
      setTagIds([...reminder.tags]);
      setTitleError(null);
    }
  }, [open, reminder.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
            {/* Hide closed todos, but keep the currently-linked one even if
                it's been closed since — otherwise the select would silently
                fall back to "— none —" and the user could drop the link
                without realising it. */}
            {todos
              .filter((t) => !t.done || t.id === reminder.linkedTodoId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.scope}] {t.title}
                  {t.done ? " (closed)" : ""}
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
  const { reminders, todos, tags: allTags, cardLayouts } = state;

  // D9 fix: use resolvedSettings for consistent layoutMode read across all sections.
  const layoutMode = resolvedSettings(state.settings).layoutMode;

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
      // Clean up orphan card position on deletion
      cardLayouts: s.cardLayouts
        ? (() => {
            const next = { ...s.cardLayouts };
            delete next[id];
            return Object.keys(next).length > 0 ? next : undefined;
          })()
        : undefined,
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

  return (
    <div>
      <AddReminderForm onSave={addReminder} todos={todos} allTags={allTags} />

      <Suspense fallback={null}>
        <RemindersCardSection
          layoutMode={layoutMode}
          upcoming={upcoming}
          fired={fired}
          allTags={allTags}
          effectiveActiveTagIds={effectiveActiveTagIds}
          availableTags={availableTags}
          todoMap={todoMap}
          cardLayouts={cardLayouts}
          cardHintSeen={resolvedSettings(state.settings).cardHintSeen}
          onDelete={deleteReminder}
          onEdit={(id) => setEditingId(id)}
          onToggleFilter={toggleFilter}
          onClearFilter={() => setActiveTagIds([])}
          onDismissHint={() => {
            void update((s) => ({
              ...s,
              settings: { ...s.settings, cardHintSeen: true },
            }));
          }}
          update={update}
        />
      </Suspense>

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
