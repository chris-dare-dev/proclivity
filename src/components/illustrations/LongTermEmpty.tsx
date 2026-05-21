interface Props {
  onAddTask: () => void;
}

export default function LongTermEmpty({ onAddTask }: Props) {
  return (
    <div className="section-empty-inner">
      <svg
        className="section-empty-illustration"
        viewBox="0 0 240 160"
        aria-hidden="true"
        focusable="false"
      >
        {/* Row 1 — bullet + line (text-dim) */}
        <circle cx="36" cy="52" r="4" stroke="var(--text-dim)" strokeWidth="1.5" fill="none" />
        <line x1="48" y1="52" x2="160" y2="52" stroke="var(--text-dim)" strokeWidth="1.5" />
        {/* Row 2 — bullet + shorter line (text-dim) */}
        <circle cx="36" cy="80" r="4" stroke="var(--text-dim)" strokeWidth="1.5" fill="none" />
        <line x1="48" y1="80" x2="130" y2="80" stroke="var(--text-dim)" strokeWidth="1.5" />
        {/* Row 3 — bullet + long line + chevron arrow (accent = future horizon) */}
        <circle cx="36" cy="108" r="4" stroke="var(--accent)" strokeWidth="1.5" fill="none" />
        <line x1="48" y1="108" x2="200" y2="108" stroke="var(--accent)" strokeWidth="1.5" />
        <polyline points="196,104 204,108 196,112" stroke="var(--accent)" strokeWidth="1.5" fill="none" />
      </svg>
      <h3>No long-term goals yet</h3>
      <p>Capture the things you want to ship later — they live here until you&apos;re ready.</p>
      <button type="button" className="btn-primary" onClick={onAddTask}>
        Add your first goal
      </button>
    </div>
  );
}
