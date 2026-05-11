import { useEffect, useState } from "react";
import { useStore } from "@/storage/useStore";
import { uid } from "@/storage/storage";
import { ChartView } from "./gantt/ChartView";
import "./gantt/gantt.css";

export function Gantt() {
  const { state, update, loading } = useStore();
  const [activeId, setActiveId] = useState<string | undefined>();

  useEffect(() => {
    if (loading) return;
    if (activeId && state.ganttCharts.some((c) => c.id === activeId)) return;
    setActiveId(state.ganttCharts[0]?.id);
  }, [state.ganttCharts, activeId, loading]);

  const createChart = async () => {
    const name = window.prompt("Chart name?")?.trim();
    if (!name) return;
    const id = uid();
    await update((s) => ({
      ...s,
      ganttCharts: [...s.ganttCharts, { id, name, createdAt: Date.now() }],
    }));
    setActiveId(id);
  };

  const deleteChart = async (id: string) => {
    if (!window.confirm("Delete chart and all its tasks?")) return;
    await update((s) => ({
      ...s,
      ganttCharts: s.ganttCharts.filter((c) => c.id !== id),
      ganttTasks: s.ganttTasks.filter((t) => t.chartId !== id),
    }));
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

  if (state.ganttCharts.length === 0) {
    return (
      <div className="section-empty">
        <p style={{ marginTop: 0 }}>No Gantt charts yet.</p>
        <button onClick={createChart}>Create your first chart</button>
      </div>
    );
  }

  return (
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
  );
}
