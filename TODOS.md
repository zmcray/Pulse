# TODOS

Deferred work captured during planning. Ordered by priority.

## P2

### Priority Stack from Notion (sidebar)
- **What:** Replace the hardcoded Priority Stack section in `src/components/Sidebar.jsx` with data pulled from Notion.
- **Why:** Currently shows static "Tim Lower intro follow-ups" and "Inference cost talking points" cards. Should reflect real priorities.
- **Open question:** Query strategy. Options: tasks with high rollover count (>=2), manual "Priority" tag in Notion, or a separate Notion view. Decide before implementing.
- **Effort:** ~1-2 hr human / ~10 min CC after the strategy decision.
- **Source:** CEO + Eng review (P3 deferred)

### Time-remaining color escalation under 5 min
- **What:** Already in scope and built. The `text-accent` color switch when `minsLeft < 5` is in `WorkblockGroup.jsx`.
- **Status:** Shipped in Phase 2.

## P3

### DESIGN.md for Pulse
- **What:** Document the existing CSS token system from `src/index.css` as a formal design system doc.
- **Why:** No DESIGN.md exists. The system is encoded in CSS variables but isn't visible to readers.
- **Effort:** ~30 min. Inventory tokens, group by purpose (color, type, spacing, radius), document usage patterns.
- **Source:** Design review

### Mobile responsive support
- **What:** Pulse currently uses `grid-cols-[280px_1fr]` which breaks below ~700px wide. Below that, sidebar overlaps main area.
- **Why:** Pulse is fundamentally a desktop tool. Deferred until usage proves otherwise.
- **Trigger:** User starts checking Pulse on phone regularly.
- **Effort:** ~2-3 hr to do properly (stack sidebar below main on mobile, larger touch targets, responsive breakpoints).
- **Source:** Design review

### Constants.js split
- **What:** `src/utils/constants.js` is getting long. Split into `constants/workblocks.js`, `constants/calendar.js`, `constants/statuses.js`.
- **Why:** Better organization as the file grows past ~80 lines.
- **Effort:** ~15 min refactor.
- **Source:** Eng review

### Page Visibility API pause for auto-refresh
- **What:** Add `document.hidden` check to `useAutoRefresh` so polling pauses when the Pulse tab is in background.
- **Why:** Trigger only if Vercel free tier consumption becomes a concern. Current usage estimate: ~17% of free tier worst case.
- **Effort:** ~15 min.
- **Source:** Eng review (deferred per cost analysis)

### Keyboard navigation (j/k/Space)
- **What:** Vim-style keyboard navigation -- `j`/`k` to move between tasks, `Space` to toggle status, `g` to jump to current block.
- **Why:** Power-user efficiency. Removes mouse dependency.
- **Effort:** ~1 hr including keyboard event handling and focus management.
- **Source:** CEO review (skipped)

### Dark mode toggle
- **What:** Dark variant of the existing CSS token system.
- **Why:** Low value for a daytime productivity tool. Listed for completeness.
- **Effort:** ~1 hr.
- **Source:** CEO review (skipped)

### Proactive transition notifications
- **What:** Browser notifications when a workblock is about to start or end ("5 min until next block").
- **Why:** Phase 3+ aspirational feature. Turns Pulse from passive dashboard into active companion.
- **Effort:** ~2-3 hr including Notification API permission flow, scheduling, opt-out.
- **Source:** CEO review (Phase 3 idea)
