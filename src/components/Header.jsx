import { useTasksState, useTasksDispatch } from "../contexts/TasksContext.jsx";
import ProgressBar from "./ProgressBar.jsx";
import { STATUSES } from "../utils/constants.js";
import { todayISO, formatDate } from "../utils/dates.js";

export default function Header() {
  const { tasks, mode } = useTasksState();
  const { setMode, refreshTasks } = useTasksDispatch();

  const completed = tasks.filter((t) => t.status === STATUSES.DONE).length;
  const total = tasks.length;

  const incomplete = tasks.filter(
    (t) => t.status !== STATUSES.DONE && t.status !== STATUSES.DROPPED,
  );

  return (
    <header className="sticky top-0 z-10 bg-surface border-b border-border">
      <ProgressBar completed={completed} total={total} />
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Pulse</h1>
            <p className="text-sm text-text-secondary">{formatDate(todayISO())}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary">
              {completed} of {total} done
            </span>
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
                className="text-sm px-3 py-1.5 rounded-lg bg-warning/10 text-warning font-medium hover:bg-warning/20 transition-colors"
              >
                EOD Triage
              </button>
            )}
            {mode === "triage" && (
              <button
                onClick={() => setMode("normal")}
                className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 text-text-secondary font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
