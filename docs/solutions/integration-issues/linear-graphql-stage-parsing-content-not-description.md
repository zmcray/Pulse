---
title: Linear GraphQL `description` Returns Short Summary, Not Markdown Body — Stage Parsing Must Use `content`
category: integration-issues
date: 2026-04-28
tags: [linear, graphql, project-fields, description-vs-content, stage-parsing, schema-discovery, build-pipeline]
severity: medium
component: Linear API project fields
framework: Linear GraphQL API
---

# Linear GraphQL `description` Returns Short Summary, Not Markdown Body — Stage Parsing Must Use `content`

## Problem

When parsing the McRay 5-stage pipeline convention (`**Stage:** Building` etc.) from Linear projects, every project parsed as `"Idea"` (the default fallback) even though projects clearly had Stage lines in their Linear UI.

### Symptoms

```bash
$ curl -sS http://localhost:5173/api/linear | jq '[.projects[].stage] | group_by(.) | map({stage: .[0], count: length})'
[ { "stage": "Idea", "count": 15 } ]   # ← all 15 projects in Idea
```

But the Pulse project's Linear page clearly shows:
```markdown
**Stage:** Building
**Category:** Internal Tool
**Owner:** McRay Group
...
```

The regex `/(?:\*\*|__)?\s*Stage\s*:\s*(?:\*\*|__)?\s*([^\n\r]+)/i` was correct — testing it directly against the markdown returned `"Building"`. The parser was fine. The data was wrong.

## Root cause

**Linear's GraphQL `Project` type has two distinct body fields:**

- `description` — short summary (the one-liner shown on project cards). Linear truncates / treats this as a separate field.
- `content` — the full markdown body, where headers like `**Stage:**`, `**Category:**`, `**Owner:**` actually live.

Our initial GraphQL query asked for `description`, which returned a 60-130 character one-liner with no Stage line. The full markdown was in `content`, which we hadn't requested.

The Linear MCP tools (`mcp__linear__list_projects`) conflate these in their JSON output, so seeing the conflated shape during planning gave a false impression that the markdown body was the `description`.

```graphql
# What we shipped first (broken):
query Pipeline {
  projects(first: 100) {
    nodes { id name url description }   # description = short summary only
  }
}

# What's correct:
query Pipeline {
  projects(first: 100) {
    nodes { id name url description content }   # content has the markdown
  }
}
```

## Solution

1. **Add `content` to the project query** in `api/_linear.js`:
```graphql
projects(first: 100, includeArchived: false) {
  nodes {
    id name url icon color
    description    # short summary — used as card subtitle
    content        # full markdown — parse Stage from this
    state
    lead { id name }
  }
}
```

2. **Parse Stage from `content` first, fall back to `description`** for legacy projects that put the convention in the short field:
```js
export function normalizeProject(rawProject, projectIssues = []) {
  const description = rawProject?.description || "";
  const content = rawProject?.content || "";
  const stageFromContent = parseStage(content);
  const stage = stageFromContent !== "Idea" ? stageFromContent : parseStage(description);
  return {
    ...,
    description,             // for display
    summary: description,    // alias for client clarity
    stage,                   // already parsed server-side
  };
}
```

3. **Verify with a smoke test before declaring success.** A direct curl reveals the structure:
```bash
curl -X POST https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ projects(first: 1) { nodes { name description content } } }"}'
```

If `description.length` is short (< 200 chars typically) and `content.length` is much larger — that's the tell.

## Prevention

- **Always smoke-test the actual API response shape before writing parsers.** A 5-second curl tells you what the schema returns; an LLM telling you what fields exist is a hint, not ground truth.
- **Pulse-specific:** Stage / Category / Owner conventions live in Linear's project `content` field. The McRay Build Pipeline parser convention is documented in `00_Context/databases.md` and `00_Context/CLAUDE.md`.
- **Sanity check during dev:** if every project parses to the same default value, the field name is probably wrong, not the regex.

## Related

- `docs/solutions/integration-issues/linear-graphql-personal-api-key-no-bearer-prefix.md` — Linear personal-key auth gotcha (no Bearer prefix).
- `00_Context/databases.md` — Build Pipeline section now documents that Stage lives in `content`, not `description`.
- Linear issue: [MCR-86](https://linear.app/mcraygroup/issue/MCR-86) (Build Pipeline tab — surfaced this gotcha during initial smoke test).
