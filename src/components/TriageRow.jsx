import { DISPOSITIONS, DISPOSITION_LABELS } from "../utils/constants.js";

export default function TriageRow({ task, disposition, onSetDisposition }) {
  return (
    <div className="bg-surface-card rounded-lg border border-border px-4 py-3 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <span className="text-sm font-medium">{task.title}</span>
        {task.workstream && (
          <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-text-muted">
            {task.workstream}
          </span>
        )}
      </div>
      <select
        value={disposition}
        onChange={(e) => onSetDisposition(e.target.value)}
        className="text-sm border border-border rounded-lg px-2 py-1.5 bg-white text-text-primary shrink-0"
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
