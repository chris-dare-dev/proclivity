import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { useStore } from "@/storage/useStore";
import "./SettingsModal.css";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Settings modal triggered from the header gear icon. Today it edits a single
 * field (display name) used by the greeting; designed to grow as preferences
 * accumulate (work hours, theme, LLM connection state, etc.).
 */
export function SettingsModal({ open, onClose }: Props) {
  const { state, update } = useStore();
  const [name, setName] = useState(state.settings.name ?? "");

  // Re-sync local form state whenever the modal is re-opened — the underlying
  // store may have changed since the last close.
  useEffect(() => {
    if (open) setName(state.settings.name ?? "");
  }, [open, state.settings.name]);

  const save = async () => {
    const next = name.trim();
    await update((s) => ({
      ...s,
      settings: {
        ...s.settings,
        name: next || undefined,
      },
    }));
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <form
        className="modal-body settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className="settings-field">
          <span className="settings-label">Your name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What should we call you?"
            maxLength={48}
            autoFocus
          />
          <span className="settings-hint">
            Appears in the greeting at the top of the page. Leave blank to
            omit.
          </span>
        </label>
      </form>
      <div className="modal-footer">
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="modal-btn-primary" onClick={save}>
          Save
        </button>
      </div>
    </Modal>
  );
}
