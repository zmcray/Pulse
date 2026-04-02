import { DISPOSITIONS, DISPOSITION_LABELS } from "../utils/constants.js";

export default function TriageRow({ task, disposition, onSetDisposition }) {
  return (
    <div className="bg-surface-card rounded-[10px] border border-border-2 px-4 py-3 flex items-center justify-between gap-4 hover:border-text-muted transition-colors">
      <div className="min-w-0">
        <span className="text-[13px] font-medium">{task.title}</span>
        {task.workstream && (
          <span className="ml-2 text-[10.5px] px-2 py-0.5 rounded-full bg-surface-2 text-text-muted">
            {task.workstream}
          </span>
        )}
      </div>
      <select
        value={disposition}
        onChange={(e) => onSetDisposition(e.target.value)}
        className="text-xs border border-border rounded-lg px-2 py-1.5 bg-surface-card text-text-primary shrink-0 focus:border-accent outline-none"
      >
        <option value="">Choose...</option>
        {Object.entries(DISPOSITION_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
