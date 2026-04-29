import { getCachedPipeline } from "../_linear.js";

/**
 * GET /api/linear
 *
 * Returns all Linear projects + issues, normalized into the shape Pulse's
 * Build Pipeline tab renders. Server-side proxy: LINEAR_API_KEY never
 * leaves this function.
 *
 * Query params:
 *   ?fresh=1   Bypass the 60s cache (used by the manual Refresh button).
 *
 * Response shape:
 *   { projects, issues, fetchedAt, cacheHit, stale, error }
 *
 * On unrecoverable failure (no cache + fetch failed, or stale > 5min):
 *   503 + { error: "linear_unavailable" }
 *
 * Edge CDN: Cache-Control s-maxage=60 lets Vercel's edge absorb requests
 * across function-instance boundaries; stale-while-revalidate=300 keeps
 * the page snappy if the function cold-starts. Internal function-instance
 * cache (60s TTL, 5min stale ceiling) lives one layer below.
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const fresh = req.query?.fresh === "1" || req.query?.fresh === "true";

  try {
    const result = await getCachedPipeline({ fresh });
    res.setHeader(
      "Cache-Control",
      fresh ? "no-store" : "s-maxage=60, stale-while-revalidate=300",
    );
    res.status(200).json(result);
  } catch (err) {
    console.error(`[api/linear] unrecoverable: ${err.message}`);
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      projects: [],
      issues: [],
      fetchedAt: Date.now(),
      cacheHit: false,
      stale: false,
      error: err.code || "linear_unavailable",
    });
  }
}
