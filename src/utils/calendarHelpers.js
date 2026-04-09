/**
 * Pure helpers for calendar-driven workblock display.
 *
 * No side effects, no React, no fetch. All time math goes through here so
 * it can be unit tested in isolation.
 */

/**
 * Find the workblock the user is currently in, given a list of workblocks
 * and a Date.
 *
 * Workblocks have shape: { name, start: "HH:MM", end: "HH:MM", order }
 * (the times come from the calendar API, normalized to 24h).
 *
 * Returns the matching workblock or null if not in one.
 *
 *   findCurrentWorkblock([{name:"AI-Building", start:"10:15", end:"12:30"}], at("10:45"))
 *   -> {name:"AI-Building", ...}
 *
 *   findCurrentWorkblock([...], at("13:00"))
 *   -> null  (between blocks)
 */
export function findCurrentWorkblock(workblocks, now) {
  if (!workblocks || workblocks.length === 0) return null;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (const wb of workblocks) {
    const startMinutes = parseHHMM(wb.start);
    const endMinutes = parseHHMM(wb.end);
    if (nowMinutes >= startMinutes && nowMinutes < endMinutes) {
      return wb;
    }
  }
  return null;
}

/**
 * Minutes remaining in the given workblock, relative to `now`.
 * Returns 0 at exactly the end, negative if `now` is past the end
 * (caller should filter — usually means findCurrentWorkblock returned null).
 *
 *   minutesRemaining({end:"10:15"}, at("09:45")) -> 30
 *   minutesRemaining({end:"10:15"}, at("10:15")) -> 0
 */
export function minutesRemaining(workblock, now) {
  if (!workblock) return null;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const endMinutes = parseHHMM(workblock.end);
  return endMinutes - nowMinutes;
}

/**
 * Migrate stale workblock names to their current canonical form.
 * Only used when reading legacy task data — calendar events are matched
 * against constants.js workblock names directly, so this is for tasks only.
 *
 *   normalizeWorkblockName("AI-Learning") -> "AI Intelligence"
 *   normalizeWorkblockName("PE Networking") -> "Business Development"
 *   normalizeWorkblockName("AI-Building") -> "AI-Building"
 */
const NAME_MIGRATIONS = {
  "AI-Learning": "AI Intelligence",
  "PE Networking": "Business Development",
};

export function normalizeWorkblockName(name) {
  if (!name) return name;
  return NAME_MIGRATIONS[name] ?? name;
}

/**
 * Format a "HH:MM" 24h string as a 12h time for display.
 *   formatTimeRange("08:30", "08:45") -> "8:30 - 8:45 AM"
 *   formatTimeRange("14:00", "15:30") -> "2:00 - 3:30 PM"
 *   formatTimeRange("11:30", "12:30") -> "11:30 AM - 12:30 PM"
 */
export function formatTimeRange(start, end) {
  if (!start || !end) return "";
  const startParts = formatTime12(start);
  const endParts = formatTime12(end);
  if (startParts.suffix === endParts.suffix) {
    return `${startParts.time} - ${endParts.time} ${endParts.suffix}`;
  }
  return `${startParts.time} ${startParts.suffix} - ${endParts.time} ${endParts.suffix}`;
}

// ───── internal helpers ─────

function parseHHMM(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function formatTime12(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const minStr = m === 0 ? "" : `:${String(m).padStart(2, "0")}`;
  return { time: `${hour12}${minStr || ":00"}`, suffix };
}
