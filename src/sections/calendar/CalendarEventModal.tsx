import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Modal } from "@/components/Modal";
import {
  clearCalendarEventFieldErrors,
  createCalendarEventDraft,
  fromDateTimeLocalInput,
  validateCalendarEventDraft,
  type CalendarEventDraft,
  type CalendarEventFormErrors,
  type NewLocalCalendarEventFields,
} from "./calendarEventUtils";

interface CalendarEventModalProps {
  open: boolean;
  dayTimestamp: number;
  returnFocusTo: HTMLElement | null;
  onClose: () => void;
  onCreate: (event: NewLocalCalendarEventFields) => Promise<void>;
}

export function CalendarEventModal({
  open,
  dayTimestamp,
  returnFocusTo,
  onClose,
  onCreate,
}: CalendarEventModalProps) {
  const fieldId = useId();
  const titleRef = useRef<HTMLInputElement | null>(null);
  const startRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<CalendarEventDraft>(() =>
    createCalendarEventDraft(dayTimestamp),
  );
  const [errors, setErrors] = useState<CalendarEventFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(createCalendarEventDraft(dayTimestamp));
    setErrors({});
    setSubmitError(null);
    setSaving(false);
  }, [dayTimestamp, open]);

  const parsedStart = fromDateTimeLocalInput(draft.start);
  const dateLabel = new Date(parsedStart ?? dayTimestamp).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const updateDraft = (field: keyof CalendarEventDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    if (field === "title" || field === "start" || field === "end") {
      setErrors((current) => clearCalendarEventFieldErrors(current, field));
    }
    setSubmitError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const result = validateCalendarEventDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      requestAnimationFrame(() => {
        if (result.errors.title) titleRef.current?.focus();
        else if (result.errors.start) startRef.current?.focus();
        else if (result.errors.end) endRef.current?.focus();
      });
      return;
    }

    setErrors({});
    setSubmitError(null);
    setSaving(true);
    try {
      await onCreate(result.value);
      onClose();
    } catch {
      setSubmitError(
        "This event could not be saved locally. Check available storage and try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const requestClose = () => {
    if (!saving) onClose();
  };

  const titleId = `${fieldId}-title`;
  const startId = `${fieldId}-start`;
  const endId = `${fieldId}-end`;
  const locationId = `${fieldId}-location`;
  const notesId = `${fieldId}-notes`;

  return (
    <Modal
      open={open}
      onClose={requestClose}
      title="Create event"
      returnFocusTo={returnFocusTo}
      panelClassName="calendar-event-modal-panel"
    >
      <form
        className="calendar-event-form"
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
        aria-busy={saving}
      >
        <div className="calendar-event-form__context">
          <span>Local event</span>
          <time dateTime={parsedStart === null ? undefined : draft.start.slice(0, 10)}>
            {dateLabel}
          </time>
        </div>

        <label className="calendar-event-field" htmlFor={titleId}>
          <span className="calendar-event-field__label">Title</span>
          <input
            ref={titleRef}
            id={titleId}
            type="text"
            value={draft.title}
            onChange={(event) => updateDraft("title", event.target.value)}
            maxLength={200}
            autoComplete="off"
            autoFocus
            required
            aria-invalid={errors.title ? "true" : undefined}
            aria-describedby={errors.title ? `${titleId}-error` : undefined}
          />
          {errors.title ? (
            <span
              className="calendar-event-field__error"
              id={`${titleId}-error`}
              role="alert"
            >
              {errors.title}
            </span>
          ) : null}
        </label>

        <div className="calendar-event-form__time-row">
          <label className="calendar-event-field" htmlFor={startId}>
            <span className="calendar-event-field__label">Starts</span>
            <input
              ref={startRef}
              id={startId}
              type="datetime-local"
              value={draft.start}
              onChange={(event) => updateDraft("start", event.target.value)}
              step={900}
              required
              aria-invalid={errors.start ? "true" : undefined}
              aria-describedby={errors.start ? `${startId}-error` : undefined}
            />
            {errors.start ? (
              <span
                className="calendar-event-field__error"
                id={`${startId}-error`}
                role="alert"
              >
                {errors.start}
              </span>
            ) : null}
          </label>

          <label className="calendar-event-field" htmlFor={endId}>
            <span className="calendar-event-field__label">Ends</span>
            <input
              ref={endRef}
              id={endId}
              type="datetime-local"
              value={draft.end}
              onChange={(event) => updateDraft("end", event.target.value)}
              step={900}
              required
              aria-invalid={errors.end ? "true" : undefined}
              aria-describedby={errors.end ? `${endId}-error` : undefined}
            />
            {errors.end ? (
              <span
                className="calendar-event-field__error"
                id={`${endId}-error`}
                role="alert"
              >
                {errors.end}
              </span>
            ) : null}
          </label>
        </div>

        <label className="calendar-event-field" htmlFor={locationId}>
          <span className="calendar-event-field__label">Location</span>
          <input
            id={locationId}
            type="text"
            value={draft.location}
            onChange={(event) => updateDraft("location", event.target.value)}
            maxLength={300}
            autoComplete="off"
            placeholder="Optional"
          />
        </label>

        <label className="calendar-event-field" htmlFor={notesId}>
          <span className="calendar-event-field__label">Notes</span>
          <textarea
            id={notesId}
            rows={4}
            value={draft.notes}
            onChange={(event) => updateDraft("notes", event.target.value)}
            maxLength={5000}
            placeholder="Optional context, links, or preparation notes"
          />
        </label>

        {submitError ? (
          <p className="calendar-event-form__submit-error" role="alert">
            {submitError}
          </p>
        ) : null}

        <div className="calendar-event-form__footer">
          <p>
            Saved in Proclivity only. Google and Outlook calendars are not
            changed.
          </p>
          <div className="modal-footer">
            <button type="button" onClick={requestClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className="calendar-event-submit"
              disabled={saving}
            >
              {saving ? "Creating…" : "Create event"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
