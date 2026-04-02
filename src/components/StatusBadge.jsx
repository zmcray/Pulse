import { useTasksDispatch } from "../contexts/TasksContext.jsx";
import { STATUS_COLORS, STATUSES } from "../utils/constants.js";

const STATUS_ICONS = {
  [STATUSES.NOT_STARTED]: "○",
  [STATUSES.IN_PROGRESS]: "◐",
  [STATUSES.DONE]: "●",
  [STATUSES.BLOCKED]: "✕",
  [STATUSES.DROPPED]: "—",
};

export default function StatusBadge({ taskId, status }) {
  const { cycleStatus } = useTasksDispatch();

  const isInteractive =
    status !== STATUSES.BLOCKED && status !== STATUSES.DROPPED;

  return (
    <button
      onClick={() => isInteractive && cycleStatus(taskId)}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && isInteractive) {
          e.preventDefault();
          cycleStatus(taskId);
        }
      }}
      className={`mt-0.5 w-6 h-6 flex items-center justify-center rounded-full text-sm transition-colors ${
        isInteractive
          ? "cursor-pointer hover:ring-2 hover:ring-gray-300"
          : "cursor-default"
      } ${STATUS_COLORS[status]} text-white`}
      title={status}
      aria-label={`Status: ${status}. ${isInteractive ? "Click to change." : ""}`}
    >
      {STATUS_ICONS[status]}
    </button>
  );
}
