---
title: Google Calendar Read-Only Integration via Secret iCal Feed (Skip OAuth)
category: integration-issues
date: 2026-04-08
tags: [google-calendar, ical, oauth-alternative, read-only, vercel-functions, single-user, node-ical, first-principles, integration-pattern]
severity: decision
component: api/_ical.js, api/calendar/index.js
framework: Vercel Serverless Functions, node-ical
---

# Google Calendar Read-Only Integration via Secret iCal Feed (Skip OAuth)

## Problem

The original Pulse Phase 2 plan defaulted to OAuth2 + `googleapis` SDK for Google Calendar access because that is the conventional Google API path. For a single-user, read-only dashboard this would have burned roughly 10 hours of effort on Google Cloud project setup, OAuth consent screen review, refresh token plumbing, and a ~50MB SDK bundled into Vercel Serverless Functions. On top of that, refresh tokens for apps in "testing" mode expire every 7 days, which would have forced an app-publishing workflow just to keep a personal tool alive.

Symptoms of the wasted-effort scenario:
- ~10h planned for Google Cloud project + OAuth scaffold for one user
- ~50MB SDK in Vercel Functions for what amounted to a list-events call
- 7-day refresh-token expiry trap in testing mode
- Ongoing maintenance: token refresh logic, consent screen updates, scope review

## Root Cause

The plan defaulted to the conventional auth pattern without asking the two disqualifying questions first:

1. Do we need WRITE access?
2. Do we have MULTIPLE users?

For Pulse, both answers were **no**. That made OAuth massive overkill -- all the machinery of OAuth exists primarily to delegate access between users and to authorize mutations. A single user who only reads their own calendar needs neither.

**The eureka:** For single-user read-only Google Calendar access, Google Calendar's built-in "Secret address in iCal format" feed solves the exact same problem with a single environment variable and a plain `fetch` call. No OAuth flow, no refresh tokens, no Google Cloud project, no SDK dependency. The "iCal" in the name is a file format (iCalendar / `.ics`), not Apple's app.

## Solution

### Decision framework (ask BEFORE reaching for OAuth)

1. Do I need to WRITE data, or only READ it? (Write almost always needs OAuth; read often does not.)
2. Is this single-user, or multi-user? (OAuth exists to delegate between users. One user = no delegation needed.)
3. Does the service expose a "share as link" or "publish to web" feature in its UI? If yes, that link IS the API — treat it as a credential and use it directly.
4. Is real-time accuracy critical, or is eventual consistency (cached feed, polled every N minutes) acceptable? Feed URLs are usually cached by the provider; OAuth APIs return live state.
5. What is the cost of OAuth here? (Client registration, consent screen, token refresh logic, secret rotation, scope review, redirect URIs.) If that cost exceeds the value of live writes or multi-user support, you are overbuilding.

### Implementation steps

1. **Grab the secret iCal URL from Google Calendar desktop.** (auto memory [claude]) Note: for Workspace accounts like `zack@mcraygroup.co`, the Workspace admin must enable external sharing (Admin console → Apps → Google Workspace → Calendar → Sharing settings) or the "Secret address" option will not appear.
   - Settings → Settings for my calendars → pick calendar → "Integrate calendar" section → "Secret address in iCal format"
   - **NOT** the "Public address" — that one is only available when the calendar is public.
   - Treat it as a credential: it contains a secret token that grants read access to anyone who has the URL.

2. **Store the URL in `GOOGLE_ICAL_URL` env var.** Never log it. Never commit it. Add to Vercel env vars (production + preview).

3. **Install `node-ical`** (`npm install node-ical`). Handles `VEVENT`, recurrence rules (`RRULE`), and exception dates (`EXDATE`) out of the box. ~30KB, MIT licensed, stable.

4. **Build a 3-step pipeline in `api/_ical.js`:** `fetchIcalFeed()` → `parseEvents()` → `categorizeEvents()`. Each step returns empty/null on failure so the HTTP endpoint can degrade gracefully to a static fallback.

5. **Categorize by title pattern (NOT color).** Google's iCal export strips calendar colors — they are UI-only metadata. Categorize by event title matching a known workblock name, with a denylist for personal events and a "default to call" fallback.

6. **Do all time math in `America/New_York`.** Expand recurring events within a 48-hour window around today's ET bounds, then filter to events that overlap today. Hand-roll the ET offset using `Intl.DateTimeFormat` since Node has no native zoned-time type.

7. **Make the HTTP endpoint always return 200** with `{workblocks, calls, error}`. On any failure set `error: "calendar_unavailable"` and return empty arrays so the frontend shows a disconnect banner instead of crashing.

### Code examples

**Env var pattern + credential-safe fetch** (`api/_ical.js`, lines 19-44):

```js
const ICAL_TIMEOUT_MS = 10_000;

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
```

**Title-pattern categorization** (`api/_ical.js`, lines 110-164):

```js
export function categorizeEvents(events) {
  const workblockNames = Object.keys(WORKBLOCK_ORDER);
  const workblocks = [];
  const calls = [];

  for (const event of events) {
    const migratedTitle = normalizeWorkblockName(event.title.trim());
    const titleNormalized = migratedTitle.toLowerCase();

    // 1. Workblock match
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

    // 3. Call (default for work events with attendees or informal meetings)
    calls.push({
      title: event.title,
      start: formatTimeET(event.start),
      end: formatTimeET(event.end),
      attendees: event.attendees || [],
    });
  }

  workblocks.sort((a, b) => a.startMs - b.startMs);
  workblocks.forEach((wb, i) => { wb.order = i; delete wb.startMs; });
  calls.sort((a, b) => a.start.localeCompare(b.start));
  return { workblocks, calls };
}
```

**The denylist constant** (`src/utils/constants.js`, lines 52-65):

```js
export const CALENDAR_DENYLIST = [
  "Lunch", "Family", "Doctor", "Personal", "Errand",
  "School", "Wrap-Up", "Week Wrap", "Workout", "Gym",
  "Dentist", "Appointment",
];
```

**HTTP endpoint with graceful degradation** (`api/calendar/index.js`):

```js
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const icsText = await fetchIcalFeed();
    if (!icsText) {
      res.status(200).json({ workblocks: [], calls: [], error: "calendar_unavailable" });
      return;
    }
    const events = parseEvents(icsText);
    const { workblocks, calls } = categorizeEvents(events);
    res.status(200).json({ workblocks, calls, error: null });
  } catch (err) {
    console.error(`[api/calendar] unexpected: ${err.message}`);
    res.status(200).json({ workblocks: [], calls: [], error: "calendar_unavailable" });
  }
}
```

**Env var documentation** (`.env.example`):

```
# Get your secret iCal URL from Google Calendar:
#   1. Open Google Calendar in a desktop browser (not the mobile app)
#   2. Settings -> Settings for my calendars -> pick your work calendar
#   3. Scroll to "Integrate calendar"
#   4. Copy "Secret address in iCal format" (NOT the public address)
# This URL contains a secret token -- treat it as a credential.
GOOGLE_ICAL_URL=https://calendar.google.com/calendar/ical/.../basic.ics
```

## Caveats and Tradeoffs Accepted

- **Read-only forever.** The iCal feed has no write path. Creating, updating, or deleting events requires OAuth. Acceptable for Pulse because it is a viewer.
- **Google CDN caches the feed for 5-10 minutes.** Events created in Google Calendar will not appear in Pulse until the cache expires. Acceptable for a daily-morning planning tool.
- **Mobile Google Calendar app does not expose the secret URL.** Initial setup must happen in a desktop browser.
- **Workspace admins can disable the "secret iCal URL" feature** via external sharing settings. If that happens, this approach breaks and OAuth becomes the only option.
- **Google Calendar event colors are NOT exported in iCal.** Discovered during planning — forced a pivot from color-based categorization to title-pattern categorization. Workblocks must be named exactly to match the `WORKBLOCK_ORDER` keys, with legacy names handled via `normalizeWorkblockName()` in `src/utils/calendarHelpers.js`.
- **URL must never be logged.** Only status codes and error messages. Any log statement that could interpolate the URL is a credential leak.
- **Timezone math is hand-rolled** around `Intl.DateTimeFormat` because Node has no native zoned-time type. The `etOffsetHours()` helper auto-handles EST/EDT transitions but is subtle — worth a unit test if this ever moves off ET.

## When OAuth IS the Right Call

Use OAuth (and eat the complexity) when:

- You need to WRITE data: create events, send emails, upload files, modify sheets.
- Multi-user app: each user authenticates with their own Google account and grants access to their own data.
- You need fine-grained scope control (`calendar.readonly` vs `calendar.events.readonly`) or the ability to revoke per-user.
- You need webhooks, push notifications, or watch channels that require a registered OAuth client.
- You need access to private data that has no "share link" equivalent (Gmail inbox contents, Drive private files, Contacts).
- Compliance requirements mandate per-user consent trails and revocable tokens.
- You are shipping to other people — even if YOU could use a feed URL, they cannot share theirs with you.

## Similar Patterns (services with read-only shortcuts)

- **Google Sheets**: "Publish to web" as CSV/TSV/HTML. Plain HTTP GET, no auth.
- **Google Docs**: "Publish to web" as HTML, or `/export?format=txt` on a published doc.
- **Google Drive**: public sharing links + `uc?export=download&id=FILE_ID` for direct file download.
- **Google Maps / Static Maps / Embed**: API key only, no OAuth.
- **Google Forms**: public response CSV export via linked published Sheet.
- **YouTube Data API**: video metadata, public playlists via API key.
- **Google Fonts, Books, Custom Search**: all API-key-only for read access.
- **Notion**: public page URLs, public databases (read-only without integration token).
- **Airtable**: public share links.
- **GitHub**: `raw.githubusercontent.com` for public files.

The broader pattern: most SaaS tools have a "share link" or "publish" escape hatch that bypasses OAuth for read-only use.

## Security Best Practices for Secret Feed URLs

- Treat the secret feed URL as a credential equivalent to an API key or password.
- Store in `.env` for local dev, Vercel env vars for prod. Never commit. Verify `.env` is in `.gitignore`.
- Access only from server-side code (API routes, server components, edge functions). Never ship to the browser bundle.
- Never log the full URL. Log `HTTP ${res.status}` instead.
- Never include the URL in error messages surfaced to the client, Sentry, or Vercel logs.
- Rotate the URL if exposed: Google Calendar settings → "Reset" the secret address. Treat rotation as a credential rotation event.
- Set a clear comment in `.env.example` explaining this is a secret, not a public URL.
- Consider a read-through cache (KV, in-memory, or Vercel Data Cache) so you are not hitting Google on every request — also reduces log surface area.

## Verification Strategy

End-to-end verification without mocking the external service:

1. **Write a throwaway Node script** that loads the env var, fetches the URL, and prints the first few VEVENT blocks. ~20 lines, no framework, no mocks.
2. **Confirm the response is real iCal** (starts with `BEGIN:VCALENDAR`) and parse with `node-ical` to verify event count matches the Google Calendar UI.
3. **Create a known test event** in your calendar, wait ~5-10 minutes for the feed cache, rerun the script, confirm the event appears. Proves the full loop end-to-end.
4. **Add observability** — log `{ status, eventCount, durationMs }` for each feed fetch with the URL redacted. If the feed ever breaks, you see it immediately instead of debugging from a silent empty calendar.
5. **Delete or archive** the throwaway script after verification. Do not leave verification code scattered in app files.

For Pulse, the verification used a throwaway `scripts/verify-calendar.mjs` script that was deleted after confirming the pipeline. Result: 76 KB feed, 8 events parsed, 5 workblocks correctly categorized, 2 events correctly filtered by denylist (Lunch + Flex, Wrap-Up), 1 Zoom meeting correctly identified as a call.

## The One-Line Rule

**Before reaching for OAuth on any Google (or SaaS) integration, ask "is this single-user read-only?" If yes, check the product's share/publish/export UI first, because the share link IS the API and will save you hours of OAuth plumbing.**

## Related Docs

- **Phase 1 plan**: [`docs/plans/2026-04-01-001-feat-core-daily-dashboard-plan.md`](../../plans/2026-04-01-001-feat-core-daily-dashboard-plan.md) — Establishes the "API key in env vars, no auth UI" single-user pattern that this iCal decision extends. Explicitly defers Google Calendar to Phase 2.
- **Sibling integration doc**: [`docs/solutions/integration-issues/vercel-spa-rewrite-intercepting-api-routes.md`](./vercel-spa-rewrite-intercepting-api-routes.md) — The new `api/calendar/index.js` serverless function depends on the SPA rewrite fix to be reachable at all.
- **Sibling runtime doc**: [`docs/solutions/runtime-errors/notion-status-vs-select-property-type.md`](../runtime-errors/notion-status-vs-select-property-type.md) — Other major external API integration in Pulse. Different failure mode but same "single-user credential in env var" pattern.

## Related Patterns in the Pulse Codebase

- **"Env var credential" pattern**: Both `NOTION_API_KEY` and `GOOGLE_ICAL_URL` use the same approach — single-user secret stored in env vars, accessed only server-side via `process.env`, never exposed to the client.
- **"Read-only integration" pattern**: Pulse intentionally uses the lowest-privilege, simplest auth for each external API. Notion is read/write via API key (writes required for status/notes); Google Calendar is read-only via secret iCal URL.
- **"Server-only secrets, never logged" pattern**: Log HTTP status codes, never log URLs or keys. Convention applies to both `api/_ical.js` and `api/_notion.js`.
- **`api/_<name>.js` file convention**: Underscore-prefixed files are shared helpers, not routable endpoints. Routable endpoints live at `api/tasks/index.js`, `api/triage.js`, `api/calendar/index.js`.
- **"Single-user simplification" heuristic**: Because Pulse has exactly one user, OAuth's multi-tenant machinery (consent screens, refresh tokens, per-user scopes) is dead weight. This iCal decision is a specific instance of the broader "skip OAuth when single-user + read-only" rule.
