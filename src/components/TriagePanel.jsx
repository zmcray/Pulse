import { useTasksState } from "../contexts/TasksContext.jsx";
import TriageRow from "./TriageRow.jsx";
import TriageConfirmBar from "./TriageConfirmBar.jsx";
import useTriage from "../hooks/useTriage.js";
import { STATUSES } from "../utils/constants.js";

export default function TriagePanel() {
  const { tasks } = useTasksState();

  const incomplete = tasks.filter(
    (t) => t.status !== STATUSES.DONE && t.status !== STATUSES.DROPPED,
  );

  const triage = useTriage(incomplete);

  if (incomplete.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-3xl mb-3 opacity-60">✓</div>
        <h2 className="text-base font-medium text-text-primary mb-1.5">
          All tasks complete
        </h2>
        <p className="text-xs text-text-muted">Nothing to triage today.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-text-primary">
          EOD Triage
        </h2>
        <p className="text-xs text-text-secondary mt-0.5">
          {incomplete.length} incomplete{" "}
          {incomplete.length === 1 ? "task" : "tasks"}. Choose what happens
          next.
        </p>
      </div>
      <div className="space-y-2 mb-24">
        {incomplete.map((task) => (
          <TriageRow
            key={task.id}
            task={task}
            disposition={triage.dispositions[task.id] || ""}
            onSetDisposition={(action) =>
              triage.setDisposition(task.id, action)
            }
          />
        ))}
      </div>
      <TriageConfirmBar
        total={incomplete.length}
        assigned={triage.assignedCount}
        loading={triage.loading}
        error={triage.error}
        onConfirm={triage.confirmAll}
      />
    </div>
  );
}
