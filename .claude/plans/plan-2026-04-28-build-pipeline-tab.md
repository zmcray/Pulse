# Plan: Build Pipeline Tab (MCR-86)

- **Linear:** [MCR-86](https://linear.app/mcraygroup/issue/MCR-86/build-pipeline-tab-kanban-view-of-all-projects-pulled-live-from-linear)
- **Project:** Pulse (v1.1 sprint, target 2026-05-05)
- **Tier:** 2 (Significant Feature)
- **Started:** 2026-04-28
- **Branch:** `feat/build-pipeline-tab`
- **Worktree:** `mystifying-yonath-7a3998`

## Task Description

Add a "Build" (or "Pipeline") tab to Pulse that renders a 5-column kanban of all Linear projects, pulled live from the Linear API. Read-only view. Replaces the existing Cowork artifact `build-pipeline` (which gets retired once this ships).

## Why

- Pulse is already the daily ops surface. Consolidates the dashboard there instead of having a separate Cowork-only artifact.
- Works on any device (Vercel-hosted), survives Cowork session boundaries.
- Reinforces the "Pulse = look across, Linear = do work in" mental model.

## Spec (from MCR-86)

### Architecture

- New route/tab in existing nav (sibling to current Daily/Roadmap views)
- Server-side proxy routes (`/api/linear/projects`, `/api/linear/issues`) hit Linear's GraphQL API server-side. **Never expose `LINEAR_API_KEY` client-side.**
- Cache responses in-memory or via Vercel KV with a 60-second TTL. Refresh button to force-fresh.

### Auth / env

- `LINEAR_API_KEY` added to Pulse Vercel env (Production + Preview). Read-only personal API key.

### Data shape

- Pull all projects (include completed, exclude canceled by default).
- Pull all issues across the workspace.
- For each project, parse `**Stage:**` from the description via regex (Linear's native states are too coarse).
- Compute per-project feature progress: `done / total` issues.
- Group issues by `projectId` for click-to-expand view.

### UI

- 5 columns: Idea, Scoped, Building, Live (Beta), Stable
- Cards: icon, name, summary (truncated), owner badge, progress bar (X/Y features), border-left color matches stage (category badge SKIPPED for v1)
- Click card to expand inline → feature list with status dots, link out to Linear
- Top row: stats (Total / Idea / Scoped / Active / Stable counts)
- Filter pills: All / by Owner (Category SKIPPED for v1)
- "Open in Linear" link on each card
- Match Pulse's existing CSS token system (no new design language)

### Acceptance criteria

- [ ] Tab visible in Pulse nav
- [ ] Loads all 14 active projects on page open in under 2 seconds (with cache hit)
- [ ] Stage parsing works correctly across all current projects (verify with Atlas, Forge, Meridian, CGSC)
- [ ] Feature counts match Linear's actual issue counts per project
- [ ] Filter pills work
- [ ] "Open in Linear" links navigate to the correct project
- [ ] Linear API key is NEVER exposed client-side (verify in browser network tab)
- [ ] Cache TTL working (refresh-button bypasses cache)
- [ ] Works on mobile (deferred to MCR-37 if necessary)

### Cleanup once shipped

- [ ] Retire Cowork artifact `build-pipeline` (delete or mark deprecated)
- [ ] Update `00_Context/CLAUDE.md` Build Pipeline section → point at Pulse
- [ ] Update `00_Context/databases.md` (Build Pipeline Dashboard row)
- [ ] Update `00_Context/build-pipeline-feature-seed.md`

## Build Loop Status

- [x] Plan file created
- [x] Branch + baseline tests (5 files, 43 tests passing)
- [x] Move MCR-86 to In Progress in Linear
- [x] /ultraplan
- [x] /plan-eng-review (NEEDS CHANGES → applied as deltas)
- [ ] Micro-task breakdown
- [ ] Implementation
- [ ] /ce:review
- [ ] /ce:compound
- [ ] Commit + PR

---

## Ultraplan Output

### 1. Architecture and data flow

**Decision: single combined `api/linear/index.js` route + `api/_linear.js` GraphQL helper.** (Matches `api/calendar/index.js` + `api/_ical.js` and `api/tasks/index.js` + `api/_notion.js` conventions.)
- One GraphQL doc returns projects + issues. Splitting routes doubles HTTP overhead and forces client to merge.
- 60s cache keyed per-route. One route = one cache slot = one Linear call.
- Page loads as a unit; progressive split not worth the complexity.

**Library choice: raw `fetch`, not `@linear/sdk`.**
- SDK is ~150 KB minified, generated from schema. We need one query — not justified.
- Pulse already uses raw fetch in `api/_ical.js` for the same reason.
- Personal API key auth is one header (NB: no `Bearer` prefix — Linear personal keys go raw in `Authorization`).
- Trade-off: lose typed responses. Compensate with eager normalization and unit tests on fixtures.

**Cache strategy: in-memory module-level `Map`, 60s TTL, `?fresh=1` to bypass, in-flight de-dup, error-resilient, with stale ceiling.**
- Vercel Fluid Compute reuses warm function instances → module state survives cross-request within the warm window. **Per-instance per-region**, not global. Adequate for single-user Pulse.
- KV adds external dependency, latency, credentials for a 60s TTL — overkill.
- Two concurrent `?fresh=1` calls share one promise (no double cold call).
- Failed fetch returns last-known good cache with `stale: true` flag — never poisons the entry.
- **Hard stale ceiling: 5 minutes.** Beyond that, refuse to serve stale data; return error to client and let UI show "Linear unavailable, please retry."
- **Never cache GraphQL partial responses.** If `response.errors` is populated, do NOT write to the cache Map. Serve the failure downstream.

```js
// Sketch in api/_linear.js
const CACHE_TTL_MS = 60_000;
const STALE_MAX_MS = 5 * 60_000;          // hard ceiling for stale fallback
const cache = new Map();
let inFlight = null;

export async function getCachedPipeline({ fresh = false } = {}) {
  const key = "pipeline";
  const now = Date.now();
  const hit = cache.get(key);

  if (!fresh && hit && now - hit.fetchedAt < CACHE_TTL_MS) {
    return { ...hit.data, fetchedAt: hit.fetchedAt, cacheHit: true, stale: false };
  }

  if (inFlight) return inFlight;          // de-dup concurrent callers

  inFlight = (async () => {
    try {
      const result = await fetchPipelineFromLinear();
      // Do NOT cache partial GraphQL responses — serve the failure downstream
      if (result.errors) {
        if (hit && now - hit.fetchedAt < STALE_MAX_MS) {
          return { ...hit.data, fetchedAt: hit.fetchedAt, cacheHit: true, stale: true, error: "graphql_partial" };
        }
        throw new Error("graphql_partial");
      }
      cache.set(key, { data: result.data, fetchedAt: now });
      return { ...result.data, fetchedAt: now, cacheHit: false, stale: false };
    } catch (err) {
      console.error("[linear] fetch failed:", err);
      // Stale fallback only within ceiling
      if (hit && now - hit.fetchedAt < STALE_MAX_MS) {
        return { ...hit.data, fetchedAt: hit.fetchedAt, cacheHit: true, stale: true, error: err.code || err.message || "fetch_failed" };
      }
      throw err;                          // no usable cache → propagate
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
```

**Response shape:**

```ts
type PipelineResponse = {
  projects: Project[];
  issues: Issue[];
  fetchedAt: number;
  cacheHit: boolean;
  error: string | null;
};

type Project = {
  id: string;
  name: string;
  url: string;
  icon: string | null;
  color: string | null;
  description: string;
  stage: Stage;          // already normalized server-side
  summary: string;       // first non-Stage line, ≤140 chars
  state: string;         // Linear's project state name (informational)
  ownerId: string | null;
  ownerName: string | null;
  // category: SKIPPED in v1 (deferred — see plan §11 open questions)
  doneCount: number;
  totalCount: number;
};

type Issue = {
  id: string;
  title: string;
  url: string;
  state: "done" | "in_progress" | "backlog" | "blocked";
  projectId: string | null;
};

type Stage = "Idea" | "Scoped" | "Building" | "Live (Beta)" | "Stable";
```

Server is the normalization boundary. Client never re-runs regex, never re-counts, never re-resolves owner names.

### 2. Stage parsing

```js
// api/_linear.js
export const STAGES = ["Idea", "Scoped", "Building", "Live (Beta)", "Stable"];
const DEFAULT_STAGE = "Idea";
// Match: **Stage:** X | __Stage:__ X | Stage: X
const STAGE_RE = /(?:\*\*|__)?\s*Stage\s*:\s*(?:\*\*|__)?\s*([^\n\r]+)/i;

const STAGE_ALIASES = {
  idea: "Idea",
  scoped: "Scoped",
  building: "Building",
  "live (beta)": "Live (Beta)",
  "live beta": "Live (Beta)",
  beta: "Live (Beta)",
  live: "Live (Beta)",
  stable: "Stable",
  shipped: "Stable",
};

export function parseStage(description) {
  if (!description) return DEFAULT_STAGE;
  const m = description.match(STAGE_RE);
  if (!m) return DEFAULT_STAGE;
  // Strip markdown emphasis (**, __, *), trailing punctuation, normalize whitespace
  const raw = m[1]
    .trim()
    .replace(/^[*_]+|[*_]+$/g, "")          // strip leading/trailing emphasis
    .replace(/[.,;:!?]+$/, "")               // strip trailing punctuation
    .toLowerCase()
    .replace(/\s+/g, " ");
  return STAGE_ALIASES[raw] || DEFAULT_STAGE;
}

export function parseSummary(description) {
  if (!description) return "";
  const lines = description.split(/\r?\n/);
  const firstNonStage = lines.find(
    (l) => l.trim() && !/^(?:\*\*|__)?\s*Stage\s*:/i.test(l.trim())
  );
  return firstNonStage ? firstNonStage.trim().slice(0, 140) : "";
}
```

Edge cases handled: empty/null description → Idea; missing Stage line → Idea; mixed casing; markdown emphasis (`**Building**`, `__Building__`); trailing punctuation (`Building.`); multiple Stage lines (first wins); `**Stage:**` and `__Stage:__` and `Stage:` all match.

### 3. Routing and nav

**Decision: lightweight tab state via new `ViewContext`. No router library.**
- `react-router-dom` adds ~12 KB gzip + a router wrapper for a 2-tab app with zero deep links.
- Vercel SPA rewrite is already configured for catch-all `/`. A real router would need rewrite tweaks (we already have a documented gotcha in `docs/solutions/integration-issues/`).
- Revisit if mobile / 3+ tabs / share-links demand URLs.

```jsx
// src/contexts/ViewContext.jsx
const VIEWS = ["daily", "build"];
const ViewContext = createContext(null);
export function ViewProvider({ children }) {
  const [view, setView] = useState(() => {
    try { return localStorage.getItem("pulse:active-view") || "daily"; }
    catch { return "daily"; }
  });
  useEffect(() => {
    try { localStorage.setItem("pulse:active-view", view); } catch {}
  }, [view]);
  return <ViewContext.Provider value={{ view, setView }}>{children}</ViewContext.Provider>;
}
```

Tab switcher pills go in `Header.jsx` (left side, before date). `App.jsx` becomes a shell-only layout + view switcher; **current Daily content (including its loading/error gates) moves into new `src/views/DailyView.jsx`** — Build tab cannot be blocked by Daily's loading state.

Grid template branches on view:
- Daily: `grid-cols-[280px_1fr] grid-areas:[header,header][sidebar,main]` (Sidebar visible)
- Build: `grid-cols-[1fr] grid-areas:[header][main]` (Sidebar element not rendered, no empty 280px column)

Header's existing ↻ refresh button becomes context-sensitive: dispatches to `refreshTasks` on Daily, `pipeline.refresh` on Build. EOD Triage button hides on Build.

### 4. State management

**Pattern: `useState` + `useCallback` exposed via Dispatch context** (mirrors `useTasks.jsx` / `useCalendar.jsx`). NOT `useReducer` + action types. Build is read-only — no `pendingWritesRef` cargo-culting; auto-refresh replaces `projects`/`issues` wholesale.

Two contexts: `BuildPipelineStateContext` and `BuildPipelineDispatchContext`. Mirrors existing convention:

```js
// state shape
{
  projects: [],
  issues: [],
  loading: true,
  error: null,
  lastFetched: null,
  expandedCardId: null,
  filter: { type: "all", value: null },  // type: all | owner (category deferred)
}
```

Callbacks (NOT reducer actions): `fetchPipeline({ fresh })`, `setExpandedCardId`, `setFilter`, `refresh()`.

**Invariant after each successful fetch:** if `expandedCardId` is not in the new projects list (e.g., archived mid-session), reset to null. Test enforces.

**Eager mount in `src/main.jsx` alongside `<TasksProvider>` and `<CalendarProvider>`** — matches existing convention (no lazy-mount tricks; React 19 + StrictMode behaves predictably with eager providers). Initial fetch is gated by `view === "build"` (don't hit `/api/linear` until user opens the tab). After first fetch, `useAutoRefresh(refresh, 5*60_000)` pulls in the background — most hit the 60s server cache.

`fetchPipeline()` lives in `src/utils/api.js` so React never touches `/api/...` strings directly.

### 5. UI component breakdown

| File | Responsibility | Lines |
|------|----------------|-------|
| `src/views/BuildPipelineView.jsx` | Top page. Reads context, renders Stats+Filters+Kanban. Loading/error/empty states. | ~80 |
| `src/components/build/PipelineStats.jsx` | Top stats row (Total / Idea / Scoped / Active / Stable counts). | ~60 |
| `src/components/build/PipelineFilters.jsx` | Filter pills (All / Owner). Category deferred. | ~70 |
| `src/components/build/PipelineKanban.jsx` | 5-column grid, memoized grouping. | ~80 |
| `src/components/build/PipelineColumn.jsx` | One stage column (header + scrollable card list). | ~50 |
| `src/components/build/ProjectCard.jsx` | One card. Click toggles expansion. Border-left from stage. | ~140 |
| `src/components/build/ProjectFeatureList.jsx` | Expanded feature list with status dots, links to Linear. | ~80 |

New `src/views/` folder for top-level page components (`DailyView.jsx`, `BuildPipelineView.jsx`).

### 6. CSS / design tokens

**Stage → border-left color:**

| Stage | Token | Hex |
|-------|-------|-----|
| Idea | `--color-text-muted` | `#9c9c99` |
| Scoped | `--color-blue` | `#4a7fc1` |
| Building | `--color-accent` (terracotta) | `#D97757` |
| Live (Beta) | `--color-purple` | `#7c5cbf` |
| Stable | `--color-green` | `#3a9b6f` |

Progression cool→warm→success. Terracotta sits on "Building" — where attention lives. Red is reserved for urgency (Sidebar Priority Stack).

**Issue status dots:** done=`--color-green`, in_progress=`--color-blue`, backlog=`--color-text-muted`, blocked=`--color-red`. (`--color-orange` is the same hex as `--color-accent` — would disappear against Building's terracotta border. Red doubles as urgency, fine semantic overload.) Every dot has `title` + `aria-label` (no color-only).

**Layout:** `grid grid-cols-5 gap-4`. Card: `bg-surface-card border border-border-2 rounded-lg px-3 py-2.5`. Border-left `[3px]` matches Sidebar pattern. Desktop-only for v1; below 1100px → horizontal scroll (mobile tracked in MCR-37).

### 7. Testing strategy

**Unit (`api/_linear.test.js`):**
- `parseStage`: matrix of inputs (empty, missing line, all 5 stages, aliases, mixed casing, multiple lines).
- `parseSummary`: empty / only-stage-line / multi-line / 140-char truncation.
- `normalizeProject` + `normalizeIssue`: full payload → expected shape, state mapping correct.
- `getCachedPipeline`: hit within 60s, miss after, `?fresh=1` bypasses, error doesn't poison cache.
- Mock `fetch` via `vi.mock`. Same pattern as `_notion.test.js`.

**Component (jsdom):**
- `ProjectCard.test.jsx`: render correctness, click expansion (single-card-open invariant), Linear link `target="_blank" rel="noopener noreferrer"`.
- `PipelineFilters.test.jsx`: pill click → `setFilter` shape; `aria-pressed` on active.
- `BuildPipelineView.test.jsx`: loading, error, empty states.

**Integration:**
- `useBuildPipeline.test.jsx`: mock `/api/linear`, mount provider, assert single fetch on mount, refresh forces fresh, error path.

### 8. Env and secrets

- `LINEAR_API_KEY=lin_api_...` in `.env.local` (gitignored).
- Vercel: add via dashboard or `vercel env add`. **Tick all 3 envs (Production, Preview, Development)** per `docs/solutions/integration-issues/vercel-env-vars-production-only-breaks-preview-deploys.md`.
- Update `.env.example` with stub.
- **Server-only:** read in `api/_linear.js` only. Verify post-impl: `grep -r "LINEAR_API_KEY" src/` = 0 matches; build output `grep -r "lin_api_" dist/` = 0.
- **Fail loud:** if `process.env.LINEAR_API_KEY` undefined, throw mentioning `VERCEL_ENV` so misconfigured deploys 500 with a clear error.

### 9. Performance and rate limit

```graphql
query Pipeline {
  projects(first: 100, includeArchived: false) {
    nodes {
      id name url icon color description state
      lead { id name }
      labels(first: 20) { nodes { name color } }
    }
  }
  issues(first: 250) {
    nodes {
      id title url
      state { type name }
      project { id }
    }
  }
}
```

NOTE: `filter: { project: { null: false } }` may not match Linear's actual filter schema — verified empirically during Phase 1 smoke test. Default to **no filter + post-filter server-side** (`issues.filter(i => i.project)`) — robust against schema variance, ~250 issues is a tiny sort/filter cost.

**State mapping** (Linear's `state.type`):
- `completed` → `done`
- `started` → `in_progress`
- `canceled` → exclude from `totalCount`
- `triage|backlog|unstarted` → `backlog`
- `state.name` matching `/blocked/i` → `blocked` (no native type)
- `state: null` or unknown type → `"backlog"` + `console.warn`

**Normalizer null-safety:**
- `description: null` → `""` (server-side coercion)
- `lead: null` → `ownerId: null, ownerName: null` (UI must handle without `.charAt(0)`)
- `total === 0` → progress shape returns `{ done: 0, total: 0, percent: 0 }`; UI renders "No features yet" instead of empty bar

**Rate limit math:** Linear personal key = 1500 req/hr. Worst case with 60s cache = 60/hr (4% of budget). Even 5x traffic safe. Auto-refresh hits the cache; no impact.

**Pagination ceiling:** `first: 250` covers current workspace with headroom. If `pageInfo.hasNextPage === true`, log a `console.warn` and file follow-up.

### 10. Acceptance-criteria-to-test mapping

| Criterion | Verification |
|-----------|--------------|
| Tab visible in nav | Component test on `<Header>` + manual smoke. |
| <2s with cache hit | Manual: throttle to Fast 3G, second click < 200ms. `cacheHit` field logged in dev. |
| Stage parsing across all current projects | Unit test fixtures from real projects (Atlas, Forge, Meridian, CGSC) + manual visual check post-deploy. |
| Feature counts match Linear | Server pre-computes from filtered issues. Spot-check 3 projects post-deploy. |
| Filter pills work | Component test + integration test on filtered list update. |
| "Open in Linear" links | Component test on `href` and `target="_blank"`. |
| Key never client-side | `grep -r "LINEAR_API_KEY" src/` = 0. DevTools Network on `/api/linear` shows no key in headers. `grep` build dir = 0. |
| Cache TTL + refresh bypass | Unit test on `getCachedPipeline` + manual: click Refresh → Network shows `?fresh=1`. |
| Mobile | Deferred to MCR-37. Acceptance: ≥1100px works, below = horizontal scroll. |

### 11. Risks and open questions

**Open questions (for eng review):**
1. **Owner source.** Recommend `project.lead.name`. Cowork artifact may have used a label.
2. ~~**Category source.**~~ DEFERRED to v1.1+ — see plan §11 resolved questions.
3. **Cowork artifact parity.** Spec says match Pulse tokens, not the artifact pixels. Confirm.
4. **"Blocked" state.** No Linear native type. Match `state.name` via regex `/blocked/i`.
5. **Issue pagination.** 250 covers current. Warn when `hasNextPage === true`, follow-up ticket if it fires.

**Risks:**
- **R1 (low):** Linear schema change breaks query. Mitigation: query in one file, fixture-based tests.
- **R2 (low):** Cold-start cache miss = ~300ms. Add `Cache-Control: s-maxage=60, stale-while-revalidate=300`.
- **R3 (med):** Stage-line convention drift. Surface "X projects had no Stage line" as soft warning chip when count > 0.
- **R4 (low):** Safari private-browsing localStorage. Wrap in try/catch.

### 12. Implementation sequence

Six phases, each independently shippable. Phases 1–3 land behind a `localStorage` flag (`pulse:build-enabled`) so server work ships without exposing half-baked UI.

**Phase 1 — Server layer**
1. `LINEAR_API_KEY` to `.env.local` + Vercel (all 3 envs).
2. Update `.env.example`.
3. **Smoke step (do this first):** verify Linear personal-key auth format with `curl -X POST https://api.linear.app/graphql -H "Authorization: $LINEAR_API_KEY" -H "Content-Type: application/json" -d '{"query":"{ viewer { id } }"}'`. If 401, switch to `Bearer` prefix and document.
4. `api/_linear.js`: GraphQL client + parsers + normalizers + cache (with in-flight de-dup + error-resilience).
5. `api/linear/index.js`: HTTP handler with `?fresh=1`. Returns 200 with `error`/`stale` flags on Linear failure (never 5xx unless cache empty AND fetch failed).
6. `api/_linear.test.js`: parser/normalizer/cache tests + GraphQL query snapshot + 401/429/5xx fetch paths + cache-not-poisoned-by-error.
7. **Verify:** `curl localhost:3000/api/linear | jq '.projects | length'` ≈ 14. `curl localhost:3000/api/linear?fresh=1` returns different `fetchedAt`.

**Phase 2 — Hook + context + raw data UI**
1. `fetchPipeline()` in `src/utils/api.js`.
2. `BuildPipelineContext` + `useBuildPipeline` hook (Forge pattern).
3. `ViewContext` with localStorage persistence.
4. Wrap `<App />` with `<ViewProvider>`.
5. Extract Daily content → `src/views/DailyView.jsx`.
6. Tab pills in `Header.jsx`.
7. Stub `BuildPipelineView` rendering `<pre>{JSON}</pre>`.
8. **Verify:** click Build → JSON renders. Refresh → tab persists.

**Phase 3 — Kanban + cards**
1. `PipelineKanban`, `PipelineColumn`, `ProjectCard`.
2. Stage→Tailwind class lookup.
3. Owner badge, X/Y progress (no category badge in v1).
4. **Verify:** all 14 projects in correct columns with correct border colors.

**Phase 4 — Filters + expansion + stats**
1. `PipelineStats` (top counts).
2. `PipelineFilters` (pills).
3. `setFilter` / `setExpandedCardId` actions.
4. `ProjectFeatureList` (expanded view; handle 0 features state).
5. Header refresh button context-routes: `refreshTasks` on Daily, `pipeline.refresh` on Build. EOD Triage button hides on Build.
6. Loading / error (with `stale: true` banner) / empty / no-Stage-line warning chip.
7. Remove feature flag.
8. **Verify:** every acceptance criterion checked on preview deploy. DevTools Network confirms no `LINEAR_API_KEY` in request headers. `grep -r "lin_api_" dist/` after build returns 0.

**Phase 5 — Tests**
1. Component tests (ProjectCard expansion + single-open invariant, Filters, BuildPipelineView states).
2. Hook integration test (`useBuildPipeline` happy path + error path).
3. Auto-refresh-preserves-`expandedCardId` test + expansion-resets-when-project-archived test.
4. Build-output grep test (`dist/` has no `lin_api_` or `LINEAR_API_KEY` matches).
5. Stage parser fixture file at `__fixtures__/linear-projects.json` with sanitized real data (Atlas, Forge, Meridian, CGSC + edge cases: `**Building**`, `Building.`, `__Building__`).
6. **Verify:** `npm run test` green; `npm run lint` clean.

**Phase 6 — Cleanup + docs**
1. Update parent `00_Context/CLAUDE.md` Build Pipeline section → point at Pulse.
2. Update `00_Context/databases.md` Build Pipeline Dashboard row.
3. Update `00_Context/build-pipeline-feature-seed.md`.
4. Update Pulse `CLAUDE.md`: add Linear integration key decision row, env var note.
5. Retire/deprecate Cowork artifact.
6. Solution doc for Linear no-`Bearer`-prefix quirk if it bit during impl.

## Eng Review Findings

**Verdict:** NEEDS CHANGES (not blocking) → applied as deltas below before micro-task breakdown.

### Confirmed against codebase
- API helper convention (`api/_notion.js` style) ✓
- Raw fetch over SDK (`api/_ical.js` precedent) ✓
- No router (no `react-router-dom` in package.json, React 19.2.4) ✓
- Vitest mock patterns (`api/_notion.test.js`) ✓
- All proposed CSS tokens exist in `src/index.css` ✓
- Vercel SPA rewrite excludes `/api/` via negative lookahead — `/api/linear` not intercepted ✓
- `useAutoRefresh(fn, intervalMs)` at `src/hooks/useAutoRefresh.js` (`.js` not `.jsx`) ✓

### Drifts surfaced (and how addressed)

1. **"Forge pattern" vocabulary drift.** Pulse uses `useState` + `useCallback` exposed via Dispatch context. NOT `useReducer` + action types. Section 4 reframed.
2. **`useAutoRefresh.js` extension.** Use `.js` not `.jsx` in import.
3. **App-level loading gate.** `App.jsx` currently has a single loading/error gate for the whole app (~206 lines). The gate must move into `DailyView.jsx`, not remain in `App.jsx` shell — otherwise switching to Build during Daily load flashes a Daily loading screen on Build. App.jsx becomes shell only.
4. **Sidebar hide on Build.** Grid template must collapse from `[280px_1fr]` to `[1fr]` on Build, otherwise empty 280px column. Explicit grid-template branch in App.jsx.
5. **Refresh button routing.** Header's existing ↻ must dispatch to the active view's refresh handler. EOD Triage button must hide on Build.
6. **Blocked dot color collision.** `--color-orange` IS `--color-accent` (`#D97757`) — terracotta. Blocked dot inside Building card disappears against border-left. Switch blocked → `--color-red`. Reframe: red = blocked/urgency, terracotta = Building stage emphasis.
7. **Stage regex too narrow.** Doesn't handle `**Stage:** **Building**`, trailing punctuation, `__Stage:__` syntax. Strip markdown emphasis + punctuation before alias lookup.
8. **Cache claim too broad.** Vercel Fluid Compute reuse is per-instance per-region, not global. Don't oversell. Adequate for single-user Pulse.
9. **Read-only context.** Build is read-only — no `pendingWritesRef` cargo-culting from `useTasks.jsx`. Auto-refresh replaces state wholesale.

### Edge cases added to scope

- **In-flight fetch de-dup:** if a fetch is mid-flight, next caller awaits the same promise (prevents double cold calls on rapid refresh clicks).
- **Linear 401/403/429/5xx:** never poison cache. Return last-known good with `stale: true` flag + `error` field, status 200, banner in UI.
- **GraphQL partial failure:** detect `errors` array alongside `data`; log; render `data` if usable.
- **`description: null`:** server normalizer coerces to `""`.
- **Unknown/null `state.type`:** default `"backlog"` with `console.warn`.
- **`project.lead: null`:** UI badge handles no-owner gracefully (no `.charAt(0)` crash).
- **`expandedCardId` no longer in new projects:** reset to null after each fetch (invariant + test).
- **`0/0` progress:** render "No features yet" instead of 0% bar (no NaN%).
- **Linear filter syntax:** `project: { null: false }` may not be valid. Verify against Linear schema OR drop filter + post-filter server-side.

### Tests added to scope

- GraphQL query string snapshot test (catches typos that schema silently accepts as null).
- 401 / 429 / 5xx fetch path tests with cache-not-poisoned assertion.
- Auto-refresh preserves `expandedCardId` (and resets it when project archived).
- Build-output grep test: `dist/` has no `LINEAR_API_KEY` or `lin_api_` matches.
- Stage parser fixtures: `**Building**`, `Building.`, `__Building__`, `Live (Beta) – on staging`.
- `__fixtures__/linear-projects.json` with sanitized real data.

### Phase 1 smoke step ✅ DONE (2026-04-28)

```bash
curl -X POST https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ viewer { id name email } }"}'
# → 200 with { data: { viewer: { id, name, email } } }
```
**Verified:** raw `Authorization: <key>` works (NO `Bearer` prefix). Plan locks in this auth format.

### Codex Independent Review (2026-04-28) — Verdict: PROCEED WITH CHANGES

Codex flagged 8 deltas; 5 confirmed against the actual codebase, 2 partially applied, 1 rejected.

**Applied:**
1. ✅ HTTP handler convention is `api/linear/index.js` (folder + index.js), matches `api/calendar/index.js` and `api/tasks/index.js`. Plan/micro-tasks updated.
2. ✅ Removed Bearer fallback note (smoke confirmed; locked).
3. ✅ Added "do not cache GraphQL partial responses" rule (errors array → don't write to Map).
4. ✅ Added 5-min stale ceiling — beyond that, refuse to serve stale data; 503 to client.
5. ✅ Eager-mount `BuildPipelineProvider` in `main.jsx` alongside Tasks/Calendar (matches existing convention; safer under React 19 StrictMode). Initial fetch is gated by `view === "build"` inside the provider.
7. ✅ Purged remaining category badge/filter references from ultraplan + micro-tasks.

**Partially applied:**
6. ⚠️ Phase reordering — Codex misread (API tests are already in Phase 1, tasks 1.4/1.6/1.8). App+Header coupling is real; current Phase 2 already groups them in tasks 2.5/2.6/2.7. No change needed.

**Rejected:**
8. ❌ Drop ViewContext — keeping it. Header lives in shell and pills need to read `view` without prop drilling, plus the BuildPipeline hook needs view-aware fetch gating. Single context is cleaner than threading state through App→Header. Codex's "two tabs don't warrant a context" argument is valid for something simpler, but ours has cross-cutting reads.

### Open questions — RESOLVED

1. **Owner source:** ✅ `project.lead.name`. UI handles `null` gracefully (no `.charAt(0)` crash).
2. **Category source:** ✅ SKIP for v1. Drop category badge from cards and category filter pill. Add TODO in plan/code: "category source pending — see issue MCR-NN" (open follow-up later).
3. **Cowork artifact role:** ✅ Pulse tokens only. Don't pixel-match the Cowork artifact; use existing CSS variables and component patterns.
4. **"Blocked" detection:** state name regex `/blocked/i` vs explicit Linear label — **decide at runtime by inspecting Linear data during Phase 1.6**.
5. **Filter persistence:** ✅ persist filter to localStorage (`pulse:build-filter`).

## Micro-Tasks

Each task: 2-5 min. Verifies before moving on. Phases 1-3 land behind localStorage flag `pulse:build-enabled`; Phase 4 removes the flag.

### Phase 1 — Server layer

**1.1 — Linear auth smoke test** ✅ DONE
- `.env.local` populated with `LINEAR_API_KEY`.
- Smoke confirmed: raw `Authorization: <key>` header (NO `Bearer` prefix) returns `viewer { id name email }`. Plan locks in this auth format.

**1.2 — Update `.env.example`**
- Edit `.env.example`: add `LINEAR_API_KEY=your_linear_api_key_here` with a comment.
- Verify: `grep LINEAR_API_KEY .env.example` returns the line.

**1.3 — Create `api/_linear.js` (constants + parsers)**
- Write file with: `STAGES`, `STAGE_ALIASES`, `STAGE_RE`, `parseStage`, `parseSummary` exports.
- No external imports yet; pure functions.
- Verify: lint passes; functions importable from a test.

**1.4 — Add `parseStage` / `parseSummary` unit tests**
- Create `api/_linear.test.js` with: empty, missing line, all 5 stages, aliases, mixed casing, markdown emphasis (`**Building**`, `__Building__`), trailing punctuation (`Building.`), multi-line, multiple Stage lines.
- Verify: `npm test` green, all parse tests pass.

**1.5 — Add normalizers to `api/_linear.js`**
- Functions: `normalizeProject(rawProject, issuesByProjectId)`, `normalizeIssue(rawIssue)`, `mapState(stateObj)`.
- Handle: `description: null` → `""`; `lead: null` → `ownerId: null, ownerName: null`; `state: null` or unknown type → `"backlog"` + `console.warn`; `state.name /blocked/i` → `"blocked"`.
- Verify: lint clean.

**1.6 — Add normalizer unit tests**
- Test fixtures: full project payload → expected `Project`; null lead; null description; project with 0 issues; issue with state.type variants (completed/started/canceled/triage/backlog/unstarted/unknown); issue with state.name "Blocked".
- Verify: `npm test` green.

**1.7 — Add GraphQL fetch + cache to `api/_linear.js`**
- Add `LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql"`.
- Add `PIPELINE_QUERY` (string constant; no `filter:` arg on issues — post-filter `i.project` server-side).
- Add `fetchPipelineFromLinear()`: POST with `Authorization: <key>` header (smoke-confirmed, no Bearer prefix). Returns `{ data, errors }` — DOES NOT throw on partial; caller decides.
- Add `getCachedPipeline({ fresh })`: in-memory Map, 60s TTL, in-flight de-dup, error-resilient with 5-min stale ceiling. NEVER caches GraphQL partial responses (response.errors present).
- Fail-loud guard: if `process.env.LINEAR_API_KEY` undefined, throw with `VERCEL_ENV` mention.
- Verify: lint clean.

**1.8 — Add cache + fetch unit tests**
- Mock `fetch` via `vi.mock`. Tests: cache hit within 60s, miss after, `?fresh=1` bypass, in-flight de-dup (two concurrent calls share one fetch), 401 returns last-known-good with `stale: true`, 429 same, 5xx same, no-cache + 401 throws, **stale ceiling: cache older than 5min refused even on fetch failure**, **GraphQL partial response (`errors` array) does NOT poison cache**, GraphQL query string snapshot.
- Verify: `npm test` green.

**1.9 — Create `api/linear/index.js` HTTP handler**
- Reads `req.query.fresh`, calls `getCachedPipeline({ fresh: !!fresh })`.
- Returns 200 JSON. On caught error with no usable cache (or stale > 5min), return 503 + `{ error: "linear_unavailable" }`.
- Add `Cache-Control: s-maxage=60, stale-while-revalidate=300` header (CDN layer; doc rationale alongside the function-instance cache rationale).
- Verify: `vercel dev` running, `curl http://localhost:3000/api/linear | jq '.projects | length'` returns realistic count.

**1.10 — Phase 1 commit**
- `git add api/ .env.example` and commit: `feat(linear): add server-side proxy for Build Pipeline data`.
- Verify: `git log --oneline -1` shows the commit; baseline tests + new tests all green.

### Phase 2 — Hook + ViewContext + raw data UI

**2.1 — Add `fetchPipeline` to `src/utils/api.js`**
- Wrapper function calling `fetch("/api/linear" + (fresh ? "?fresh=1" : ""))` and returning `await r.json()`.
- Verify: lint clean.

**2.2 — Create `src/contexts/BuildPipelineContext.jsx`**
- Two contexts: `BuildPipelineStateContext`, `BuildPipelineDispatchContext` (mirror `TasksContext` structure).
- Verify: imports clean.

**2.3 — Create `src/hooks/useBuildPipeline.jsx`**
- Provider component with `useState` for projects/issues/loading/error/lastFetched/expandedCardId/filter.
- Callbacks: `refresh`, `setExpandedCardId`, `setFilter`. After successful fetch, if `expandedCardId` not in new projects → reset to null.
- Initial fetch gated by `view === "build"` (read `useView()` from context). Provider is eager-mounted but doesn't hit `/api/linear` until user opens the tab.
- `useAutoRefresh(refresh, 5*60_000)` only runs when `view === "build"` (skip background pulls when user is on Daily).
- Export `useBuildPipelineState()`, `useBuildPipelineDispatch()` hooks.
- Verify: lint clean; no `useReducer` (per eng-review pattern).

**2.4 — Create `src/contexts/ViewContext.jsx`**
- `ViewProvider` with `useState`, persistence via try/catch localStorage `pulse:active-view` (default `"daily"`).
- Export `useView()` hook.
- Verify: lint clean.

**2.5 — Wrap `<App />` with providers in `src/main.jsx`**
- Edit `main.jsx`: add `<ViewProvider>` and `<BuildPipelineProvider>` alongside existing `<TasksProvider>` / `<CalendarProvider>` (eager mount, matches current convention; Codex flagged lazy-mount as risky under React 19 StrictMode).
- Build's initial fetch is gated by `view === "build"` inside the provider, NOT by mount.
- Verify: `npm run dev`, app loads without crash.

**2.6 — Extract Daily content into `src/views/DailyView.jsx`**
- Create `src/views/DailyView.jsx`. Move from `App.jsx`: loading/error gates, Notion error banner, calendar error banner, current Daily content rendering. Keep imports working.
- `App.jsx` retains: layout shell (Header + grid), Sidebar (when Daily), `<main>`, view switcher.
- Verify: Daily tab renders identically to before.

**2.7 — Add tab pills + view switcher in `App.jsx` / `Header.jsx`**
- Header `Header.jsx`: add tab control left of date. Reads `useView()`.
- `App.jsx`: read `view` from `useView()`; render `<DailyView />` or `<BuildPipelineView />` accordingly.
- Grid template branches: `[280px_1fr]` Daily / `[1fr]` Build. Sidebar element only renders on Daily.
- Hide tab pills behind `localStorage.getItem("pulse:build-enabled") === "true"` (feature flag for Phases 1-3).
- Verify: Daily renders. With `localStorage.setItem("pulse:build-enabled","true")`, tabs visible.

**2.8 — Stub `src/views/BuildPipelineView.jsx`**
- Renders `<pre>{JSON.stringify(state, null, 2)}</pre>` against `useBuildPipelineState()`.
- Verify: enable flag, switch to Build tab, see JSON dump of fetched data.

**2.9 — Phase 2 commit**
- `git add src/` commit: `feat(build): add view context, build pipeline hook, raw data view`.
- Verify: tests green; manual smoke confirms Build tab shows JSON.

### Phase 3 — Kanban layout + cards

**3.1 — Create `src/components/build/PipelineKanban.jsx`**
- Memoize `groupBy(projects, p => p.stage)`.
- Render 5 columns in canonical order. Each column renders `<PipelineColumn stage={s} projects={byStage[s] || []} />`.
- Verify: lint clean.

**3.2 — Create `src/components/build/PipelineColumn.jsx`**
- Header: stage name + count. Body: scrollable card list.
- Verify: imports work; no styling yet.

**3.3 — Create `src/components/build/ProjectCard.jsx`**
- Renders icon, name, summary (truncated client-side as a safety net), owner badge (handles null name — show "—" or hide), X/Y progress bar (handles 0/0 → "No features yet"). NO category badge in v1 (deferred).
- Border-left color via STAGE_BORDER_CLASS map.
- Click toggles `setExpandedCardId(card.id === expandedId ? null : card.id)`.
- "Open in Linear" link: `target="_blank" rel="noopener noreferrer"`.
- Verify: imports work.

**3.4 — Wire stage → border-left class**
- Map: Idea→`border-l-text-muted`, Scoped→`border-l-blue`, Building→`border-l-accent`, Beta→`border-l-purple`, Stable→`border-l-green`. Border width `border-l-[3px]`.
- Verify: 5-column kanban renders, all 14 projects in the right columns, correct border colors.

**3.5 — Phase 3 commit**
- `git add src/` commit: `feat(build): kanban layout with project cards`.
- Verify: visually inspect on `localhost:3000` with feature flag.

### Phase 4 — Filters + expansion + stats + refresh routing

**4.1 — Create `src/components/build/PipelineStats.jsx`**
- Top row: Total / Idea / Scoped / Active (Building+Beta) / Stable counts.
- Verify: lint + visual.

**4.2 — Create `src/components/build/PipelineFilters.jsx`**
- All / by Owner pills (category SKIPPED for v1). Reads `state.filter`, calls `setFilter`. `aria-pressed="true"` on active.
- Persist filter to localStorage `pulse:build-filter`.
- Verify: clicking pills updates state; visible projects change.

**4.3 — Create `src/components/build/ProjectFeatureList.jsx`**
- Renders inside expanded ProjectCard. Maps issues for project. Status dot per CSS token (done=green, in_progress=blue, backlog=text-muted, blocked=red). Each issue has `aria-label` with state name. Link to `issue.url`.
- Empty: "No features yet."
- Verify: expand a card, see feature list.

**4.4 — Refresh button context-routing in `Header.jsx`**
- Existing ↻ button: `onClick = view === "daily" ? refreshTasks : pipelineRefresh`.
- EOD Triage button: hide when `view === "build"`.
- Verify: refresh button works on both views.

**4.5 — Loading / error / empty / no-Stage-line states in `BuildPipelineView.jsx`**
- Loading skeleton (mirrors Daily loading style).
- Error banner: when `state.error` truthy, show "Linear unavailable, showing last cached data" with a retry button. If `state.stale`, show same banner.
- Empty: "No projects yet" message.
- No-Stage-line warning: count projects with `stage === "Idea"` AND no `**Stage:**` line in description; if > 0, show a small warning chip "X projects have no Stage line". (Soft signal — don't block render.)
- Verify: simulate each state.

**4.6 — Remove feature flag**
- Remove the `pulse:build-enabled` localStorage gate in `App.jsx` / `Header.jsx`. Tabs visible by default.
- Verify: clean reload shows Build tab.

**4.7 — Phase 4 commit**
- `git add src/` commit: `feat(build): filters, expansion, stats, refresh routing`.

### Phase 5 — Tests

**5.1 — Component tests for `ProjectCard`**
- Renders fields. Click toggles expansion. Single-card-open invariant (open A, click B, A collapses). Open-in-Linear `target="_blank" rel="noopener noreferrer"`.
- Verify: green.

**5.2 — Component tests for `PipelineFilters`**
- Pill click → `setFilter` called with right shape. `aria-pressed="true"` on active.
- Verify: green.

**5.3 — Component tests for `BuildPipelineView` states**
- Loading, error, empty, populated.
- Verify: green.

**5.4 — Hook integration test for `useBuildPipeline`**
- Mock `fetchPipeline` from utils/api. Mount provider, expect single fetch on mount, populated state. `refresh()` calls again with `fresh: true`. Failed fetch → error state, projects empty (or stale data + banner).
- Auto-refresh preserves expansion. Auto-refresh resets expansion when project archived.
- Verify: green.

**5.5 — Stage parser fixture file**
- Create `api/__fixtures__/linear-projects.json` with sanitized real data: Atlas, Forge, Meridian, CGSC + edge cases (`**Stage:** **Building**`, `**Stage:** Building.`, missing description).
- Add fixture-driven test in `_linear.test.js`.
- Verify: green.

**5.6 — Build-output bundle grep test**
- New test file `api/__tests__/no-key-leak.test.js` (or similar) — runs `npm run build` once, then `grep -r "lin_api_" dist/` and `grep -r "LINEAR_API_KEY" dist/`. Both must be 0 matches.
- (If too slow for default test run, gate behind `BUILD_GREP_TEST=1` env var and run in CI only.)
- Verify: green.

**5.7 — Phase 5 commit**
- `git add` commit: `test(build): full coverage for parser, normalizer, cache, hook, components`.

### Phase 6 — Cleanup + docs

**6.1 — Update Pulse `CLAUDE.md`**
- Add Linear integration row to Key Decisions table.
- Add `LINEAR_API_KEY` to env section.
- Verify: rendered correctly.

**6.2 — Update parent `00_Context/CLAUDE.md` Build Pipeline section**
- Point at Pulse instead of Cowork artifact.
- Verify: parent CLAUDE.md reflects new home.

**6.3 — Update `00_Context/databases.md`**
- Build Pipeline Dashboard row updated to point at Pulse.

**6.4 — Update `00_Context/build-pipeline-feature-seed.md`**
- Note Pulse as the new home; mark seed as historical.

**6.5 — Mark Cowork artifact `build-pipeline` deprecated**
- Add deprecation header to the artifact (if accessible) or create a TODO to retire it manually.

**6.6 — Optional: solution doc for Linear no-Bearer-prefix gotcha**
- If smoke step (1.1) confirmed no-Bearer-prefix, add `docs/solutions/integration-issues/linear-graphql-personal-api-key-no-bearer-prefix.md`.

**6.7 — Phase 6 commit**
- Combined cleanup commit: `docs(build): update CLAUDE.md, databases.md, retire Cowork artifact`.

## Build Log

_(populated during implementation)_
