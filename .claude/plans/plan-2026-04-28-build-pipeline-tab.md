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
- Cards: icon, name, summary (truncated), owner badge, category badge, progress bar (X/Y features), border-left color matches stage
- Click card to expand inline → feature list with status dots, link out to Linear
- Top row: stats (Total / Idea / Scoped / Active / Stable counts)
- Filter pills: All / by Owner / by Category
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
- [ ] Branch + baseline tests
- [ ] Move MCR-86 to In Progress in Linear
- [ ] /ultraplan
- [ ] /plan-eng-review
- [ ] Micro-task breakdown
- [ ] Implementation
- [ ] /ce:review
- [ ] /ce:compound
- [ ] Commit + PR

---

## Ultraplan Output

_(populated by /ultraplan)_

## Eng Review Findings

_(populated by /plan-eng-review)_

## Micro-Tasks

_(populated after eng review)_

## Build Log

_(populated during implementation)_
