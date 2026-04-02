import { useTasksState, useTasksDispatch } from "./contexts/TasksContext.jsx";
import Header from "./components/Header.jsx";
import Sidebar from "./components/Sidebar.jsx";
import WorkblockGroup from "./components/WorkblockGroup.jsx";
import EmptyState from "./components/EmptyState.jsx";
import TriagePanel from "./components/TriagePanel.jsx";
import { WORKBLOCK_ORDER } from "./utils/constants.js";

function groupByWorkblock(tasks) {
  const groups = {};
  for (const task of tasks) {
    const wb = task.workblock || "Other";
    if (!groups[wb]) groups[wb] = [];
    groups[wb].push(task);
  }

  return Object.entries(groups).sort(([a], [b]) => {
    const orderA = WORKBLOCK_ORDER[a] ?? 999;
    const orderB = WORKBLOCK_ORDER[b] ?? 999;
    return orderA - orderB;
  });
}

export default function App() {
  const { tasks, loading, error, mode } = useTasksState();
  const { refreshTasks } = useTasksDispatch();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-text-muted text-sm">Loading tasks...</div>
      </div>
    );
  }

  if (error && tasks.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface gap-3">
        <p className="text-red text-sm">Failed to load tasks</p>
        <p className="text-text-muted text-xs">{error}</p>
        <button
          onClick={refreshTasks}
          className="text-xs px-3 py-1.5 rounded-lg bg-surface-card border border-border text-text-secondary hover:border-text-muted transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  const workblockGroups = groupByWorkblock(tasks);

  return (
    <div className="h-screen grid grid-rows-[auto_1fr] grid-cols-[280px_1fr] [grid-template-areas:'header_header''sidebar_main']">
      <Header />

      <Sidebar />

      <main className="[grid-area:main] overflow-y-auto py-5 px-6">
        {error && (
          <div className="bg-[#fef1ee] border border-red/20 rounded-lg px-4 py-2.5 mb-4 text-xs text-red">
            Notion sync issue: {error}. Showing cached data.
          </div>
        )}

        {mode === "triage" ? (
          <TriagePanel />
        ) : tasks.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="text-[10px] font-semibold tracking-[0.08em] uppercase text-text-muted mb-4">
              Day Dashboard
            </div>
            <div className="relative">
              <div className="absolute left-[3px] top-5 bottom-5 w-0.5 bg-border z-0" />
              <div className="relative z-1">
                {workblockGroups.map(([workblock, wbTasks]) => (
                  <WorkblockGroup
                    key={workblock}
                    workblock={workblock}
                    tasks={wbTasks}
                  />
                ))}
              </div>
            </div>
          </>
        )}
        <div className="h-10" />
      </main>
    </div>
  );
}
