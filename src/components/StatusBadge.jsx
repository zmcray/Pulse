import { STATUS_COLORS, STATUSES } from "../utils/constants.js";

/**
 * Display-only status badge. Phase 1 left this unused; Phase 2 briefly
 * wired it up for 3-state cycling, then reverted -- TaskRow now owns the
 * 2-state checkbox toggle directly. Keeping this file for potential
 * future use (e.g., read-only task display in reports).
 */
const STATUS_ICONS = {
  [STATUSES.NOT_STARTED]: "○",
  [STATUSES.IN_PROGRESS]: "◐",
  [STATUSES.DONE]: "●",
  [STATUSES.BLOCKED]: "✕",
  [STATUSES.DROPPED]: "—",
};

export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-sm ${STATUS_COLORS[status]} text-white`}
      title={status}
      aria-label={`Status: ${status}`}
    >
      {STATUS_ICONS[status]}
    </span>
  );
}
