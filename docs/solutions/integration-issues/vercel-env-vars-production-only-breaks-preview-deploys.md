---
title: Vercel Env Vars Scoped to Production Only Break First PR Preview Deploy with 502
category: integration-issues
date: 2026-04-08
tags: [vercel, environment-variables, preview-deployment, 502-error, serverless-functions, env-scoping, notion-api, first-pr-deploy, runtime-failure]
severity: high
component: vercel environment variables
framework: Vercel Serverless Functions
---

# Vercel Env Vars Scoped to Production Only Break First PR Preview Deploy with 502

## Problem

When a Vercel project's environment variables are added with only the "Production" environment checkbox selected, any preview deployment (triggered by a PR or non-main branch push) will **build successfully** but **fail at runtime** because Preview-scoped env vars are empty. Serverless functions receive `undefined` for secrets like API keys, causing third-party SDKs to initialize unauthenticated and return 502s on the first API call.

This commonly surfaces on the **first PR of a project that was previously shipped straight to main**, since no earlier preview deploy ever exercised the Preview env scope.

### Symptoms

- First-ever preview deployment returns HTTP 502 on API routes while production works fine
- Build passes (Vercel status check shows SUCCESS), but runtime API calls fail
- Local dev via `npm run dev` works perfectly (reads `.env`), masking the root cause until deploy
- Dashboard may load partial UI then show "Failed to load X" error state
- Function logs show third-party SDK auth errors (e.g. Notion's `Could not find database with ID: undefined`)

## Root Cause

Vercel scopes environment variables per-environment (Production, Preview, Development) and **only injects them into deployments matching that scope**. Projects that ship directly to production from day one set env vars with only the Production box checked, which works fine until the workflow shifts to PR-based development. At that point, the first preview deployment spins up without those credentials and any code path depending on them fails at runtime.

The build still succeeds because **env vars are runtime concerns, not build-time ones** — so the regression is invisible until a function is actually invoked.

## Solution

### Step 1: Check env var scoping in Vercel dashboard

Vercel Dashboard → `<project>` → **Settings** (top nav) → **Environment Variables** (left sidebar) → inspect the "Environments" column next to each variable.

If a variable you need in previews only shows **"Production"**, that's your bug.

### Step 2: Fix the scoping

Click the three-dot menu (`...`) on the variable → **Edit**. In the edit modal, check the **Preview** checkbox (and **Development** if you also use `vercel dev` with it). Keep the existing value, click **Save**. Repeat for every affected variable.

**Important**: saving does NOT retroactively inject the values into running deployments — it only affects future builds.

### Step 3: Force a fresh deploy (empty commit pattern)

The Vercel **Redeploy** button in the UI is unreliable here for two reasons:

1. It often redeploys whatever deployment you are currently viewing, which may not be the latest commit on the branch.
2. The "Use existing Build Cache" checkbox muddies the water (it should not matter for env vars, but worth unchecking defensively).

The reliable path is an **empty commit** pushed to the PR branch, which guarantees a brand-new deployment from the current `HEAD` with fresh env var injection:

```bash
git commit --allow-empty -m "chore: trigger fresh vercel deploy" && git push
```

Vercel will auto-deploy within ~60 seconds.

### Step 4: Verify the fix

Once the new preview deployment goes green, hit the API route directly in the browser:

```
https://<your-project>-git-<branch>-<team>.vercel.app/api/<route>
```

**Protected preview deployments require Vercel SSO**, so log in via the Vercel login wall first — otherwise you will see an auth page and misread it as the bug.

Expected:
- `200 OK` with a JSON body → fixed
- `502` with `{"error": "..."}` → not fixed, check function logs

For function logs: Vercel Dashboard → Deployments → click the specific deployment (verify the SHA matches `git rev-parse HEAD` on the branch) → **Functions** tab (or **Logs** tab in newer UI) → look for the error from your handler.

## Code Example: Fail Loud at Cold Start

The real fix for this class of bug is **failing loud at module load time**, not deep inside a request handler. Pattern:

```ts
// lib/env.ts — single source of truth for required env vars
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Check Vercel dashboard -> Settings -> Environment Variables ` +
      `and verify it is set for the current environment ` +
      `(VERCEL_ENV=${process.env.VERCEL_ENV ?? 'unknown'}).`
    );
  }
  return value;
}

export const env = {
  NOTION_API_KEY: requireEnv('NOTION_API_KEY'),
  NOTION_DATABASE_ID: requireEnv('NOTION_DATABASE_ID'),
  GOOGLE_ICAL_URL: requireEnv('GOOGLE_ICAL_URL'),
};
```

Import `env` from this file everywhere. If any var is missing, the function crashes at cold start with a message that names **which variable** and **which environment** it was missing from — no more generic 502s.

**Bonus**: add a `/api/health` route that imports `env` and returns `{ ok: true, env: process.env.VERCEL_ENV }`. Hitting it on any deploy tells you instantly if the env layer is intact, and you can use it as a GitHub Actions gate on every PR.

## Diagnostic Pitfalls (Red Herrings We Hit)

This took ~20 minutes to solve. ~5 of those minutes were spent chasing wrong hypotheses. Save yourself the same pain:

- **Vercel's GitHub status check showed SUCCESS (green)** because the build passed. Env var misconfiguration is a runtime failure, not a build failure, so CI signal lied. Always test the actual runtime, not just the check mark.
- **Redeploying the deployment you are currently viewing** in the Vercel UI instead of the latest commit on the branch. The Redeploy button is contextual and can target an old SHA. Always verify the commit SHA on the new deployment matches `git rev-parse HEAD`.
- **"Use existing Build Cache" checkbox** — worth unchecking defensively when troubleshooting, but env vars are actually injected separately from the build cache so this is mostly a placebo for this bug.
- **Assuming saved env vars apply to currently-running deployments.** They don't. Saving only affects the NEXT deployment. The currently-live preview will keep 502ing until you trigger a new build.
- **Preview deployment auth walls (Vercel SSO) can masquerade as broken routes** if you are not logged in. Log in first, then test.
- **Chasing database-level issues** (in our case, missing Notion status options like "Dropped") when the real problem was the credential itself missing. Always check that the client can authenticate BEFORE debugging specific query failures.

## Prevention

### New Env Var Checklist (follow every time)

- When adding any env var in the Vercel dashboard, **explicitly tick all three checkboxes** (Production, Preview, Development) unless you have a deliberate reason not to.
- Immediately after adding, run `vercel env ls` from the CLI to confirm the var shows up with "Production, Preview, Development" next to it. If you only see "Production", you clicked through the default.
- Pull the var locally with `vercel env pull .env.local` so your local dev environment matches what's actually in Vercel.
- Document the var in `.env.example` the moment you add it.

### Environment Strategy Rules of Thumb

- **Default to all three environments** for anything the app needs to function (API keys, database URLs, auth secrets, feature flags used in runtime code). If the code reads it, all three environments need it.
- **Scope to Production only** when the value is genuinely different and dangerous if leaked to Preview (live Stripe secret key, production webhook secret, prod database write credentials). In that case, add a **separate Preview-scoped value** pointing at staging/sandbox.
- **Scope to Preview only** for test-mode credentials (Stripe test key, sandbox API tokens, staging database URL) so PR deploys don't accidentally hit production resources.
- **Rule of thumb**: if you find yourself checking only one box, you should probably be adding TWO entries (one Production, one Preview), not one.

### Smoke Test Before Merge

- Open the Preview URL from the PR comment and **hit the actual feature path**, not just the homepage. Homepages usually render from static props and hide runtime failures.
- Open browser DevTools Network tab before clicking around. A 500 from an API route with empty env vars is invisible in the UI but screams in Network.
- Run `vercel logs <preview-url>` in a terminal while clicking through. Missing env vars throw at the function cold start and show up immediately in the logs.
- Compare `vercel env ls` output against `grep -r "process.env" api/ src/` — any var referenced in code but not in the env list is a time bomb.

## Other Vercel Per-Environment Traps

Env vars are the most common trap, but the same "Production-only by default" footgun applies to:

- **Build Command / Install Command / Output Directory** — can be overridden per-environment. A Production-only override means Preview builds use defaults and may fail or produce different artifacts.
- **Node.js version** — set per-environment. Preview can silently run on a different Node version than Production.
- **Serverless Function Region** — defaults to Production region; Preview may route differently.
- **Ignored Build Step** — a bash command that decides whether to build. Scoped per-environment; wrong scoping causes Preview to skip builds entirely.
- **Marketplace integration env vars** (Supabase, Neon, Upstash) — auto-populate Production by default, often skip Preview. Same trap, different source.
- **Custom Domains** — only attach to Production. Preview gets `*.vercel.app`, so any code comparing `window.location.hostname` to a hardcoded domain breaks on Preview.
- **Edge Config stores** — connected per-environment. Production-only connection means Preview reads stale/empty config.
- **Cron Jobs** — only run on Production deployments. Don't rely on a cron firing in Preview to validate it.

## The One-Line Rule

**When adding an env var to Vercel, check all three boxes by default (Production, Preview, Development), then run `vercel env ls` to confirm — because the default is a lie.**

## Related Docs

- **Sibling Vercel gotcha**: [`vercel-spa-rewrite-intercepting-api-routes.md`](./vercel-spa-rewrite-intercepting-api-routes.md) — Another Vercel config trap where the build passes but runtime API routes break. Same "works locally, fails on Vercel" pattern.
- **Direct causal link**: [`google-calendar-ical-feed-vs-oauth-readonly.md`](./google-calendar-ical-feed-vs-oauth-readonly.md) — The iCal doc adds `GOOGLE_ICAL_URL` to the Vercel env var set. Step 2 of its deployment notes says "add to Vercel env vars (production + preview)" — this current doc is the gotcha that surfaces when that instruction is skipped or the "Preview" box is missed.
- **Other credential-dependent integration**: [`../runtime-errors/notion-status-vs-select-property-type.md`](../runtime-errors/notion-status-vs-select-property-type.md) — Notion property-type mismatch. Different failure mode but same "env var credential" dependency.
- **Origin of the pattern**: [`../../plans/2026-04-01-001-feat-core-daily-dashboard-plan.md`](../../plans/2026-04-01-001-feat-core-daily-dashboard-plan.md) — Phase 1 plan establishing the "single-user, API key in env vars, no auth UI" approach.

## Related Patterns in the Pulse Codebase

- **"Env var credential" pattern**: `NOTION_API_KEY`, `NOTION_DATABASE_ID`, and `GOOGLE_ICAL_URL` all follow the same pattern — single-user secret stored in env vars, accessed only server-side via `process.env`, never exposed to the client. **All of them must be scoped to every environment where the code runs.**
- **"Works locally, fails on Vercel" pattern**: Shared with the SPA rewrite doc. Both gotchas only manifest in deployed environments because local dev uses different config resolution (Vite middleware loading `.env` directly in one case, Vercel's per-environment injection in the other).
- **"Runtime vs build config" distinction**: Vercel env vars are a runtime concern (they exist per-environment and per-deployment) vs `vercel.json` which is build/routing config committed to the repo. This is why the build can succeed while runtime fails — they are independent layers.
- **"Per-environment config scoping" pattern**: New territory for Pulse docs. This is the first doc that surfaces how Vercel's deployment model treats Production, Preview, and Development as separate config namespaces. Likely relevant to any future platform feature that gets per-environment overrides.
