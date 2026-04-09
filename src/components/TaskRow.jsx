import { useTasksDispatch } from "../contexts/TasksContext.jsx";
import InlineNotes from "./InlineNotes.jsx";
import { STATUSES } from "../utils/constants.js";

export default function TaskRow({ task }) {
  const { updateStatus } = useTasksDispatch();
  const isDone = task.status === STATUSES.DONE;
  const isDropped = task.status === STATUSES.DROPPED;

  function handleToggle() {
    if (isDropped) return;
    updateStatus(task.id, isDone ? STATUSES.NOT_STARTED : STATUSES.DONE);
  }

  return (
    <div>
      <div
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggle();
          }
        }}
        role="checkbox"
        aria-checked={isDone}
        tabIndex={0}
        className={`flex items-start gap-2.5 py-1 px-1.5 -mx-1.5 rounded cursor-pointer transition-colors hover:bg-surface-2 ${
          isDropped ? "opacity-40 cursor-default" : ""
        }`}
      >
        {/* Checkbox */}
        <div
          className={`w-4 h-4 rounded border-[1.5px] flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${
            isDone
              ? "bg-green border-green"
              : "bg-surface-card border-border"
          }`}
        >
          {isDone && (
            <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
              <path
                d="M1 3L3 5L7 1"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        {/* Task text */}
        <span
          className={`text-[13px] leading-snug flex-1 transition-colors ${
            isDone
              ? "text-text-muted line-through decoration-text-muted"
              : "text-text-primary"
          }`}
        >
          {task.title}
        </span>

        {/* Badges */}
        {task.rolloverCount >= 2 && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#fef1ee] text-red flex-shrink-0 self-center">
            ↻ {task.rolloverCount}
          </span>
        )}
      </div>

      {task.error && (
        <p className="text-[11px] text-red ml-[26px] mt-0.5">
          Sync failed: {task.error}
        </p>
      )}

      <div className="ml-[26px]">
        <InlineNotes taskId={task.id} initialNotes={task.notes || ""} />
      </div>
    </div>
  );
}
