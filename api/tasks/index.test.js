import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * REGRESSION TEST: /api/tasks response shape.
 *
 * Phase 1 returned a flat array of task objects. Phase 2 extends the response
 * to ALSO include hanging tasks, but MUST keep returning a flat array
 * (with isHanging:boolean flag) so existing Phase 1 consumers don't break.
 *
 * Iron rule: regressions get tests.
 */

const mockToday = vi.fn();
const mockHanging = vi.fn();

vi.mock("../_notion.js", () => ({
  queryTodaysTasks: mockToday,
  queryHangingTasks: mockHanging,
}));

beforeEach(() => {
  mockToday.mockReset();
  mockHanging.mockReset();
});

function makeMockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.body = data;
      return res;
    },
  };
  return res;
}

describe("/api/tasks shape regression", () => {
  it("returns a FLAT ARRAY (not {today, hanging}) -- preserves Phase 1 contract", async () => {
    mockToday.mockResolvedValue([
      { id: "t1", title: "Today task", status: "Not started" },
    ]);
    mockHanging.mockResolvedValue([
      { id: "h1", title: "Hanging task", status: "In progress" },
    ]);

    const handler = (await import("./index.js")).default;
    const res = makeMockRes();
    await handler({ method: "GET" }, res);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it("today's tasks have isHanging: false", async () => {
    mockToday.mockResolvedValue([{ id: "t1", title: "Today" }]);
    mockHanging.mockResolvedValue([]);

    const handler = (await import("./index.js")).default;
    const res = makeMockRes();
    await handler({ method: "GET" }, res);

    expect(res.body[0].isHanging).toBe(false);
  });

  it("hanging tasks have isHanging: true", async () => {
    mockToday.mockResolvedValue([]);
    mockHanging.mockResolvedValue([{ id: "h1", title: "Hanging" }]);

    const handler = (await import("./index.js")).default;
    const res = makeMockRes();
    await handler({ method: "GET" }, res);

    expect(res.body[0].isHanging).toBe(true);
  });

  it("today's tasks come first, hanging after", async () => {
    mockToday.mockResolvedValue([{ id: "t1" }, { id: "t2" }]);
    mockHanging.mockResolvedValue([{ id: "h1" }]);

    const handler = (await import("./index.js")).default;
    const res = makeMockRes();
    await handler({ method: "GET" }, res);

    expect(res.body.map((t) => t.id)).toEqual(["t1", "t2", "h1"]);
  });

  it("hanging query failure does not break today's tasks", async () => {
    mockToday.mockResolvedValue([{ id: "t1", title: "Today" }]);
    mockHanging.mockRejectedValue(new Error("notion timeout"));

    const handler = (await import("./index.js")).default;
    const res = makeMockRes();
    await handler({ method: "GET" }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe("t1");
    expect(res.body[0].isHanging).toBe(false);
  });

  it("today query failure returns 502", async () => {
    mockToday.mockRejectedValue(new Error("notion down"));

    const handler = (await import("./index.js")).default;
    const res = makeMockRes();
    await handler({ method: "GET" }, res);

    expect(res.statusCode).toBe(502);
  });

  it("returns 405 for non-GET", async () => {
    const handler = (await import("./index.js")).default;
    const res = makeMockRes();
    await handler({ method: "POST" }, res);

    expect(res.statusCode).toBe(405);
  });
});
