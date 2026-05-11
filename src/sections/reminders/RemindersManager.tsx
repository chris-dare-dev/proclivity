import { useState, useEffect } from "react";
import { useStore } from "@/storage/useStore";
import { uid } from "@/storage/storage";
import type { Reminder, Todo } from "@/types";
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
}

function AddReminderForm({ onSave, todos }: AddReminderFormProps) {

  // Default fire time: 1 hour from now, rounded to nearest minute
  const defaultFireAt = () => {
    const d = new Date(Date.now() + 60 * 60_000);
    d.setSeconds(0, 0);
    return tsToDatetimeLocal(d.getTime());
  };

  const [title, setTitle] = useState("");
  const [fireAtVal, setFireAtVal] = useState(defaultFireAt);
  const [recurrence, setRecurrence] = useState<Reminder["recurrence"]>("none");
  const [linkedTodoId, setLinkedTodoId] = useState<string>("");

  const handleSave = () => {
    const t = title.trim();
    if (!t || !fireAtVal) return;
    onSave({
      title: t,
      fireAt: datetimeLocalToTs(fireAtVal),
      recurrence: recurrence ?? "none",
      linkedTodoId: linkedTodoId || undefined,
    });
    setTitle("");
    setFireAtVal(defaultFireAt());
    setRecurrence("none");
    setLinkedTodoId("");
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
      </div>
      <div className="reminder-form-actions">
        <button onClick={handleSave}>Add Reminder</button>
      </div>
    </div>
  );
}

/* ─── Reminder Item ─────────────────────────────────────────── */

interface ReminderItemProps {
  reminder: Reminder;
  linkedTodoTitle?: string;
  onDelete: (id: string) => void;
  now: number;
}

function ReminderItem({
  reminder,
  linkedTodoTitle,
  onDelete,
  now,
}: ReminderItemProps) {
  const rel = relativeTime(reminder.fireAt, now);
  const absolute = formatFireAt(reminder.fireAt);
  const recLabel =
    reminder.recurrence && reminder.recurrence !== "none"
      ? reminder.recurrence
      : null;

  return (
    <div className={`reminder-item ${reminder.fired ? "fired" : ""}`}>
      <div className="reminder-item-body">
        <div className="reminder-item-title">{reminder.title}</div>
        <div className="reminder-item-meta">
          <span title={absolute}>{rel}</span>
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
        </div>
      </div>
      <div className="reminder-item-actions">
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

/* ─── Main RemindersManager ─────────────────────────────────── */

export function RemindersManager() {
  const { state, update, loading } = useStore();
  // Tick every 30 s to update relative times
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (loading) return null;

  const { reminders, todos } = state;

  const todoMap = new Map(todos.map((t) => [t.id, t.title]));

  const upcoming = reminders
    .filter((r) => !r.fired)
    .sort((a, b) => a.fireAt - b.fireAt);

  const fired = reminders
    .filter((r) => r.fired)
    .sort((a, b) => b.fireAt - a.fireAt);

  const addReminder = async (
    reminder: Omit<Reminder, "id" | "fired">,
  ) => {
    const id = uid();
    await update((s) => ({
      ...s,
      reminders: [...s.reminders, { ...reminder, id, fired: false }],
    }));
  };

  // Single delete action: Dismiss was identical and misleadingly commented (#6)
  const deleteReminder = async (id: string) => {
    await update((s) => ({
      ...s,
      reminders: s.reminders.filter((r) => r.id !== id),
    }));
  };

  return (
    <div>
      {/* Pass todos as prop — avoids a second useStore() in AddReminderForm (#7) */}
      <AddReminderForm onSave={addReminder} todos={todos} />

      {/* Upcoming */}
      <div className="reminders-section">
        <div className="reminders-section-heading">
          Upcoming ({upcoming.length})
        </div>
        {upcoming.length === 0 ? (
          <div className="section-empty">No upcoming reminders.</div>
        ) : (
          upcoming.map((r) => (
            <ReminderItem
              key={r.id}
              reminder={r}
              linkedTodoTitle={r.linkedTodoId ? todoMap.get(r.linkedTodoId) : undefined}
              onDelete={deleteReminder}
              now={now}
            />
          ))
        )}
      </div>

      {/* Fired */}
      {fired.length > 0 && (
        <div className="reminders-section">
          <div className="reminders-section-heading">
            Fired ({fired.length})
          </div>
          {fired.map((r) => (
            <ReminderItem
              key={r.id}
              reminder={r}
              linkedTodoTitle={r.linkedTodoId ? todoMap.get(r.linkedTodoId) : undefined}
              onDelete={deleteReminder}
              now={now}
            />
          ))}
        </div>
      )}
    </div>
  );
}
