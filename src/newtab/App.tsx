import { useEffect, useState } from "react";
import "./App.css";
import { Today } from "@/sections/Today";
import { Sprint } from "@/sections/Sprint";
import { LongTerm } from "@/sections/LongTerm";
import { Gantt } from "@/sections/Gantt";
import { Reminders } from "@/sections/Reminders";

type Tab = "today" | "sprint" | "long" | "gantt" | "reminders";

const TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "sprint", label: "Sprint" },
  { id: "long", label: "Long-term" },
  { id: "gantt", label: "Gantt" },
  { id: "reminders", label: "Reminders" },
];

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function greeting(d: Date) {
  const h = d.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function App() {
  const now = useClock();
  const [tab, setTab] = useState<Tab>("today");

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="greeting">{greeting(now)}.</div>
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

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? "tab-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {tab === "today" && <Today />}
        {tab === "sprint" && <Sprint />}
        {tab === "long" && <LongTerm />}
        {tab === "gantt" && <Gantt />}
        {tab === "reminders" && <Reminders />}
      </main>
    </div>
  );
}
