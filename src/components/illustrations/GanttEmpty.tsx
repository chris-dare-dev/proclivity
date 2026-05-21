interface Props {
  onAddTask: () => void;
}

export default function GanttEmpty({ onAddTask }: Props) {
  return (
    <div className="section-empty-inner">
      <svg
        className="section-empty-illustration"
        viewBox="0 0 240 160"
        aria-hidden="true"
        focusable="false"
      >
        {/* Horizontal axis */}
        <line x1="20" y1="130" x2="220" y2="130" stroke="var(--text-dim)" strokeWidth="1.5" />
        {/* Vertical today line — accent */}
        <line x1="120" y1="20" x2="120" y2="130" stroke="var(--accent)" strokeWidth="1.5" />
        {/* Bar 1 — wide, starts early */}
        <rect x="28" y="40" width="124" height="16" rx="4" stroke="var(--text-dim)" strokeWidth="1.5" fill="none" />
        {/* Bar 2 — shorter, offset */}
        <rect x="46" y="65" width="60" height="16" rx="4" stroke="var(--text-dim)" strokeWidth="1.5" fill="none" />
        {/* Bar 3 — spans past today */}
        <rect x="64" y="90" width="130" height="16" rx="4" stroke="var(--text-dim)" strokeWidth="1.5" fill="none" />
      </svg>
      <h3>No tasks yet</h3>
      <p>Start populating this chart to see your sprint plan come together.</p>
      <button type="button" className="btn-primary" onClick={onAddTask}>
        Add your first task
      </button>
    </div>
  );
}
