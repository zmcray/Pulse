import { updateTaskProperties } from "../_notion.js";

export default async function handler(req, res) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: "Task ID required" });
  }

  try {
    const updated = await updateTaskProperties(id, req.body);
    return res.status(200).json(updated);
  } catch (err) {
    console.error("[api/tasks/:id] PATCH error:", err.message);
    return res.status(502).json({ error: "Failed to update task" });
  }
}
