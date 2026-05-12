/**
 * TodoEditModal — shared edit modal for Todo items.
 *
 * Used by TodoList (Today / Long-term) and SprintManager.
 * Extracted as a shared component rather than duplicated per section.
 *
 * Edit field signature uses concrete fields (not Partial<Todo>) to satisfy
 * exactOptionalPropertyTypes (CRITICAL fix #2 from critique).
 *
 * On save: tags array is filtered against current allTags to drop any ids
 * that were deleted while the modal was open (CRITICAL fix #6).
 *
 * Snapshot pattern (MEDIUM fix #22): local state is initialized from the
 * todo at open-time. Arrays are spread to avoid sharing references with
 * the snapshot.
 */

import { useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { TagPickerArea } from "@/components/TagPickerArea";
import { createTag } from "@/storage/tags";
import type { Sprint, Tag, Todo, TodoScope } from "@/types";

export interface TodoEditFields {
  title: string;
  notes: string;
  scope: TodoScope;
  sprintId: string | undefined;
  tags: string[];
}

interface TodoEditModalProps {
  open: boolean;
  todo: Todo;
  allTags: Tag[];
  sprints: Sprint[];
  onClose: () => void;
  /** Concrete-field save — no Partial<> per exactOptionalPropertyTypes. */
  onSave: (id: string, fields: TodoEditFields) => void;
}

export function TodoEditModal({ open, todo, allTags, sprints, onClose, onSave }: TodoEditModalProps) {
  const [title, setTitle] = useState(todo.title);
  const [notes, setNotes] = useState(todo.notes ?? "");
  const [scope, setScope] = useState<TodoScope>(todo.scope);
  const [sprintId, setSprintId] = useState<string | undefined>(todo.sprintId);
  // Clone tags array so mutations don't affect the snapshot (MEDIUM fix #22)
  const [tagIds, setTagIds] = useState<string[]>([...todo.tags]);
  const [titleError, setTitleError] = useState<string | null>(null);

  // Reset state when modal opens (key on todo.id to re-mount on different item)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    if (open) {
      setTitle(todo.title);
      setNotes(todo.notes ?? "");
      setScope(todo.scope);
      setSprintId(todo.sprintId);
      setTagIds([...todo.tags]);
      setTitleError(null);
    }
  }, [open, todo.id]);

  const handleScopeChange = (newScope: TodoScope) => {
    setScope(newScope);
    if (newScope !== "sprint") setSprintId(undefined);
  };

  const handleSave = () => {
    const trimmed = title.trim();
    if (!trimmed) { setTitleError("Title is required."); return; }
    // Filter tagIds against current allTags to drop deleted tag refs (CRITICAL #6)
    const knownIds = new Set(allTags.map((t) => t.id));
    const validTagIds = tagIds.filter((id) => knownIds.has(id));
    onSave(todo.id, {
      title: trimmed,
      notes: notes.trim(),
      scope,
      sprintId: scope === "sprint" ? sprintId : undefined,
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

  const noSprints = scope === "sprint" && sprints.length === 0;

  return (
    <Modal open={open} onClose={onClose} title="Edit task" panelClassName="todo-edit-modal-panel">
      <div className="modal-body todo-edit-form">
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
          <span className="todo-edit-label">Notes (optional)</span>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes…"
          />
        </label>

        <div className="todo-edit-field">
          <span className="todo-edit-label">Scope</span>
          <div className="todo-edit-scope">
            {(["today", "sprint", "long"] as const).map((s) => (
              <label key={s} className={`todo-edit-scope-option${scope === s ? " is-active" : ""}`}>
                <input
                  type="radio"
                  name={`todo-edit-scope-${todo.id}`}
                  value={s}
                  checked={scope === s}
                  onChange={() => handleScopeChange(s)}
                />
                <span>{s === "today" ? "Today" : s === "sprint" ? "Sprint" : "Long-term"}</span>
              </label>
            ))}
          </div>
        </div>

        {scope === "sprint" && (
          <div className="todo-edit-field">
            <span className="todo-edit-label">Sprint</span>
            {noSprints ? (
              <span className="todo-edit-hint">No sprints yet — create a sprint first.</span>
            ) : (
              <select
                value={sprintId ?? ""}
                onChange={(e) => setSprintId(e.target.value || undefined)}
              >
                <option value="">— select a sprint —</option>
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

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
          disabled={noSprints}
        >
          Save changes
        </button>
      </div>
    </Modal>
  );
}
