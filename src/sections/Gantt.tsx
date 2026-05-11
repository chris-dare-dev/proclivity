import { useEffect, useState } from "react";
import { useStore } from "@/storage/useStore";
import { uid } from "@/storage/storage";
import { ChartView } from "./gantt/ChartView";
import { TextInputModal, ConfirmDialog } from "@/components/Modal";
import "./gantt/gantt.css";

export function Gantt() {
  const { state, update, loading } = useStore();
  const [activeId, setActiveId] = useState<string | undefined>();

  // ---- Modal state ----
  // "Create chart" modal
  const [showCreate, setShowCreate] = useState(false);

  // "Delete chart" confirm
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (activeId && state.ganttCharts.some((c) => c.id === activeId)) return;
    setActiveId(state.ganttCharts[0]?.id);
  }, [state.ganttCharts, activeId, loading]);

  const createChart = () => {
    setShowCreate(true);
  };

  const handleCreateSubmit = async (name: string) => {
    const id = uid();
    await update((s) => ({
      ...s,
      ganttCharts: [...s.ganttCharts, { id, name, createdAt: Date.now() }],
    }));
    setActiveId(id);
  };

  const deleteChart = (id: string) => {
    const chart = state.ganttCharts.find((c) => c.id === id);
    if (!chart) return;
    setDeleteTarget({ id, name: chart.name });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    await update((s) => ({
      ...s,
      ganttCharts: s.ganttCharts.filter((c) => c.id !== id),
      ganttTasks: s.ganttTasks.filter((t) => t.chartId !== id),
    }));
    setDeleteTarget(null);
  };

  const renameChart = async (id: string, name: string) => {
    await update((s) => ({
      ...s,
      ganttCharts: s.ganttCharts.map((c) =>
        c.id === id ? { ...c, name } : c,
      ),
    }));
  };

  if (loading) return null;

  return (
    <>
      {/* Create chart modal */}
      <TextInputModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New chart"
        placeholder="Chart name…"
        submitLabel="Create"
        onSubmit={handleCreateSubmit}
      />

      {/* Delete chart confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete chart"
        message={
          <>
            Delete <strong>{deleteTarget?.name}</strong> and all its tasks?
            This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
      />

      {state.ganttCharts.length === 0 ? (
        <div className="section-empty">
          <p style={{ marginTop: 0 }}>No Gantt charts yet.</p>
          <button onClick={createChart}>Create your first chart</button>
        </div>
      ) : (
        <div className="gantt">
          <div className="gantt-chart-tabs">
            {state.ganttCharts.map((c) => (
              <button
                key={c.id}
                className={`gantt-chart-tab ${c.id === activeId ? "active" : ""}`}
                onClick={() => setActiveId(c.id)}
              >
                {c.name}
              </button>
            ))}
            <button className="gantt-chart-new" onClick={createChart}>
              + New chart
            </button>
          </div>

          {activeId && (
            <ChartView
              key={activeId}
              chartId={activeId}
              onDeleteChart={() => deleteChart(activeId)}
              onRenameChart={(name) => renameChart(activeId, name)}
            />
          )}
        </div>
      )}
    </>
  );
}
