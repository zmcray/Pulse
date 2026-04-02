export const STATUSES = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  BLOCKED: "Blocked",
  DROPPED: "Dropped",
};

export const STATUS_CYCLE = [
  STATUSES.NOT_STARTED,
  STATUSES.IN_PROGRESS,
  STATUSES.DONE,
];

export const STATUS_COLORS = {
  [STATUSES.NOT_STARTED]: "bg-status-not-started",
  [STATUSES.IN_PROGRESS]: "bg-status-in-progress",
  [STATUSES.DONE]: "bg-status-done",
  [STATUSES.BLOCKED]: "bg-status-blocked",
  [STATUSES.DROPPED]: "bg-status-dropped",
};

export const STATUS_TEXT_COLORS = {
  [STATUSES.NOT_STARTED]: "text-status-not-started",
  [STATUSES.IN_PROGRESS]: "text-status-in-progress",
  [STATUSES.DONE]: "text-status-done",
  [STATUSES.BLOCKED]: "text-status-blocked",
  [STATUSES.DROPPED]: "text-status-dropped",
};

export const WORKBLOCK_ORDER = {
  "Morning Launch": 0,
  "PE Learning": 1,
  "Strategy": 2,
  "AI-Learning": 3,
  "AI-Building": 4,
  "PE Networking": 5,
  "McRayGroup": 6,
  "SMB Search": 7,
  "OS": 8,
};

export const DISPOSITIONS = {
  RESCHEDULE_TOMORROW: "reschedule_tomorrow",
  PUSH_NEXT_WEEK: "push_next_week",
  DROP: "drop",
  WORK_LATE: "work_late",
};

export const DISPOSITION_LABELS = {
  [DISPOSITIONS.RESCHEDULE_TOMORROW]: "Reschedule Tomorrow",
  [DISPOSITIONS.PUSH_NEXT_WEEK]: "Push to Next Week",
  [DISPOSITIONS.DROP]: "Drop",
  [DISPOSITIONS.WORK_LATE]: "Work Late",
};
