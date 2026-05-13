/**
 * TagsPane — settings pane for global tag CRUD.
 *
 * Owns:
 *   - The full TagsSection — create / rename / recolor / delete global tags.
 *
 * Tag mutations write-through immediately (bypasses the Done/Cancel snapshot)
 * because they operate on state.tags, not UserSettings, and do not participate
 * in the staged-settings lifecycle.
 *
 * No Agent B additions planned for this pane.
 */

import { useState } from "react";
import { ColorSwatchGrid } from "../SettingsControls";
import { TagChip } from "@/components/TagChip";
import {
  createTag,
  deleteTag,
  recolorTag,
  renameTag,
  TAG_COLOR_PRESETS,
} from "@/storage/tags";
import type { Tag } from "@/types";

export interface TagsPaneProps {
  tags: Tag[];
}

export function TagsPane({ tags }: TagsPaneProps) {
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );
  const [renameErrors, setRenameErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(TAG_COLOR_PRESETS[0]!.value);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleRename = async (id: string, label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const duplicate = tags.find(
      (t) => t.id !== id && t.label.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      setRenameErrors((prev) => ({
        ...prev,
        [id]: `A tag named "${duplicate.label}" already exists.`,
      }));
      return;
    }
    setRenameErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    await renameTag(id, trimmed);
  };

  const handleCreate = async () => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    const duplicate = tags.find(
      (t) => t.label.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      setCreateError(`A tag named "${duplicate.label}" already exists.`);
      return;
    }
    setCreateError(null);
    await createTag(trimmed, newColor);
    setNewLabel("");
    setNewColor(TAG_COLOR_PRESETS[0]!.value);
    setCreating(false);
  };

  return (
    <div
      role="tabpanel"
      id="settings-pane-tags"
      aria-labelledby="settings-tab-tags"
      className="settings-pane"
    >
      <section className="settings-section">
        <h3 className="settings-section-heading">Tags</h3>

        {tags.length === 0 && !creating ? (
          <span className="settings-hint">
            No tags yet. Tags are created while adding tasks or reminders, or
            use the button below to create one here.
          </span>
        ) : (
          <div className="tag-manager-list">
            {tags.map((tag) => {
              const isConfirmingDelete = confirmingDeleteId === tag.id;
              const renameError = renameErrors[tag.id];
              return (
                <div key={tag.id} className="tag-manager-row">
                  <TagChip label={tag.label} color={tag.color} />
                  <div className="tag-manager-row-fields">
                    <input
                      type="text"
                      className="tag-manager-name-input"
                      defaultValue={tag.label}
                      placeholder="Tag name"
                      aria-label={`Rename tag ${tag.label}`}
                      onBlur={(e) => {
                        void handleRename(tag.id, e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                    />
                    {renameError && (
                      <span
                        className="settings-hint settings-hint--error"
                        role="alert"
                      >
                        {renameError}
                      </span>
                    )}
                    <ColorSwatchGrid
                      presets={TAG_COLOR_PRESETS}
                      value={tag.color}
                      onChange={(hex) => {
                        void recolorTag(tag.id, hex);
                      }}
                      ariaLabel={`Color for tag ${tag.label}`}
                    />
                  </div>
                  {isConfirmingDelete ? (
                    <div className="tag-manager-delete-confirm">
                      <span className="settings-hint">
                        Remove &ldquo;{tag.label}&rdquo;? Items keep their
                        other tags.
                      </span>
                      <div className="tag-manager-delete-buttons">
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteId(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={async () => {
                            await deleteTag(tag.id);
                            setConfirmingDeleteId(null);
                          }}
                        >
                          Remove tag
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="tag-manager-delete"
                      aria-label={`Delete tag ${tag.label}`}
                      onClick={() => setConfirmingDeleteId(tag.id)}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {creating ? (
          <div className="tag-manager-create-form">
            <input
              type="text"
              className="tag-manager-name-input"
              value={newLabel}
              onChange={(e) => {
                setNewLabel(e.target.value);
                setCreateError(null);
              }}
              placeholder="Tag name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleCreate();
                }
                if (e.key === "Escape") {
                  setCreating(false);
                  setNewLabel("");
                  setCreateError(null);
                }
              }}
            />
            <ColorSwatchGrid
              presets={TAG_COLOR_PRESETS}
              value={newColor}
              onChange={setNewColor}
              ariaLabel="New tag color"
            />
            {createError && (
              <span
                className="settings-hint settings-hint--error"
                role="alert"
              >
                {createError}
              </span>
            )}
            <div className="tag-manager-delete-buttons">
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setNewLabel("");
                  setCreateError(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-btn-primary"
                onClick={() => {
                  void handleCreate();
                }}
                disabled={!newLabel.trim()}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="settings-action-btn"
            onClick={() => setCreating(true)}
          >
            + Create new tag
          </button>
        )}
      </section>
    </div>
  );
}
