import { queryTodaysTasks, queryHangingTasks } from "../_notion.js";

/**
 * GET /api/tasks
 *
 * Returns a flat array of tasks. Each task has an `isHanging: boolean` flag:
 *   - false = scheduled for today (Phase 1 behavior)
 *   - true  = hanging from prior 1-7 days, surfaced as carry-over on weekends
 *
 * Frontend splits by isHanging in App.jsx for the carry-over render.
 *
 * If the hanging query fails, today's tasks still return -- carry-over is
 * a nice-to-have, today is the core.
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const todayTasks = await queryTodaysTasks();
    const todayWithFlag = todayTasks.map((t) => ({ ...t, isHanging: false }));

    let hangingWithFlag = [];
    try {
      const hangingTasks = await queryHangingTasks();
      hangingWithFlag = hangingTasks.map((t) => ({ ...t, isHanging: true }));
    } catch (err) {
      console.error("[api/tasks] hanging query failed (non-fatal):", err.message);
    }

    return res.status(200).json([...todayWithFlag, ...hangingWithFlag]);
  } catch (err) {
    console.error("[api/tasks] GET error:", err.message);
    return res.status(502).json({ error: "Failed to fetch tasks" });
  }
}
