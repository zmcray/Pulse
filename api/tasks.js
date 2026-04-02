import { queryTodaysTasks, updateTaskProperties } from "./_notion.js";

export async function GET() {
  try {
    const tasks = await queryTodaysTasks();
    return new Response(JSON.stringify(tasks), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[api/tasks] GET error:", err.message);
    return new Response(
      JSON.stringify({ error: "Failed to fetch tasks" }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}

export async function PATCH(request, taskId) {
  try {
    const body = typeof request.json === "function"
      ? await request.json()
      : JSON.parse(await request.text());

    if (!taskId) {
      return new Response(
        JSON.stringify({ error: "Task ID required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const updated = await updateTaskProperties(taskId, body);
    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[api/tasks] PATCH error:", err.message);
    return new Response(
      JSON.stringify({ error: "Failed to update task" }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}
