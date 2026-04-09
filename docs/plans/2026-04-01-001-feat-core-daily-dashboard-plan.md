---
title: "feat: Core Daily Dashboard (Phase 1)"
type: feat
status: completed
date: 2026-04-01
origin: PRD-Pulse-Daily-Dashboard.docx
---

# feat: Core Daily Dashboard (Phase 1)

## Overview

Build the Pulse MVP: a single-user React dashboard that connects to the Notion Roadmap database, displays today's tasks grouped by workblock, supports status toggles and inline notes with Notion writeback, and provides EOD triage for incomplete tasks. This closes the daily loop between morning planning and evening reconciliation.

Scope: FR-01, FR-02, FR-03, FR-04, FR-05, FR-07, FR-08 from the PRD.

## Problem Statement

Three gaps exist in the current operating system:
1. No persistent visual interface for daily task tracking (Roadmap lives in Notion, not optimized for daily execution)
2. No closed loop between morning planning and evening reconciliation
3. No structured process for handling incomplete tasks (work gets forgotten or silently rolls over)

## Key Decisions (Resolved)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Status values | Update Notion DB to add Blocked + Dropped | PRD requires these dispositions; update DB before shipping |
| Date query | Range-aware | Multi-day tasks should appear each day they span |
| Push to Next Week | Set Scheduled For to next Monday | Prevents orphaned floating tasks; Friday review catches them |
| Type filter | Tasks only | Objectives/Milestones aren't daily work items |
| EOD skill overlap | Pulse replaces EOD task review | EOD skill defers to Pulse for disposition; focuses on session summary only |
| Completed On | Set automatically when status = Done | Downstream analytics and weekly reviews depend on this |
| Deployment | Vercel (like Forge) | Proven patterns, existing setup, zero friction |

## Proposed Solution

### Architecture

```
Browser <-> Vercel (Static + Functions)
                |
                v
         Notion API (Roadmap DB)
```

- **Frontend**: React 19 + Vite 8 + Tailwind CSS 4 (same stack as Forge)
- **Backend**: Vercel Serverless Functions (Node.js, same pattern as Forge)
- **Data**: Notion API via @notionhq/client
- **Auth**: Single-user, API key in env vars (no auth UI)
- **Deployment**: Vercel (Cloudflare can be adopted later if needed)

### File Structure

```
pulse/
  .env                          # NOTION_API_KEY, NOTION_DATABASE_ID
  .env.example                  # Template (committed)
  .prettierrc                   # From Forge
  eslint.config.js              # From Forge (adapted)
  index.html
  package.json
  vercel.json                   # SPA rewrite rule
  vite.config.js                # React + Tailwind + dev API middleware
  api/
    tasks.js                    # GET today's tasks, PATCH single task
    triage.js                   # POST batch EOD dispositions
    _notion.js                  # Shared Notion client + helpers
  src/
    main.jsx                    # Entry point, TasksProvider wrapper
    App.jsx                     # Layout, mode switching (normal vs triage)
    index.css                   # Tailwind @theme with Pulse palette
    contexts/
      TasksContext.jsx          # Split state/dispatch context (Forge pattern)
    hooks/
      useTasks.js               # Fetch, optimistic updates, rollback
      useAutoSave.js            # Debounced notes save (500ms)
      useTriage.js              # EOD disposition state + batch confirm
    components/
      Header.jsx                # Date, progress bar, triage toggle
      ProgressBar.jsx           # Thin bar, blue-to-green gradient
      WorkblockGroup.jsx        # Section header + task list per workblock
      TaskRow.jsx               # Status badge, title, workstream tag, notes
      StatusBadge.jsx           # Clickable pill: gray/blue/green cycle
      InlineNotes.jsx           # Auto-saving textarea with debounce
      EmptyState.jsx            # "No tasks scheduled" message
      TriagePanel.jsx           # EOD triage overlay
      TriageRow.jsx             # Task + disposition dropdown
      TriageConfirmBar.jsx      # "Apply N changes" + confirm button
    utils/
      api.js                    # Fetch wrapper with error handling
      dates.js                  # todayISO(), tomorrowISO(), nextMondayISO()
      constants.js              # Status values, workblock order map, dispositions
```

### API Endpoints

#### `GET /api/tasks`
- Queries Notion Roadmap: `Scheduled For` range includes today AND `Type = Task`
- Normalizes Notion's nested property format to flat JSON
- Returns tasks sorted by workblock order

```json
[{
  "id": "notion-page-id",
  "title": "Write Q2 OKRs",
  "status": "Not Started",
  "workblock": "AI-Building",
  "workstream": "Web Development",
  "scheduledFor": "2026-04-01",
  "notes": "...",
  "rolloverCount": 0
}]
```

**Date filter logic** (range-aware):
```
filter: {
  and: [
    { property: "Scheduled For", date: { on_or_before: todayISO() } },
    { or: [
      { property: "Scheduled For", date: { on_or_after: todayISO() } },  // end date >= today
      // handle single-date tasks (no end date, start = today)
    ]}
  ]
}
```

#### `PATCH /api/tasks/:id`
- Body: `{ status?, notes? }`
- Updates corresponding Notion page properties
- When `status = "Done"`, also sets `Completed On` to today
- Returns updated task object

#### `POST /api/triage`
- Body: `{ dispositions: [{ taskId, action }] }`
- Actions and their Notion writes:
  - `reschedule_tomorrow`: Set Scheduled For = tomorrow, increment Rollover Count (read-then-write, no atomic increment)
  - `push_next_week`: Set Scheduled For = next Monday, increment Rollover Count
  - `drop`: Set Status = "Dropped"
  - `work_late`: No Notion changes
- Processes sequentially (no Notion batch API)
- Returns `{ updated: number, errors: [] }`

### Component Hierarchy

```
<TasksProvider>
  <App>
    <Header>
      <ProgressBar />           # "5 of 9 tasks done" + thin bar
    </Header>

    {mode === "normal" && (
      <main>
        {workblocks.map(wb => (
          <WorkblockGroup>
            {wb.tasks.map(t => (
              <TaskRow>
                <StatusBadge />   # Click to cycle status
                <InlineNotes />   # Debounced auto-save
              </TaskRow>
            ))}
          </WorkblockGroup>
        ))}
        {tasks.length === 0 && <EmptyState />}
      </main>
    )}

    {mode === "triage" && (
      <TriagePanel>
        {incomplete.map(t => <TriageRow />)}
        <TriageConfirmBar />
      </TriagePanel>
    )}
  </App>
</TasksProvider>
```

### State Management

Split Context pattern (from Forge's `ScoringContext.jsx`):

- **TasksStateContext**: `{ tasks, loading, error, mode }` (memoized)
- **TasksDispatchContext**: `{ updateStatus, updateNotes, setMode, refreshTasks }` (stable refs)

**Optimistic update pattern:**
1. Save previous state for rollback
2. Update local state immediately
3. Fire API call in background
4. On error: rollback + show inline error on the affected row

**Auto-save pattern (useAutoSave):**
- 500ms debounce after last keystroke
- Flush immediately on blur
- No explicit save button

### Workblock Ordering (Without Google Calendar)

Static order map in `constants.js` matching the real workblock schedule:

```js
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
```

Tasks grouped by workblock, sorted by this map. Tasks with unknown workblock go to an "Other" group at the bottom. Google Calendar integration (Phase 2) replaces this with dynamic time-of-day ordering.

### Visual Design

- **Font**: Inter (via Google Fonts) or system stack, 14px base
- **Status colors**: Not Started (gray-400), In Progress (blue-500), Done (green-500), Blocked (red-500), Dropped (gray-300 + strikethrough)
- **Progress bar**: Thin (4px) horizontal bar at page top. Width = completed/total. Color interpolates blue-500 to green-500.
- **Rollover badge**: Tasks with Rollover Count >= 2 get an orange warning badge showing the count
- **Layout**: Single column, max-width container, generous whitespace
- **No dark mode in V1**

### Empty State

When no tasks are scheduled for today:
- "No tasks scheduled for today"
- Subtext: "Load tasks via your Strategy block or Roadmap Planning workstream"
- Clean, non-alarming design

## Technical Considerations

### Notion API
- No batch/transaction API: each update is a separate HTTP request
- Rollover Count increment requires read-then-write (no atomic increment)
- 180 requests/minute rate limit: trivial at single-user scale (~10-20 calls per session)
- Status values must match exact Notion select options (case-sensitive)
- **Pre-requisite**: Add "Blocked" and "Dropped" status options to the Notion Roadmap database before shipping

### Notion Property Mapping
- `Item` (title) -> task title
- `Status` (select) -> status badge (existing: "Not started", "In progress", "Done"; new: "Blocked", "Dropped")
- `Workblock` (select) -> grouping key
- `Workstream` (select) -> tag on task card
- `Scheduled For` (date, range) -> today filter
- `Rollover Count` (number) -> rollover badge, incremented on reschedule
- `Notes` (rich_text) -> inline notes field
- `Completed On` (date) -> auto-set when status changes to Done
- `Type` (select) -> filter to "Task" only

### Error Handling
- Notion API failure on fetch: show stale cached data (if any) with a warning banner, retry button
- Notion API failure on update: rollback optimistic change, show inline error on the affected task
- Triage batch partial failure: report which tasks failed, allow retry of failed items

## System-Wide Impact

- **EOD skill change**: The end-of-day scheduled task must be updated to defer task review/disposition to Pulse. It should focus on session summary and tomorrow preview only. If Pulse triage hasn't been completed, the EOD skill can prompt the user to open Pulse.
- **Completed On property**: Pulse will now set this automatically. Verify that no other system (e.g., Cowork skills) also sets it, to avoid conflicts.
- **Rollover Count**: Only Pulse should increment this going forward. Remove any Rollover Count logic from the EOD skill.

## Acceptance Criteria

### Functional
- [ ] Dashboard loads today's tasks from Notion Roadmap (Type = Task, Scheduled For includes today)
- [ ] Tasks are grouped by Workblock in correct schedule order
- [ ] Each task shows: title, status badge, workstream tag, inline notes
- [ ] Clicking status badge cycles: Not Started -> In Progress -> Done (with optimistic UI)
- [ ] Status change writes back to Notion; sets Completed On = today when Done
- [ ] Inline notes auto-save to Notion after 500ms debounce; flush on blur
- [ ] Header shows date, day of week, and completion progress ("X of Y done")
- [ ] Progress bar fills and shifts color (blue to green) as tasks complete
- [ ] Tasks with Rollover Count >= 2 show orange warning badge
- [ ] EOD Triage button shows in header
- [ ] Triage mode filters to incomplete tasks only
- [ ] Each incomplete task has disposition dropdown: Reschedule Tomorrow, Push to Next Week, Drop, Work Late
- [ ] Triage dispositions write correct values to Notion (including Rollover Count increment and next Monday date)
- [ ] Batch confirm processes all dispositions and refreshes the view
- [ ] Cancel/back button exits triage without changes
- [ ] Empty state displays when no tasks scheduled for today
- [ ] Notion API failures show error state with retry, not a broken page

### Non-Functional
- [ ] Dashboard loads in under 2 seconds
- [ ] Deploys to Vercel with zero ongoing cost at single-user scale
- [ ] No client-side exposure of Notion API key
- [ ] Keyboard navigable (status toggle via Enter/Space)

## Pre-requisites (Before Building)

1. **Update Notion Roadmap database**: Add "Blocked" and "Dropped" as Status select options
2. **Verify Notion property names**: Confirm exact property names match what's in the database (case-sensitive)
3. **Get Notion API key**: Create an internal integration at notion.so/my-integrations, share the Roadmap database with it
4. **Verify Vercel account**: Ensure the account used for Forge can host another project

## Build Order

| Step | What | Estimated Time | Dependencies |
|------|------|---------------|-------------|
| 1 | Project scaffold (Vite + React + Tailwind, configs from Forge) | 30 min | None |
| 2 | Notion API layer (`api/_notion.js`, `api/tasks.js`) | 1 hr | Notion API key, DB property names verified |
| 3 | Core data flow (useTasks hook, TasksContext, basic task list render) | 1 hr | Step 2 |
| 4 | Task display with workblock grouping (WorkblockGroup, TaskRow) | 1 hr | Step 3 |
| 5 | Status toggle with optimistic update (StatusBadge, Completed On) | 30 min | Step 4 |
| 6 | Progress bar (Header, ProgressBar) | 20 min | Step 5 |
| 7 | Inline notes with auto-save (InlineNotes, useAutoSave) | 45 min | Step 4 |
| 8 | EOD triage (api/triage.js, useTriage, TriagePanel, TriageRow, TriageConfirmBar) | 1.5 hr | Step 3 |
| 9 | Empty state, error handling, loading states, polish | 45 min | Steps 4-8 |
| 10 | Deploy to Vercel | 30 min | Step 9 |

**Total: ~7-8 hours of focused work (3-4 AI-Building blocks)**

## Verification Plan

1. **Notion connection**: `GET /api/tasks` returns real data from the Roadmap database
2. **Status toggle**: Click status badge, verify Notion page updates within seconds
3. **Completed On**: Toggle a task to Done, check Notion shows today's date in Completed On
4. **Notes**: Type in inline notes, verify Notion Notes property updates after debounce
5. **Progress bar**: Toggle statuses, confirm bar width and color update in real time
6. **EOD triage**: Enter triage, assign dispositions, confirm batch. Verify:
   - Reschedule Tomorrow: Scheduled For = tomorrow, Rollover Count incremented
   - Push to Next Week: Scheduled For = next Monday, Rollover Count incremented
   - Drop: Status = Dropped
   - Work Late: no changes
7. **Empty state**: Remove Scheduled For from all tasks, reload, verify empty state renders
8. **Error handling**: Kill Notion API key, verify error banner appears with retry button
9. **Mobile**: Open on phone browser, verify single-column layout is usable

## Sources & References

### Internal References
- Vite config pattern: `30_Projects/Forge/app/vite.config.js`
- Split context pattern: `30_Projects/Forge/app/src/contexts/ScoringContext.jsx`
- API client pattern: `30_Projects/Forge/app/src/utils/evaluateAnswer.js`
- Tailwind theme setup: `30_Projects/Forge/app/src/index.css`
- Package versions: `30_Projects/Forge/app/package.json`
- Prettier/ESLint config: `30_Projects/Forge/app/.prettierrc`, `eslint.config.js`
- Real Roadmap schema: `40_OS/08_Memory/roadmap-snapshot-2026-03-30.md`
- Rollover threshold rule: `40_OS/07_Feedback/gotcha-roadmap-calendaring.md`

### Origin
- **PRD**: `30_Projects/Pulse/PRD-Pulse-Daily-Dashboard.docx` -- Phase 1 scope (FR-01 through FR-05, FR-07, FR-08)
