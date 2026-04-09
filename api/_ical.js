import ical from "node-ical";
import { CALENDAR_DENYLIST, WORKBLOCK_ORDER } from "../src/utils/constants.js";
import { normalizeWorkblockName } from "../src/utils/calendarHelpers.js";

/**
 * Singleton iCal client + helpers.
 *
 * Uses Google Calendar's secret iCal feed URL (read-only, no OAuth).
 * The URL is stored in GOOGLE_ICAL_URL env var and contains a secret token.
 * NEVER log the URL itself -- only log status codes.
 */

const ICAL_TIMEOUT_MS = 10_000;

/**
 * Fetch the iCal feed from Google.
 * Returns the raw .ics text on success, null on failure.
 */
export async function fetchIcalFeed() {
  const url = process.env.GOOGLE_ICAL_URL;
  if (!url) {
    console.error("[ical] GOOGLE_ICAL_URL env var not set");
    return null;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ICAL_TIMEOUT_MS);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      // Never log the URL itself -- contains a secret token.
      console.error(`[ical] fetch failed: HTTP ${res.status}`);
      return null;
    }

    return await res.text();
  } catch (err) {
    console.error(`[ical] fetch exception: ${err.message}`);
    return null;
  }
}

/**
 * Parse .ics text and return events that occur today (in America/New_York).
 * Returns an array of normalized event objects with {title, start, end, attendees}.
 * On parse failure, returns an empty array.
 */
export function parseEvents(icsText) {
  if (!icsText) return [];

  let parsed;
  try {
    parsed = ical.sync.parseICS(icsText);
  } catch (err) {
    console.error(`[ical] parse exception: ${err.message}`);
    return [];
  }

  const { startOfDayET, endOfDayET } = todayBoundsET();
  const events = [];

  for (const key in parsed) {
    const event = parsed[key];
    if (event.type !== "VEVENT") continue;

    // Handle recurring events: expand instances that fall within today.
    if (event.rrule) {
      const instances = event.rrule.between(
        new Date(startOfDayET.getTime() - 24 * 60 * 60 * 1000),
        new Date(endOfDayET.getTime() + 24 * 60 * 60 * 1000),
        true,
      );

      for (const instanceStart of instances) {
        // Skip exception dates (canceled instances of a recurrence)
        if (event.exdate) {
          const exKey = instanceStart.toISOString().slice(0, 10);
          if (event.exdate[exKey]) continue;
        }

        const duration = event.end.getTime() - event.start.getTime();
        const instanceEnd = new Date(instanceStart.getTime() + duration);

        if (overlapsToday(instanceStart, instanceEnd, startOfDayET, endOfDayET)) {
          events.push(normalizeEvent(event, instanceStart, instanceEnd));
        }
      }
      continue;
    }

    // Non-recurring event
    if (overlapsToday(event.start, event.end, startOfDayET, endOfDayET)) {
      events.push(normalizeEvent(event, event.start, event.end));
    }
  }

  return events;
}

/**
 * Categorize events into workblocks and calls per the locked rule:
 *   1. Title matches a known workblock name (normalized) -> WORKBLOCK
 *   2. Title contains a denylist keyword -> FILTERED (with debug log)
 *   3. Title contains "Call" OR event has attendees -> CALL
 *   4. Else -> CALL (default for unknown work events / informal meetings)
 */
export function categorizeEvents(events) {
  const workblockNames = Object.keys(WORKBLOCK_ORDER);
  const workblocks = [];
  const calls = [];

  for (const event of events) {
    // Apply the same legacy-name migration used for tasks, so calendar events
    // with old names (e.g., "AI-Learning" -> "AI Intelligence") still match.
    const migratedTitle = normalizeWorkblockName(event.title.trim());
    const titleNormalized = migratedTitle.toLowerCase();

    // 1. Workblock match (normalized comparison)
    const matchedWorkblock = workblockNames.find(
      (name) => name.toLowerCase() === titleNormalized,
    );
    if (matchedWorkblock) {
      workblocks.push({
        name: matchedWorkblock,
        start: formatTimeET(event.start),
        end: formatTimeET(event.end),
        startMs: event.start.getTime(),
      });
      continue;
    }

    // 2. Denylist filter
    const denylistHit = CALENDAR_DENYLIST.find((kw) =>
      titleNormalized.includes(kw.toLowerCase()),
    );
    if (denylistHit) {
      console.warn(`[ical] filtered "${event.title}" (matched "${denylistHit}")`);
      continue;
    }

    // 3. Call: title contains "Call" OR has attendees OR default
    calls.push({
      title: event.title,
      start: formatTimeET(event.start),
      end: formatTimeET(event.end),
      attendees: event.attendees || [],
    });
  }

  // Sort workblocks by actual start time, assign dynamic order
  workblocks.sort((a, b) => a.startMs - b.startMs);
  workblocks.forEach((wb, i) => {
    wb.order = i;
    delete wb.startMs;
  });

  // Sort calls by start time
  calls.sort((a, b) => a.start.localeCompare(b.start));

  return { workblocks, calls };
}

// ───── helpers ─────

function normalizeEvent(event, start, end) {
  const attendees = event.attendee
    ? Array.isArray(event.attendee)
      ? event.attendee.map((a) => (typeof a === "string" ? a : a.val || ""))
      : [typeof event.attendee === "string" ? event.attendee : event.attendee.val || ""]
    : [];

  return {
    title: event.summary || "Untitled",
    start: new Date(start),
    end: new Date(end),
    attendees,
  };
}

function todayBoundsET() {
  // Get today's date in America/New_York
  const now = new Date();
  const etDateStr = now.toLocaleDateString("en-US", { timeZone: "America/New_York" });
  const [month, day, year] = etDateStr.split("/").map(Number);

  // Construct ET midnight as UTC equivalents using Intl trickery
  const startOfDayET = new Date(
    Date.UTC(year, month - 1, day, etOffsetHours(), 0, 0),
  );
  const endOfDayET = new Date(startOfDayET.getTime() + 24 * 60 * 60 * 1000 - 1);

  return { startOfDayET, endOfDayET };
}

function etOffsetHours() {
  // ET = UTC-5 (EST) or UTC-4 (EDT). Determine which we're in right now.
  const now = new Date();
  const utcHours = now.getUTCHours();
  const etHours = parseInt(
    now.toLocaleString("en-US", { timeZone: "America/New_York", hour: "2-digit", hour12: false }),
    10,
  );
  let diff = utcHours - etHours;
  if (diff < 0) diff += 24;
  return diff;
}

function overlapsToday(start, end, startOfDay, endOfDay) {
  return start <= endOfDay && end >= startOfDay;
}

function formatTimeET(date) {
  return date.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
