import { useTasksState, useTasksDispatch } from "../contexts/TasksContext.jsx";
import { useView } from "../contexts/ViewContext.jsx";
import { useBuildPipelineDispatch } from "../contexts/BuildPipelineContext.jsx";
import { STATUSES } from "../utils/constants.js";
import { todayISO, formatDate } from "../utils/dates.js";

export default function Header() {
  const { tasks, mode } = useTasksState();
  const { setMode, refreshTasks } = useTasksDispatch();
  const { view, setView } = useView();
  const { refresh: refreshPipeline } = useBuildPipelineDispatch();

  const completed = tasks.filter((t) => t.status === STATUSES.DONE).length;
  const total = tasks.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  const incomplete = tasks.filter(
    (t) => t.status !== STATUSES.DONE && t.status !== STATUSES.DROPPED,
  );

  const handleRefresh = view === "build" ? refreshPipeline : refreshTasks;

  return (
    <header className="[grid-area:header] flex items-center justify-between px-6 py-3.5 border-b border-border bg-surface-card">
      <div className="flex items-baseline gap-3">
        <span className="text-[1.1rem] font-semibold tracking-tight text-text-primary">
          Pulse
        </span>

        <div className="flex items-center gap-1 ml-1">
          <button
            type="button"
            onClick={() => setView("daily")}
            aria-pressed={view === "daily"}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
              view === "daily"
                ? "bg-surface-2 text-text-primary"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            Daily
          </button>
          <button
            type="button"
            onClick={() => setView("build")}
            aria-pressed={view === "build"}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
              view === "build"
                ? "bg-surface-2 text-text-primary"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            Build
          </button>
        </div>

        <span className="text-[0.8rem] text-text-muted">
          {formatDate(todayISO())}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {view === "daily" && (
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
        )}

        <button
          onClick={handleRefresh}
          className="text-sm text-text-muted hover:text-text-secondary transition-colors"
          title={view === "build" ? "Refresh pipeline" : "Refresh tasks"}
        >
          ↻
        </button>

        {view === "daily" && mode === "normal" && incomplete.length > 0 && (
          <button
            onClick={() => setMode("triage")}
            className="text-[11px] font-semibold px-3.5 py-1.5 rounded-full border border-accent bg-transparent text-accent hover:bg-accent hover:text-white transition-colors"
          >
            EOD Triage
          </button>
        )}
        {view === "daily" && mode === "triage" && (
          <button
            onClick={() => setMode("normal")}
            className="text-[11px] font-semibold px-3.5 py-1.5 rounded-full border border-border bg-transparent text-text-secondary hover:bg-surface-2 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </header>
  );
}
