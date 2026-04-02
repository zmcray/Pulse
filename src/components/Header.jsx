import { useTasksState, useTasksDispatch } from "../contexts/TasksContext.jsx";
import { STATUSES } from "../utils/constants.js";
import { todayISO, formatDate } from "../utils/dates.js";

export default function Header() {
  const { tasks, mode } = useTasksState();
  const { setMode, refreshTasks } = useTasksDispatch();

  const completed = tasks.filter((t) => t.status === STATUSES.DONE).length;
  const total = tasks.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  const incomplete = tasks.filter(
    (t) => t.status !== STATUSES.DONE && t.status !== STATUSES.DROPPED,
  );

  return (
    <header className="flex items-center justify-between px-6 py-3.5 border-b border-border bg-surface-card">
      <div className="flex items-baseline gap-3">
        <span className="text-[1.1rem] font-semibold tracking-tight text-text-primary">
          Pulse
        </span>
        <span className="text-[0.8rem] text-text-muted">
          {formatDate(todayISO())}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {/* Progress pill */}
        <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-full px-3.5 py-1.5 text-xs text-text-secondary">
          <span>Tasks</span>
          <div className="w-20 h-1 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span>
            <span className="font-semibold text-text-primary">{completed}</span>
            &thinsp;/&thinsp;{total}
          </span>
        </div>

        <button
          onClick={refreshTasks}
          className="text-sm text-text-muted hover:text-text-secondary transition-colors"
          title="Refresh"
        >
          ↻
        </button>

        {mode === "normal" && incomplete.length > 0 && (
          <button
            onClick={() => setMode("triage")}
            className="text-xs px-3 py-1.5 rounded-lg bg-orange/10 text-orange font-medium hover:bg-orange/20 transition-colors"
          >
            EOD Triage
          </button>
        )}
        {mode === "triage" && (
          <button
            onClick={() => setMode("normal")}
            className="text-xs px-3 py-1.5 rounded-lg bg-surface-2 text-text-secondary font-medium hover:bg-border transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </header>
  );
}
