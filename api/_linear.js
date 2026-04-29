/**
 * Linear API helper for the Build Pipeline tab.
 *
 * Pulls projects + issues from Linear's GraphQL API server-side, parses
 * the **Stage:** convention from project descriptions, and exposes a
 * cached, ready-to-render shape to the client.
 *
 * NEVER expose LINEAR_API_KEY client-side. This module reads it from
 * process.env and uses it server-side only.
 *
 * Auth: raw Authorization header (no Bearer prefix). Personal API keys
 * from linear.app/settings/api work this way; OAuth tokens use Bearer.
 */

export const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";
export const STAGES = ["Idea", "Scoped", "Building", "Live (Beta)", "Stable"];
const DEFAULT_STAGE = "Idea";

const STAGE_ALIASES = {
  idea: "Idea",
  scoped: "Scoped",
  building: "Building",
  "live (beta)": "Live (Beta)",
  "live beta": "Live (Beta)",
  beta: "Live (Beta)",
  live: "Live (Beta)",
  stable: "Stable",
  shipped: "Stable",
};

// Match: **Stage:** X | __Stage:__ X | Stage: X (with optional emphasis around value)
const STAGE_RE = /(?:\*\*|__)?\s*Stage\s*:\s*(?:\*\*|__)?\s*([^\n\r]+)/i;

const FETCH_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 60_000;
const STALE_MAX_MS = 5 * 60_000;

const cache = new Map();
let inFlight = null;

/**
 * Pulled from Linear. Returns both projects (with parsed Stage) and issues
 * grouped by projectId. Server pre-computes everything the client needs;
 * client never re-runs regex or counts.
 */
export const PIPELINE_QUERY = `
  query Pipeline {
    projects(first: 100, includeArchived: false) {
      nodes {
        id
        name
        url
        icon
        color
        description
        content
        state
        lead { id name }
      }
    }
    issues(first: 250) {
      nodes {
        id
        title
        url
        state { type name }
        project { id }
      }
    }
  }
`;

/**
 * Parse the **Stage:** line from a project description.
 * Returns one of STAGES, defaulting to "Idea" on any miss.
 */
export function parseStage(description) {
  if (!description) return DEFAULT_STAGE;
  const m = description.match(STAGE_RE);
  if (!m) return DEFAULT_STAGE;
  const raw = m[1]
    .trim()
    .replace(/^[*_]+|[*_]+$/g, "") // strip leading/trailing emphasis
    .replace(/[.,;:!?]+$/, "") // strip trailing punctuation
    .toLowerCase()
    .replace(/\s+/g, " ");
  return STAGE_ALIASES[raw] || DEFAULT_STAGE;
}

/**
 * Pull the first non-Stage line of a description as a 140-char summary.
 */
export function parseSummary(description) {
  if (!description) return "";
  const lines = description.split(/\r?\n/);
  const firstNonStage = lines.find(
    (l) => l.trim() && !/^(?:\*\*|__)?\s*Stage\s*:/i.test(l.trim()),
  );
  return firstNonStage ? firstNonStage.trim().slice(0, 140) : "";
}

/**
 * Map Linear's state.type + state.name to our 4 buckets.
 * Unknown/null → "backlog" with a console warning so we notice schema drift.
 */
export function mapIssueState(stateObj) {
  if (!stateObj || typeof stateObj.type !== "string") {
    console.warn("[linear] issue state missing or malformed; defaulting to backlog");
    return "backlog";
  }
  // Workflow-state name "Blocked" wins over generic type mapping
  if (stateObj.name && /blocked/i.test(stateObj.name)) return "blocked";
  switch (stateObj.type) {
    case "completed":
      return "done";
    case "started":
      return "in_progress";
    case "triage":
    case "backlog":
    case "unstarted":
      return "backlog";
    case "canceled":
      return "canceled"; // caller drops these from totalCount
    default:
      console.warn(
        `[linear] unknown issue state.type "${stateObj.type}"; defaulting to backlog`,
      );
      return "backlog";
  }
}

/**
 * Normalize one Linear issue into our flat shape.
 * Returns null for canceled issues (caller filters them out).
 */
export function normalizeIssue(rawIssue) {
  const state = mapIssueState(rawIssue?.state);
  if (state === "canceled") return null;
  return {
    id: rawIssue.id,
    title: rawIssue.title || "Untitled",
    url: rawIssue.url || "",
    state,
    projectId: rawIssue?.project?.id || null,
  };
}

/**
 * Normalize one Linear project. Issues for the project are pre-grouped
 * so we can compute done/total without re-iterating later.
 *
 * Linear has two body fields: `description` (short summary, used for cards)
 * and `content` (full markdown, where the **Stage:** convention lives).
 * Stage is parsed from `content`; if absent, fall back to `description`.
 */
export function normalizeProject(rawProject, projectIssues = []) {
  const description = rawProject?.description || "";
  const content = rawProject?.content || "";
  const totalCount = projectIssues.length;
  const doneCount = projectIssues.filter((i) => i.state === "done").length;
  // Try content first (full body), fall back to description for projects without a content body
  const stage =
    parseStage(content) !== "Idea" ? parseStage(content) : parseStage(description);
  return {
    id: rawProject.id,
    name: rawProject.name || "Untitled",
    url: rawProject.url || "",
    icon: rawProject.icon || null,
    color: rawProject.color || null,
    description, // short, for card summary line
    stage,
    summary: description || parseSummary(content), // prefer Linear's description; fall back to first non-Stage line of content
    state: rawProject.state || "",
    ownerId: rawProject?.lead?.id || null,
    ownerName: rawProject?.lead?.name || null,
    doneCount,
    totalCount,
  };
}

/**
 * Build the final PipelineResponse shape from raw GraphQL data.
 * Pure function; safe to call in tests.
 */
export function buildPipeline(rawData) {
  const rawProjects = rawData?.projects?.nodes || [];
  const rawIssues = rawData?.issues?.nodes || [];

  // Normalize issues (drops canceled), filter to only those attached to a project
  const issues = rawIssues
    .map(normalizeIssue)
    .filter((i) => i !== null && i.projectId !== null);

  // Group by projectId for fast lookup during project normalization
  const issuesByProjectId = new Map();
  for (const issue of issues) {
    if (!issuesByProjectId.has(issue.projectId)) {
      issuesByProjectId.set(issue.projectId, []);
    }
    issuesByProjectId.get(issue.projectId).push(issue);
  }

  const projects = rawProjects.map((p) =>
    normalizeProject(p, issuesByProjectId.get(p.id) || []),
  );

  return { projects, issues };
}

/**
 * POST the pipeline query to Linear. Returns { data, errors } as Linear
 * sends them; caller decides whether partial responses are usable.
 *
 * Throws on network error, timeout, 401/403/429/5xx, or invalid JSON.
 */
export async function fetchPipelineFromLinear() {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    throw new Error(
      `LINEAR_API_KEY env var not set (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unknown"})`,
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(LINEAR_GRAPHQL_URL, {
      method: "POST",
      headers: {
        // Personal API key: raw, no Bearer prefix (verified 2026-04-28)
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: PIPELINE_QUERY }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const err = new Error(`Linear API ${response.status}`);
    err.code = `linear_${response.status}`;
    throw err;
  }

  const json = await response.json();
  return { data: json.data || null, errors: json.errors || null };
}

/**
 * Cached pipeline fetch.
 *
 * - 60s TTL on success
 * - In-flight de-dup: concurrent callers share one fetch promise
 * - On failure (network, 4xx, 5xx, GraphQL partial), serve last-known-good
 *   with stale: true if cache age < STALE_MAX_MS, otherwise propagate
 * - GraphQL partial responses (errors array) NEVER write to cache
 */
export async function getCachedPipeline({ fresh = false } = {}) {
  const key = "pipeline";
  const now = Date.now();
  const hit = cache.get(key);

  if (!fresh && hit && now - hit.fetchedAt < CACHE_TTL_MS) {
    return {
      ...hit.data,
      fetchedAt: hit.fetchedAt,
      cacheHit: true,
      stale: false,
      error: null,
    };
  }

  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const result = await fetchPipelineFromLinear();

      if (result.errors) {
        console.error("[linear] graphql errors:", JSON.stringify(result.errors));
        if (hit && now - hit.fetchedAt < STALE_MAX_MS) {
          return {
            ...hit.data,
            fetchedAt: hit.fetchedAt,
            cacheHit: true,
            stale: true,
            error: "graphql_partial",
          };
        }
        const err = new Error("graphql_partial");
        err.code = "graphql_partial";
        throw err;
      }

      if (!result.data) {
        const err = new Error("graphql_empty");
        err.code = "graphql_empty";
        throw err;
      }

      const pipeline = buildPipeline(result.data);
      cache.set(key, { data: pipeline, fetchedAt: now });
      return {
        ...pipeline,
        fetchedAt: now,
        cacheHit: false,
        stale: false,
        error: null,
      };
    } catch (err) {
      console.error("[linear] fetch failed:", err.message);
      if (hit && now - hit.fetchedAt < STALE_MAX_MS) {
        return {
          ...hit.data,
          fetchedAt: hit.fetchedAt,
          cacheHit: true,
          stale: true,
          error: err.code || err.message || "fetch_failed",
        };
      }
      throw err;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

// Test-only escape hatch to reset cache between tests.
export function __resetCacheForTests() {
  cache.clear();
  inFlight = null;
}
