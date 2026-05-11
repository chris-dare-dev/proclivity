import { lazy, memo, Suspense, useEffect, useState } from "react";
import "./App.css";
import { Today } from "@/sections/Today";
import { Sprint } from "@/sections/Sprint";
import { LongTerm } from "@/sections/LongTerm";
import { Gantt } from "@/sections/Gantt";
import { Reminders } from "@/sections/Reminders";

// Three.js is ~800kB minified — keep it out of the initial chunk so the
// planner UI renders without waiting on it. The mesh fades in once loaded.
const MeshBackground = lazy(() =>
  import("@/components/MeshBackground").then((m) => ({ default: m.MeshBackground })),
);

type Tab = "today" | "sprint" | "long" | "gantt" | "reminders";

const TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "sprint", label: "Sprint" },
  { id: "long", label: "Long-term" },
  { id: "gantt", label: "Gantt" },
  { id: "reminders", label: "Reminders" },
];

function greetingFor(d: Date) {
  const h = d.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// Header owns its own 1-second tick so the rest of App doesn't re-render
// on each clock update (Pattern F).
const Header = memo(function Header() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <header className="header">
      <div className="header-left">
        <div className="greeting">{greetingFor(now)}.</div>
        <div className="date">
          {now.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </div>
      </div>
      <div className="clock">
        {now.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
    </header>
  );
});

export default function App() {
  const [tab, setTab] = useState<Tab>("today");

  return (
    <>
      <Suspense fallback={null}>
        <MeshBackground />
      </Suspense>
      <div className="app">
        <Header />

        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`tab ${tab === t.id ? "tab-active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/*
          Keep all sections mounted (#39) — switching tabs preserves
          local state (drafts, expanded archived sprints, etc.). Inactive
          sections are hidden via inert + display:none.
        */}
        <main className="content">
          <div hidden={tab !== "today"}>
            <Today />
          </div>
          <div hidden={tab !== "sprint"}>
            <Sprint />
          </div>
          <div hidden={tab !== "long"}>
            <LongTerm />
          </div>
          <div hidden={tab !== "gantt"}>
            <Gantt />
          </div>
          <div hidden={tab !== "reminders"}>
            <Reminders />
          </div>
        </main>
      </div>
    </>
  );
}
