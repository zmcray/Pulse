import { useEffect, useRef } from "react";
import { useTasksState, useTasksDispatch } from "../contexts/TasksContext.jsx";
import { useCalendarState } from "../contexts/CalendarContext.jsx";
import WorkblockGroup from "../components/WorkblockGroup.jsx";
import EmptyState from "../components/EmptyState.jsx";
import TriagePanel from "../components/TriagePanel.jsx";
import TaskRow from "../components/TaskRow.jsx";
import { WORKBLOCK_ORDER } from "../utils/constants.js";
import {
  findCurrentWorkblock,
  normalizeWorkblockName,
} from "../utils/calendarHelpers.js";

/**
 * Group tasks by workblock.
 *
 * Workblock order is calendar-driven when /api/calendar succeeded.
 * Falls back to the static WORKBLOCK_ORDER from constants.js when the
 * calendar is unavailable or has zero workblocks for today.
 */
function groupByWorkblock(tasks, calendarWorkblocks) {
  const groups = {};
  for (const task of tasks) {
    const wb = normalizeWorkblockName(task.workblock) || "Other";
    if (!groups[wb]) groups[wb] = [];
    groups[wb].push(task);
  }

  let orderMap;
  if (calendarWorkblocks && calendarWorkblocks.length > 0) {
    orderMap = {};
    calendarWorkblocks.forEach((wb, i) => {
      orderMap[wb.name] = i;
    });
  } else {
    orderMap = WORKBLOCK_ORDER;
  }

  return Object.entries(groups).sort(([a], [b]) => {
    const orderA = orderMap[a] ?? 999;
    const orderB = orderMap[b] ?? 999;
    return orderA - orderB;
  });
}

export default function DailyView() {
  const { tasks, loading, error, mode } = useTasksState();
  const { refreshTasks } = useTasksDispatch();
  const {
    workblocks: calendarWorkblocks,
    error: calendarError,
  } = useCalendarState();

  const mainRef = useRef(null);

  // Auto-scroll to current workblock on load.
  // Runs whenever the current block NAME changes (block transition or first load),
  // not on every calendar object identity change. Re-running on object identity
  // would scroll on every 5-min auto-refresh which would be jarring.
  const currentBlock = findCurrentWorkblock(calendarWorkblocks, new Date());
  const currentBlockName = currentBlock?.name;
  useEffect(() => {
    if (!currentBlockName || !mainRef.current) return;
    const id = requestAnimationFrame(() => {
      const target = mainRef.current?.querySelector(
        `[data-workblock="${currentBlockName}"]`,
      );
      if (target) target.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [currentBlockName]);

  if (loading) {
    return (
      <main className="[grid-area:main] flex items-center justify-center">
        <div className="text-text-muted text-sm">Loading tasks...</div>
      </main>
    );
  }

  if (error && tasks.length === 0) {
    return (
      <main className="[grid-area:main] flex flex-col items-center justify-center gap-3">
        <p className="text-red text-sm">Failed to load tasks</p>
        <p className="text-text-muted text-xs">{error}</p>
        <button
          onClick={refreshTasks}
          className="text-xs px-3 py-1.5 rounded-lg bg-surface-card border border-border text-text-secondary hover:border-text-muted transition-colors"
        >
          Try again
        </button>
      </main>
    );
  }

  const todayTasks = tasks.filter((t) => !t.isHanging);
  const hangingTasks = tasks.filter((t) => t.isHanging);
  const workblockGroups = groupByWorkblock(todayTasks, calendarWorkblocks);

  // Empty calendar day = no calendar workblocks AND no today tasks.
  const isEmptyDay =
    (!calendarWorkblocks || calendarWorkblocks.length === 0) &&
    todayTasks.length === 0;

  const sectionLabel = isEmptyDay
    ? "Carry-over from this week"
    : "Day Dashboard";

  return (
    <main
      ref={mainRef}
      className="[grid-area:main] overflow-y-auto py-5 px-6"
    >
      {error && (
        <div className="bg-[#fef1ee] border border-red/20 rounded-lg px-4 py-2.5 mb-4 text-xs text-red">
          Notion sync issue: {error}. Showing cached data.
        </div>
      )}

      {calendarError && (
        <div className="bg-[#fef1ee] border border-red/20 rounded-lg px-4 py-2.5 mb-4 text-xs text-red">
          Calendar disconnected. Workblocks falling back to default order.
        </div>
      )}

      {mode === "triage" ? (
        <TriagePanel />
      ) : isEmptyDay && hangingTasks.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="text-[10px] font-semibold tracking-[0.08em] uppercase text-text-muted mb-4">
            {sectionLabel}
          </div>

          {isEmptyDay ? (
            <div className="relative">
              <div className="bg-surface-card border border-border-2 rounded-[10px] px-4 py-3.5">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="font-semibold text-sm tracking-tight text-text-muted">
                    Hanging from this week
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-[5px] py-px rounded bg-surface-2 text-text-muted">
                    {hangingTasks.length}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {hangingTasks.map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[3px] top-5 bottom-5 w-0.5 bg-border z-0" />
              <div className="relative z-1">
                {workblockGroups.map(([workblock, wbTasks]) => (
                  <WorkblockGroup
                    key={workblock}
                    workblock={workblock}
                    tasks={wbTasks}
                    calendarWorkblock={calendarWorkblocks.find(
                      (cw) => cw.name === workblock,
                    )}
                    isCurrent={currentBlock?.name === workblock}
                  />
                ))}
              </div>

              {hangingTasks.length > 0 && (
                <div className="mt-6">
                  <div className="text-[10px] font-semibold tracking-[0.08em] uppercase text-text-muted mb-3">
                    Carry-over from this week
                  </div>
                  <div className="bg-surface-card border border-border-2 rounded-[10px] px-4 py-3.5">
                    <div className="flex flex-col gap-1">
                      {hangingTasks.map((task) => (
                        <TaskRow key={task.id} task={task} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
      <div className="h-10" />
    </main>
  );
}
