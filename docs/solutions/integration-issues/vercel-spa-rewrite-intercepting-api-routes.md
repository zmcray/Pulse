---
title: Vercel SPA Catch-All Rewrite Intercepting Serverless API Routes
category: integration-issues
date: 2026-04-01
tags: [vercel, vercel-json, spa-rewrite, serverless-functions, routing, 405-method-not-allowed, deployment, vite, react]
severity: high
component: vercel.json routing configuration
framework: React, Vite, Vercel Serverless Functions
---

# Vercel SPA Catch-All Rewrite Intercepting Serverless API Routes

## Problem

PATCH requests to `/api/tasks/:id` returned HTTP 405 Method Not Allowed with `content-type: text/html` in production on Vercel. The same requests worked fine on the local Vite dev server.

The Vercel dashboard showed all serverless functions deployed correctly. The functions had zero invocations despite the frontend loading fine.

## Root Cause

The `vercel.json` had a catch-all SPA rewrite:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

This matched every incoming path, including `/api/*` routes. Vercel sent API requests to the static `index.html` instead of the serverless functions. The static file handler only serves GET, so POST/PATCH/DELETE returned 405.

**Why it worked locally:** The Vite dev server used a custom middleware plugin that intercepted `/api/*` requests before they hit the static file handler. Vercel's rewrite rules don't apply in local dev.

## Investigation

1. `curl -sv` against the API endpoint revealed `content-type: text/html` instead of `application/json`, confirming the request never reached the serverless function.
2. `npx vercel inspect` showed all three functions deployed: `api/tasks/index`, `api/tasks/[id]`, `api/triage`.
3. The mismatch between "functions exist" and "functions not invoked" pointed to routing, not deployment.

## Solution

Replace the single catch-all rewrite with two ordered rules:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/((?!api/).*)", "destination": "/" }
  ]
}
```

**How it works:**
- Rule 1: Identity rewrite for `/api/*` that explicitly claims API routes before the SPA fallback.
- Rule 2: Negative lookahead `(?!api/)` ensures only non-API paths rewrite to `/` for client-side routing.

Vercel evaluates rewrites top-down and stops at the first match.

## Prevention

- **Never use a bare catch-all rewrite.** Always exclude `/api` paths with a negative lookahead or a preceding API passthrough rule.
- **Smoke test non-GET endpoints after every deploy.** `curl -X PATCH <url>/api/<endpoint>` should return JSON, not HTML.
- **Check Vercel function invocation counts.** Zero invocations with a working frontend = routing interception.
- **Test with `vercel dev` locally** before pushing; it applies the same rewrite rules as production.

## Quick Diagnostic Checklist

- [ ] Does vercel.json contain a catch-all rewrite `/(.*)`?
- [ ] Does the catch-all exclude `/api` paths?
- [ ] Does `curl -X POST <deploy-url>/api/<endpoint>` return JSON (not HTML/405)?
- [ ] Do Vercel dashboard Functions show invocations after a request?
