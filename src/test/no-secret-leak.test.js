import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

/**
 * Guard rail: server-only env var names must NEVER be referenced in client
 * code or build configs that could inline them. Server-only vars belong
 * exclusively in api/.
 *
 * Vite inlines `import.meta.env.VITE_*` and any value placed inside
 * `define:` config — neither uses these names today, but a future engineer
 * could plumb one in by mistake. This test catches that regression.
 *
 * Excluded paths: node_modules, dist, .vercel, .git, .claude, docs, api
 * (legitimate home), and any *.test.{js,jsx} (test files reference the
 * names by design).
 */

const SECRETS = ["LINEAR_API_KEY", "NOTION_API_KEY", "GOOGLE_ICAL_URL"];

const SCAN_ROOTS = ["src", "vite.config.js", "eslint.config.js", "index.html"];
const SKIP_DIR = /(^|\/)(node_modules|dist|\.vercel|\.git|\.claude|docs|api)(\/|$)/;
const FILE_RE = /\.(jsx?|tsx?|html|json|mjs|cjs)$/;

function walk(target) {
  const out = [];
  let s;
  try {
    s = statSync(target);
  } catch {
    return out;
  }
  if (s.isFile()) {
    if (FILE_RE.test(target)) out.push(target);
    return out;
  }
  for (const entry of readdirSync(target)) {
    const full = join(target, entry);
    if (SKIP_DIR.test(full)) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    // Skip test files themselves — they reference the secret names by design
    else if (FILE_RE.test(entry) && !/\.test\.(jsx?|tsx?)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("no secret leak in client-bundle paths", () => {
  it.each(SECRETS)("does not reference %s outside of api/ (server-only)", (secret) => {
    const files = SCAN_ROOTS.flatMap((root) => walk(root));
    const offenders = files.filter((f) => {
      const content = readFileSync(f, "utf-8");
      return content.includes(secret);
    });
    expect(offenders).toEqual([]);
  });
});
