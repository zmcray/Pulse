---
title: Linear GraphQL Personal API Keys Use Raw Authorization Header (No Bearer Prefix)
category: integration-issues
date: 2026-04-28
tags: [linear, graphql, authorization, personal-api-key, oauth, header-format, 401-unauthorized]
severity: medium
component: Linear API auth
framework: Linear GraphQL API
---

# Linear GraphQL Personal API Keys Use Raw Authorization Header (No Bearer Prefix)

## Problem

Linear's GraphQL API accepts two auth schemes: **OAuth tokens** (use `Authorization: Bearer <token>`) and **Personal API keys** (use `Authorization: <key>` — **no `Bearer` prefix**). The two are not interchangeable. Sending a personal key with `Bearer ` prepended returns 401 Unauthorized; sending an OAuth token without `Bearer ` does the same.

LLMs and most HTTP examples in the wild default to `Bearer ` because it's the OAuth 2.0 convention — so without verifying, you'll likely build a Linear client that 401s on the first request.

### Symptoms

```bash
$ curl -X POST https://api.linear.app/graphql \
    -H "Authorization: Bearer lin_api_..." \
    -H "Content-Type: application/json" \
    -d '{"query":"{ viewer { id } }"}'
# → HTTP/1.1 401 Unauthorized
```

Same key without the prefix:

```bash
$ curl -X POST https://api.linear.app/graphql \
    -H "Authorization: lin_api_..." \
    -H "Content-Type: application/json" \
    -d '{"query":"{ viewer { id } }"}'
# → 200 OK with { "data": { "viewer": {...} } }
```

## Root cause

Linear distinguishes the two key formats by their prefix:
- Personal API keys begin with `lin_api_` and are passed verbatim.
- OAuth access tokens are short-lived bearer tokens passed as `Bearer <token>`.

Linear's docs are inconsistent on this — some examples include `Bearer ` even for personal keys. Treat the raw header as the verified format for personal keys until Linear confirms otherwise.

## Solution

Before writing the GraphQL client, run a curl smoke against the auth header format:

```bash
curl -X POST https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ viewer { id } }"}'
```

If `viewer.id` returns, the no-`Bearer` form is correct (this is the format as of 2026-04-28). If it 401s, switch to `Authorization: Bearer $LINEAR_API_KEY` and document the change.

In code (`api/_linear.js`):

```js
const response = await fetch("https://api.linear.app/graphql", {
  method: "POST",
  headers: {
    Authorization: process.env.LINEAR_API_KEY,  // NOT `Bearer ${...}`
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: PIPELINE_QUERY }),
});
```

Add a unit test that asserts the header format so a future "fix it to use Bearer" PR fails CI:

```js
expect(opts.headers.Authorization).toBe(process.env.LINEAR_API_KEY);
expect(opts.headers.Authorization.startsWith("Bearer")).toBe(false);
```

## Related

- `docs/solutions/integration-issues/vercel-env-vars-production-only-breaks-preview-deploys.md` — applies to `LINEAR_API_KEY` too: tick all 3 envs in Vercel.
- Linear personal API key dashboard: https://linear.app/settings/api
