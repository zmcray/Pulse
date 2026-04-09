import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Contract test for queryHangingTasks: verifies the Notion query filter
 * is correct so we don't accidentally pull today's tasks or tasks older
 * than 7 days into the carry-over view.
 *
 * Mocks @notionhq/client so this is a unit test, not an integration test.
 */

const mockQuery = vi.fn();

vi.mock("@notionhq/client", () => ({
  Client: class {
    constructor() {
      this.databases = { query: mockQuery };
    }
  },
}));

beforeEach(() => {
  mockQuery.mockReset();
  process.env.NOTION_API_KEY = "test_key";
  process.env.NOTION_DATABASE_ID = "test_db";
});

describe("queryHangingTasks contract", () => {
  it("uses Status NOT Done AND Status NOT Dropped AND date range [today-7, today-1]", async () => {
    mockQuery.mockResolvedValue({ results: [] });

    // Reset module so the singleton is fresh and uses our mock
    vi.resetModules();
    const { queryHangingTasks } = await import("./_notion.js");

    await queryHangingTasks();

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const callArg = mockQuery.mock.calls[0][0];

    // Filter must be an AND with 5 conditions
    expect(callArg.filter.and).toHaveLength(5);
    const filters = callArg.filter.and;

    // Type = Task
    expect(filters[0]).toEqual({
      property: "Type",
      select: { equals: "Task" },
    });

    // Status NOT Done
    expect(filters[1]).toEqual({
      property: "Status",
      status: { does_not_equal: "Done" },
    });

    // Status NOT Dropped
    expect(filters[2]).toEqual({
      property: "Status",
      status: { does_not_equal: "Dropped" },
    });

    // Scheduled For >= 7 days ago
    expect(filters[3].property).toBe("Scheduled For");
    expect(filters[3].date.on_or_after).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Scheduled For <= yesterday (NOT today)
    expect(filters[4].property).toBe("Scheduled For");
    expect(filters[4].date.on_or_before).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Verify date range is exactly 1-7 days ago, not 0-7 (excludes today)
    const today = new Date().toISOString().slice(0, 10);
    expect(filters[3].date.on_or_after).not.toBe(today);
    expect(filters[4].date.on_or_before).not.toBe(today);
  });

  it("returns normalized task objects from the response", async () => {
    mockQuery.mockResolvedValue({
      results: [
        {
          id: "page-1",
          properties: {
            Item: { title: [{ plain_text: "Stale task" }] },
            Status: { type: "status", status: { name: "In progress" } },
            Workblock: { type: "select", select: { name: "Strategy" } },
            Workstream: { type: "select", select: null },
            "Scheduled For": { type: "date", date: { start: "2026-04-01" } },
            "Rollover Count": { type: "number", number: 3 },
            Notes: { type: "rich_text", rich_text: [] },
          },
        },
      ],
    });

    vi.resetModules();
    const { queryHangingTasks } = await import("./_notion.js");

    const result = await queryHangingTasks();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "page-1",
      title: "Stale task",
      status: "In progress",
      workblock: "Strategy",
      rolloverCount: 3,
    });
  });
});
