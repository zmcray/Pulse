import { fetchIcalFeed, parseEvents, categorizeEvents } from "../_ical.js";

/**
 * GET /api/calendar
 *
 * Returns today's calendar events split into workblocks and calls.
 *
 * On any failure, returns empty arrays so the frontend can fall back to
 * the static workblock order. Frontend shows a disconnect banner when
 * `error` is non-null.
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const icsText = await fetchIcalFeed();
    if (!icsText) {
      // fetchIcalFeed already logged the cause
      res.status(200).json({
        workblocks: [],
        calls: [],
        error: "calendar_unavailable",
      });
      return;
    }

    const events = parseEvents(icsText);
    const { workblocks, calls } = categorizeEvents(events);

    res.status(200).json({ workblocks, calls, error: null });
  } catch (err) {
    console.error(`[api/calendar] unexpected: ${err.message}`);
    res.status(200).json({
      workblocks: [],
      calls: [],
      error: "calendar_unavailable",
    });
  }
}
