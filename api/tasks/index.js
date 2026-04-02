import { queryTodaysTasks } from "../_notion.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const tasks = await queryTodaysTasks();
    return res.status(200).json(tasks);
  } catch (err) {
    console.error("[api/tasks] GET error:", err.message);
    return res.status(502).json({ error: "Failed to fetch tasks" });
  }
}
