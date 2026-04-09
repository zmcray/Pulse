import { useEffect, useState } from "react";
import TaskRow from "./TaskRow.jsx";
import {
  formatTimeRange,
  minutesRemaining,
} from "../utils/calendarHelpers.js";

const WORKSTREAM_COLORS = {
  "Forge Reps": "bg-[#e8f0fb] text-[#2c5fa3]",
  "Concept Cards": "bg-[#e8f0fb] text-[#2c5fa3]",
  "Verbal Fluency": "bg-[#e8f0fb] text-[#2c5fa3]",
  "Signal Synthesis": "bg-[#f0ebfb] text-[#5c3da8]",
  "Thesis Pressure-Testing": "bg-[#f0ebfb] text-[#5c3da8]",
  "Roadmap Planning": "bg-[#f0ebfb] text-[#5c3da8]",
  "CRM Review & Outreach": "bg-[#fef1e8] text-[#a0521c]",
  "Call Prep/Debrief": "bg-[#fef1e8] text-[#a0521c]",
  "Network Mapping": "bg-[#fef1e8] text-[#a0521c]",
  "Company Formation": "bg-[#fef3e2] text-[#a06010]",
  "Go-to-Market": "bg-[#fef3e2] text-[#a06010]",
  "Case Study Work": "bg-[#fef3e2] text-[#a06010]",
  "Productization": "bg-[#fef3e2] text-[#a06010]",
  "Content": "bg-[#fef3e2] text-[#a06010]",
  "System Health": "bg-[#f0f0ee] text-[#505050]",
  "Skill Refinement": "bg-[#f0f0ee] text-[#505050]",
  "Feedback & Memory": "bg-[#f0f0ee] text-[#505050]",
  "Web Development": "bg-[#e8f4f4] text-[#2a6b6b]",
  "App Development": "bg-[#e8f4f4] text-[#2a6b6b]",
  "Agents": "bg-[#e8f4f4] text-[#2a6b6b]",
  "Automation & APIs": "bg-[#e8f4f4] text-[#2a6b6b]",
  "Cowork": "bg-[#e8f4f4] text-[#2a6b6b]",
  "Core Stack": "bg-[#e8f4f4] text-[#2a6b6b]",
};

function getWorkstreamColor(ws) {
  return WORKSTREAM_COLORS[ws] || "bg-surface-2 text-text-muted";
}

function getUniqueWorkstreams(tasks) {
  const seen = new Set();
  return tasks
    .map((t) => t.workstream)
    .filter((ws) => {
      if (!ws || seen.has(ws)) return false;
      seen.add(ws);
      return true;
    });
}

/**
 * Live ticker for "X min left" indicator on the current workblock.
 * Scoped here so only the current block re-renders every 60 sec,
 * not the whole dashboard.
 */
function useMinutesLeft(calendarWorkblock, isCurrent) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!isCurrent) return;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [isCurrent]);
  if (!isCurrent || !calendarWorkblock) return null;
  return minutesRemaining(calendarWorkblock, now);
}

export default function WorkblockGroup({
  workblock,
  tasks,
  calendarWorkblock,
  isCurrent = false,
}) {
  const workstreams = getUniqueWorkstreams(tasks);
  const minsLeft = useMinutesLeft(calendarWorkblock, isCurrent);

  const minsLeftColor = minsLeft !== null && minsLeft < 5
    ? "text-accent"
    : "text-text-muted";

  const cardClasses = isCurrent
    ? "flex-1 ml-3.5 bg-surface-card border border-border-2 border-l-[3px] border-l-accent rounded-[10px] px-4 py-3.5 hover:border-text-muted hover:shadow-sm transition-all"
    : "flex-1 ml-3.5 bg-surface-card border border-border-2 rounded-[10px] px-4 py-3.5 hover:border-text-muted hover:shadow-sm transition-all";

  return (
    <div
      className="flex gap-0 items-start relative pb-4"
      data-workblock={workblock}
    >
      {/* Timeline dot */}
      <div className="flex-shrink-0 mt-[18px] z-10">
        <div className="w-2.5 h-2.5 rounded-full bg-surface-card border-2 border-border" />
      </div>

      {/* Block card */}
      <div className={cardClasses}>
        <div className="flex items-center gap-2 mb-2.5 flex-wrap">
          <span className="font-semibold text-sm tracking-tight">
            {workblock}
          </span>
          {isCurrent && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-[5px] py-px rounded bg-accent text-white">
              NOW
            </span>
          )}
          {isCurrent && minsLeft !== null && minsLeft >= 0 && (
            <span className={`text-[10.5px] font-medium ${minsLeftColor}`}>
              {minsLeft} min left
            </span>
          )}
          {calendarWorkblock && (
            <span className="text-[10.5px] font-medium text-text-muted">
              {formatTimeRange(calendarWorkblock.start, calendarWorkblock.end)}
            </span>
          )}
          {workstreams.map((ws) => (
            <span
              key={ws}
              className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full ${getWorkstreamColor(ws)}`}
            >
              {ws}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      </div>
    </div>
  );
}
