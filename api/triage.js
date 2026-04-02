import {
  updateTaskProperties,
  getTaskRolloverCount,
} from "./_notion.js";

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function nextMondayISO() {
  const d = new Date();
  const day = d.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + daysUntilMonday);
  return d.toISOString().slice(0, 10);
}

export async function POST(request) {
  try {
    const { dispositions } = typeof request.json === "function"
      ? await request.json()
      : JSON.parse(await request.text());

    if (!Array.isArray(dispositions) || dispositions.length === 0) {
      return new Response(
        JSON.stringify({ error: "Dispositions array required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    let updated = 0;
    const errors = [];

    for (const { taskId, action } of dispositions) {
      try {
        switch (action) {
          case "reschedule_tomorrow": {
            const count = await getTaskRolloverCount(taskId);
            await updateTaskProperties(taskId, {
              scheduledFor: tomorrowISO(),
              rolloverCount: count + 1,
            });
            updated++;
            break;
          }
          case "push_next_week": {
            const count = await getTaskRolloverCount(taskId);
            await updateTaskProperties(taskId, {
              scheduledFor: nextMondayISO(),
              rolloverCount: count + 1,
            });
            updated++;
            break;
          }
          case "drop": {
            await updateTaskProperties(taskId, {
              status: "Dropped",
            });
            updated++;
            break;
          }
          case "work_late": {
            // No changes needed
            updated++;
            break;
          }
          default:
            errors.push({ taskId, error: `Unknown action: ${action}` });
        }
      } catch (err) {
        errors.push({ taskId, error: err.message });
      }
    }

    return new Response(JSON.stringify({ updated, errors }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[api/triage] POST error:", err.message);
    return new Response(
      JSON.stringify({ error: "Triage failed" }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}
