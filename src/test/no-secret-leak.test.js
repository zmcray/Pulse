import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

/**
 * Guard rail: LINEAR_API_KEY (or any other secret) must NEVER be referenced
 * in src/ or transmitted to the client bundle. Server-only env vars belong
 * in api/ exclusively.
 *
 * This is a static check (no build required). Vite uses VITE_-prefixed env
 * vars for client inlining; LINEAR_API_KEY has no such prefix and is read
 * only via process.env in api/_linear.js. If anyone grabs it via
 * import.meta.env or process.env from src/, this test fails.
 */

const SECRETS = ["LINEAR_API_KEY", "NOTION_API_KEY", "GOOGLE_ICAL_URL"];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...walk(full));
    // Skip test files themselves — they reference the secret names by design
    else if (/\.(js|jsx)$/.test(entry) && !/\.test\.(js|jsx)$/.test(entry))
      out.push(full);
  }
  return out;
}

describe("no secret leak in src/", () => {
  it.each(SECRETS)("does not reference %s in src/", (secret) => {
    const files = walk("src");
    const offenders = files.filter((f) => {
      const content = readFileSync(f, "utf-8");
      return content.includes(secret);
    });
    expect(offenders).toEqual([]);
  });
});
