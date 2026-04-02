import { Client } from "@notionhq/client";

let client = null;

export function getNotionClient() {
  if (!client) {
    client = new Client({ auth: process.env.NOTION_API_KEY });
  }
  return client;
}

export function getDatabaseId() {
  return process.env.NOTION_DATABASE_ID;
}

/**
 * Query today's tasks from the Roadmap database.
 * Range-aware: shows tasks where today falls within Scheduled For range.
 * Filters to Type = Task only.
 */
export async function queryTodaysTasks() {
  const notion = getNotionClient();
  const today = new Date().toISOString().slice(0, 10);

  const response = await notion.databases.query({
    database_id: getDatabaseId(),
    filter: {
      and: [
        {
          property: "Type",
          select: { equals: "Task" },
        },
        {
          property: "Scheduled For",
          date: { on_or_before: today },
        },
        {
          or: [
            {
              property: "Scheduled For",
              date: { on_or_after: today },
            },
          ],
        },
      ],
    },
  });

  return response.results.map(normalizeTask);
}

/**
 * Update a task's properties in Notion.
 */
export async function updateTaskProperties(pageId, updates) {
  const notion = getNotionClient();
  const properties = {};

  if (updates.status !== undefined) {
    properties["Status"] = {
      status: { name: updates.status },
    };

    // Auto-set Completed On when marking as Done
    if (updates.status === "Done") {
      properties["Completed On"] = {
        date: { start: new Date().toISOString().slice(0, 10) },
      };
    }
  }

  if (updates.notes !== undefined) {
    properties["Notes"] = {
      rich_text: [
        {
          type: "text",
          text: { content: updates.notes },
        },
      ],
    };
  }

  if (updates.scheduledFor !== undefined) {
    if (updates.scheduledFor === null) {
      properties["Scheduled For"] = { date: null };
    } else {
      properties["Scheduled For"] = {
        date: { start: updates.scheduledFor },
      };
    }
  }

  if (updates.rolloverCount !== undefined) {
    properties["Rollover Count"] = {
      number: updates.rolloverCount,
    };
  }

  const response = await notion.pages.update({
    page_id: pageId,
    properties,
  });

  return normalizeTask(response);
}

/**
 * Read current Rollover Count for a task (needed for increment).
 */
export async function getTaskRolloverCount(pageId) {
  const notion = getNotionClient();
  const page = await notion.pages.retrieve({ page_id: pageId });
  return page.properties["Rollover Count"]?.number || 0;
}

/**
 * Normalize Notion's nested property format to flat JSON.
 */
function normalizeTask(page) {
  const props = page.properties;

  const title = props["Item"]?.title?.[0]?.plain_text || "Untitled";
  const status = props["Status"]?.status?.name || "Not started";
  const workblock = props["Workblock"]?.select?.name || null;
  const workstream = props["Workstream"]?.select?.name || null;
  const scheduledFor = props["Scheduled For"]?.date?.start || null;
  const rolloverCount = props["Rollover Count"]?.number || 0;
  const notes =
    props["Notes"]?.rich_text?.map((rt) => rt.plain_text).join("") || "";

  return {
    id: page.id,
    title,
    status,
    workblock,
    workstream,
    scheduledFor,
    rolloverCount,
    notes,
  };
}
