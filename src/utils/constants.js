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
  [STATUSES.NOT_STARTED]: "bg-text-muted",
  [STATUSES.IN_PROGRESS]: "bg-blue",
  [STATUSES.DONE]: "bg-green",
  [STATUSES.BLOCKED]: "bg-red",
  [STATUSES.DROPPED]: "bg-border",
};

export const STATUS_TEXT_COLORS = {
  [STATUSES.NOT_STARTED]: "text-text-muted",
  [STATUSES.IN_PROGRESS]: "text-blue",
  [STATUSES.DONE]: "text-green",
  [STATUSES.BLOCKED]: "text-red",
  [STATUSES.DROPPED]: "text-text-muted",
};

// Static fallback when calendar data is unavailable.
// Calendar-driven dynamic ordering replaces this when /api/calendar succeeds.
export const WORKBLOCK_ORDER = {
  "Morning Launch": 0,
  "PE Learning": 1,
  "AI Intelligence": 2,
  "Strategy": 3,
  "AI-Building": 4,
  "Business Development": 5,
  "McRayGroup": 6,
  "OS": 7,
};

// Calendar event categorization rule:
//   1. Title matches a known workblock name (normalized) -> WORKBLOCK
//   2. Title contains "Call" OR event has attendees           -> CALL
//   3. Title contains a denylist keyword                      -> FILTERED
//   4. Else                                                   -> CALL (informal meetings)
//
// Edit this list when stray personal events leak into the Calls sidebar.
// Matched case-insensitively as a substring against the event title.
export const CALENDAR_DENYLIST = [
  "Lunch",
  "Family",
  "Doctor",
  "Personal",
  "Errand",
  "School",
  "Wrap-Up",
  "Week Wrap",
  "Workout",
  "Gym",
  "Dentist",
  "Appointment",
];

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
