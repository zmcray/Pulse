import StatusBadge from "./StatusBadge.jsx";
import InlineNotes from "./InlineNotes.jsx";
import { STATUSES } from "../utils/constants.js";

export default function TaskRow({ task }) {
  const isDone = task.status === STATUSES.DONE;
  const isDropped = task.status === STATUSES.DROPPED;

  return (
    <div
      className={`bg-surface-card rounded-lg border border-border px-4 py-3 transition-opacity ${
        isDropped ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <StatusBadge taskId={task.id} status={task.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-medium ${
                isDone ? "line-through text-text-muted" : ""
              } ${isDropped ? "line-through text-text-muted" : ""}`}
            >
              {task.title}
            </span>
            {task.workstream && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-text-muted shrink-0">
                {task.workstream}
              </span>
            )}
            {task.rolloverCount >= 2 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full bg-warning/10 text-warning font-medium shrink-0"
                title={`Rolled over ${task.rolloverCount} times`}
              >
                ↻ {task.rolloverCount}
              </span>
            )}
          </div>
          {task.error && (
            <p className="text-xs text-error mt-1">Sync failed: {task.error}</p>
          )}
          <InlineNotes taskId={task.id} initialNotes={task.notes || ""} />
        </div>
      </div>
    </div>
  );
}
