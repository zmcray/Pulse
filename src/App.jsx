import { useTasksState } from "./contexts/TasksContext.jsx";
import Header from "./components/Header.jsx";
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-secondary text-sm">Loading tasks...</div>
      </div>
    );
  }

  if (error && tasks.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-error mb-2">Failed to load tasks</p>
          <p className="text-text-secondary text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const workblockGroups = groupByWorkblock(tasks);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-2xl mx-auto px-4 pb-12">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-700">
            Notion sync issue: {error}. Showing cached data.
          </div>
        )}

        {mode === "triage" ? (
          <TriagePanel />
        ) : tasks.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            {workblockGroups.map(([workblock, wbTasks]) => (
              <WorkblockGroup
                key={workblock}
                workblock={workblock}
                tasks={wbTasks}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
