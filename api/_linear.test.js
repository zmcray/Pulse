import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseStage,
  parseSummary,
  mapIssueState,
  normalizeIssue,
  normalizeProject,
  buildPipeline,
  fetchPipelineFromLinear,
  getCachedPipeline,
  PIPELINE_QUERY,
  STAGES,
  __resetCacheForTests,
} from "./_linear.js";

beforeEach(() => {
  __resetCacheForTests();
  process.env.LINEAR_API_KEY = "lin_api_test";
});

describe("parseStage", () => {
  it("defaults to Idea on empty/null/undefined", () => {
    expect(parseStage("")).toBe("Idea");
    expect(parseStage(null)).toBe("Idea");
    expect(parseStage(undefined)).toBe("Idea");
  });

  it("defaults to Idea when no Stage line present", () => {
    expect(parseStage("Just a description with no stage info.")).toBe("Idea");
  });

  it.each(STAGES)("matches canonical stage %s", (stage) => {
    expect(parseStage(`**Stage:** ${stage}`)).toBe(stage);
  });

  it("matches mixed casing", () => {
    expect(parseStage("**Stage:** BUILDING")).toBe("Building");
    expect(parseStage("**Stage:** building")).toBe("Building");
    expect(parseStage("**stage:** Building")).toBe("Building");
  });

  it("matches markdown emphasis around the value", () => {
    expect(parseStage("**Stage:** **Building**")).toBe("Building");
    expect(parseStage("**Stage:** __Building__")).toBe("Building");
    expect(parseStage("__Stage:__ Building")).toBe("Building");
    expect(parseStage("Stage: Building")).toBe("Building");
  });

  it("strips trailing punctuation", () => {
    expect(parseStage("**Stage:** Building.")).toBe("Building");
    expect(parseStage("**Stage:** Building!")).toBe("Building");
    expect(parseStage("**Stage:** Building,")).toBe("Building");
  });

  it("matches aliases", () => {
    expect(parseStage("**Stage:** beta")).toBe("Live (Beta)");
    expect(parseStage("**Stage:** Beta")).toBe("Live (Beta)");
    expect(parseStage("**Stage:** live (beta)")).toBe("Live (Beta)");
    expect(parseStage("**Stage:** live beta")).toBe("Live (Beta)");
    expect(parseStage("**Stage:** Live")).toBe("Live (Beta)");
    expect(parseStage("**Stage:** shipped")).toBe("Stable");
  });

  it("first Stage line wins when multiple present", () => {
    const desc = "**Stage:** Building\n\nSome notes.\n\n**Stage:** Stable";
    expect(parseStage(desc)).toBe("Building");
  });

  it("falls back to Idea on unknown values", () => {
    expect(parseStage("**Stage:** Wibble")).toBe("Idea");
    expect(parseStage("**Stage:** ")).toBe("Idea");
  });
});

describe("parseSummary", () => {
  it("returns empty string for empty/null", () => {
    expect(parseSummary("")).toBe("");
    expect(parseSummary(null)).toBe("");
  });

  it("returns first non-Stage line", () => {
    const desc = "**Stage:** Building\n\nA cool project.";
    expect(parseSummary(desc)).toBe("A cool project.");
  });

  it("returns empty string when only Stage line present", () => {
    expect(parseSummary("**Stage:** Building")).toBe("");
  });

  it("truncates to 140 chars", () => {
    const long = "x".repeat(200);
    const desc = `**Stage:** Building\n\n${long}`;
    expect(parseSummary(desc)).toHaveLength(140);
  });
});

describe("mapIssueState", () => {
  it("returns backlog and warns on null/missing state", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(mapIssueState(null)).toBe("backlog");
    expect(mapIssueState(undefined)).toBe("backlog");
    expect(mapIssueState({})).toBe("backlog");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("maps Linear's state types to our buckets", () => {
    expect(mapIssueState({ type: "completed", name: "Done" })).toBe("done");
    expect(mapIssueState({ type: "started", name: "In Progress" })).toBe("in_progress");
    expect(mapIssueState({ type: "triage", name: "Triage" })).toBe("backlog");
    expect(mapIssueState({ type: "backlog", name: "Backlog" })).toBe("backlog");
    expect(mapIssueState({ type: "unstarted", name: "Todo" })).toBe("backlog");
    expect(mapIssueState({ type: "canceled", name: "Cancelled" })).toBe("canceled");
  });

  it("name=Blocked overrides type", () => {
    expect(mapIssueState({ type: "started", name: "Blocked" })).toBe("blocked");
    expect(mapIssueState({ type: "unstarted", name: "blocked on auth" })).toBe("blocked");
  });

  it("warns and falls back on unknown type", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(mapIssueState({ type: "wibble", name: "Wibble" })).toBe("backlog");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("wibble"));
    warn.mockRestore();
  });
});

describe("normalizeIssue", () => {
  it("returns null for canceled issues", () => {
    expect(
      normalizeIssue({
        id: "i1",
        title: "x",
        url: "u",
        state: { type: "canceled", name: "Cancelled" },
        project: { id: "p1" },
      }),
    ).toBeNull();
  });

  it("returns flat shape for normal issues", () => {
    expect(
      normalizeIssue({
        id: "i1",
        title: "Build it",
        url: "https://linear.app/x/issue/i1",
        state: { type: "started", name: "In Progress" },
        project: { id: "p1" },
      }),
    ).toEqual({
      id: "i1",
      title: "Build it",
      url: "https://linear.app/x/issue/i1",
      state: "in_progress",
      projectId: "p1",
    });
  });

  it("handles null project", () => {
    const result = normalizeIssue({
      id: "i1",
      title: "x",
      url: "",
      state: { type: "backlog", name: "Backlog" },
      project: null,
    });
    expect(result.projectId).toBeNull();
  });
});

describe("normalizeProject", () => {
  it("parses stage from content (full markdown), uses description as summary", () => {
    const project = normalizeProject(
      {
        id: "p1",
        name: "Pulse",
        url: "u",
        description: "Daily task dashboard.",
        content: "**Stage:** Building\n**Owner:** McRay Group\n\nDaily task dashboard with Notion sync.",
      },
      [
        { id: "i1", state: "done" },
        { id: "i2", state: "done" },
        { id: "i3", state: "in_progress" },
        { id: "i4", state: "backlog" },
      ],
    );
    expect(project.doneCount).toBe(2);
    expect(project.totalCount).toBe(4);
    expect(project.stage).toBe("Building");
    expect(project.summary).toBe("Daily task dashboard.");
  });

  it("falls back to parsing stage from description when content is empty", () => {
    const project = normalizeProject(
      {
        id: "p1",
        name: "Legacy",
        url: "u",
        description: "**Stage:** Stable\n\nOld project.",
        content: "",
      },
      [],
    );
    expect(project.stage).toBe("Stable");
  });

  it("falls back to first non-Stage line of content when description is empty", () => {
    const project = normalizeProject(
      {
        id: "p1",
        name: "x",
        url: "u",
        description: "",
        content: "**Stage:** Idea\n\nFirst-line summary.",
      },
      [],
    );
    expect(project.summary).toBe("First-line summary.");
  });

  it("handles null lead", () => {
    const project = normalizeProject(
      { id: "p1", name: "x", url: "u", description: "", content: "", lead: null },
      [],
    );
    expect(project.ownerId).toBeNull();
    expect(project.ownerName).toBeNull();
  });

  it("handles null description and content (coerces to empty strings)", () => {
    const project = normalizeProject(
      { id: "p1", name: "x", url: "u", description: null, content: null },
      [],
    );
    expect(project.description).toBe("");
    expect(project.stage).toBe("Idea");
    expect(project.summary).toBe("");
  });

  it("project with 0 issues has 0/0 progress", () => {
    const project = normalizeProject(
      { id: "p1", name: "x", url: "u", description: "", content: "" },
      [],
    );
    expect(project.totalCount).toBe(0);
    expect(project.doneCount).toBe(0);
  });
});

describe("buildPipeline", () => {
  it("groups issues by projectId and drops canceled and orphans", () => {
    const data = {
      projects: {
        nodes: [
          { id: "p1", name: "A", url: "", description: "", content: "**Stage:** Building", lead: null },
          { id: "p2", name: "B", url: "", description: "", content: "**Stage:** Stable", lead: null },
        ],
      },
      issues: {
        nodes: [
          { id: "i1", title: "x", url: "", state: { type: "completed" }, project: { id: "p1" } },
          { id: "i2", title: "x", url: "", state: { type: "started" }, project: { id: "p1" } },
          { id: "i3", title: "x", url: "", state: { type: "completed" }, project: { id: "p2" } },
          { id: "i4", title: "x", url: "", state: { type: "canceled" }, project: { id: "p2" } },
          { id: "i5", title: "x", url: "", state: { type: "backlog" }, project: null }, // orphan
        ],
      },
    };
    const result = buildPipeline(data);
    expect(result.projects).toHaveLength(2);
    expect(result.projects[0].doneCount).toBe(1);
    expect(result.projects[0].totalCount).toBe(2);
    expect(result.projects[1].doneCount).toBe(1);
    expect(result.projects[1].totalCount).toBe(1);
    expect(result.issues).toHaveLength(3); // i4 dropped (canceled), i5 dropped (orphan)
  });

  it("handles empty data gracefully", () => {
    expect(buildPipeline(null)).toEqual({ projects: [], issues: [] });
    expect(buildPipeline({})).toEqual({ projects: [], issues: [] });
  });
});

describe("PIPELINE_QUERY", () => {
  it("is a stable string (snapshot guards typos)", () => {
    expect(PIPELINE_QUERY).toMatchSnapshot();
  });
});

describe("fetchPipelineFromLinear", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    delete global.fetch;
  });

  it("throws when LINEAR_API_KEY is missing", async () => {
    delete process.env.LINEAR_API_KEY;
    await expect(fetchPipelineFromLinear()).rejects.toThrow(/LINEAR_API_KEY/);
  });

  it("sends Authorization header without Bearer prefix", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { projects: { nodes: [] }, issues: { nodes: [] } } }),
    });
    await fetchPipelineFromLinear();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers.Authorization).toBe("lin_api_test");
    expect(opts.headers.Authorization.startsWith("Bearer")).toBe(false);
  });

  it("throws with code on 401", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    const err = await fetchPipelineFromLinear().catch((e) => e);
    expect(err.code).toBe("linear_401");
  });

  it("throws with code on 429", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    const err = await fetchPipelineFromLinear().catch((e) => e);
    expect(err.code).toBe("linear_429");
  });

  it("throws with code on 503", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    const err = await fetchPipelineFromLinear().catch((e) => e);
    expect(err.code).toBe("linear_503");
  });

  it("returns errors array alongside data on partial response", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { projects: { nodes: [] }, issues: { nodes: [] } }, errors: [{ message: "rate limited" }] }),
    });
    const result = await fetchPipelineFromLinear();
    expect(result.errors).toEqual([{ message: "rate limited" }]);
    expect(result.data).toBeTruthy();
  });
});

describe("getCachedPipeline", () => {
  let fetchMock;
  const okResponse = (overrides = {}) => ({
    ok: true,
    status: 200,
    json: async () => ({
      data: {
        projects: { nodes: [{ id: "p1", name: "Pulse", url: "u", description: "Daily dashboard.", content: "**Stage:** Building\n\nDaily dashboard.", lead: null }] },
        issues: { nodes: [] },
        ...overrides,
      },
    }),
  });

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    delete global.fetch;
  });

  it("populates cache on first call and serves from cache on second", async () => {
    fetchMock.mockResolvedValue(okResponse());
    const first = await getCachedPipeline();
    const second = await getCachedPipeline();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(second.stale).toBe(false);
    expect(second.projects[0].name).toBe("Pulse");
  });

  it("?fresh=1 bypasses cache", async () => {
    fetchMock.mockResolvedValue(okResponse());
    await getCachedPipeline();
    await getCachedPipeline({ fresh: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("de-duplicates concurrent in-flight fetches", async () => {
    let resolveFetch;
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = () => resolve(okResponse());
      }),
    );
    const [a, b] = await Promise.all([
      Promise.resolve().then(() => getCachedPipeline()),
      Promise.resolve().then(() => getCachedPipeline()),
      Promise.resolve().then(() => resolveFetch()),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.projects[0].id).toBe("p1");
    expect(b.projects[0].id).toBe("p1");
  });

  it("serves last-known-good with stale=true on 401 (cache not poisoned)", async () => {
    // First call: populate cache
    fetchMock.mockResolvedValueOnce(okResponse());
    await getCachedPipeline();

    // Second call: 401 with fresh bypass
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
    const result = await getCachedPipeline({ fresh: true });
    expect(result.stale).toBe(true);
    expect(result.error).toBe("linear_401");
    expect(result.projects[0].name).toBe("Pulse"); // last-known-good preserved

    // Third call: cache untainted (returns the original good entry, not stale)
    // Have to wait beyond TTL to force a re-read; instead, force fresh and ensure
    // good payload returns when fetch recovers
    fetchMock.mockResolvedValueOnce(okResponse());
    const recovered = await getCachedPipeline({ fresh: true });
    expect(recovered.stale).toBe(false);
    expect(recovered.error).toBeNull();
  });

  it("serves stale on 429", async () => {
    fetchMock.mockResolvedValueOnce(okResponse());
    await getCachedPipeline();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) });
    const result = await getCachedPipeline({ fresh: true });
    expect(result.stale).toBe(true);
    expect(result.error).toBe("linear_429");
  });

  it("propagates error when no cache present and fetch fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(getCachedPipeline()).rejects.toThrow();
  });

  it("does NOT cache GraphQL partial responses (errors array)", async () => {
    // Populate cache with good data
    fetchMock.mockResolvedValueOnce(okResponse());
    await getCachedPipeline();

    // Partial response: must serve stale, NOT overwrite cache
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: { projects: { nodes: [] }, issues: { nodes: [] } },
        errors: [{ message: "partial failure" }],
      }),
    });
    const result = await getCachedPipeline({ fresh: true });
    expect(result.stale).toBe(true);
    expect(result.error).toBe("graphql_partial");

    // Verify cache wasn't overwritten: a recovered fetch shows the good name remained
    fetchMock.mockResolvedValueOnce(okResponse());
    const recovered = await getCachedPipeline({ fresh: true });
    expect(recovered.projects[0].name).toBe("Pulse");
  });

  it("partial response with no cache propagates error", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: { projects: { nodes: [] }, issues: { nodes: [] } },
        errors: [{ message: "boom" }],
      }),
    });
    const err = await getCachedPipeline().catch((e) => e);
    expect(err.code).toBe("graphql_partial");
  });
});
