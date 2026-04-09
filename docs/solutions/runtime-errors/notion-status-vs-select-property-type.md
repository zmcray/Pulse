---
title: Notion API Status vs Select Property Type Mismatch
category: runtime-errors
date: 2026-04-01
tags: [notion-api, property-types, status-property, select-property, silent-failure, undefined-value, api-integration]
severity: medium
component: Notion API integration layer (api/_notion.js)
framework: Node.js, @notionhq/client
---

# Notion API Status vs Select Property Type Mismatch

## Problem

Status field returned `undefined` when reading tasks from the Notion Roadmap database. All other properties (title, workblock, workstream, dates) read correctly. Status updates sent via the API appeared to succeed but the value never changed.

## Root Cause

Notion has two distinct property types that look identical in the UI (single-value dropdown) but differ in the API: `select` and `status`.

The code used `select` accessors:

```js
// Read (broken)
const status = props["Status"]?.select?.name;

// Write (broken)
properties: { Status: { select: { name: "In progress" } } }
```

But the actual property type was `status`. The API nests the value differently:

- `select` type: `property.select.name`
- `status` type: `property.status.name`

Reading `.select.name` on a `status`-typed property returns `undefined` because the `select` key doesn't exist. Writing with the wrong shape is silently ignored.

## Investigation

1. Queried tasks and noticed `status: undefined` in normalized output while all other fields were populated.
2. Logged the raw property: `JSON.stringify(properties.Status)` showed `"type": "status"` with a `status` key (not `select`).
3. Used `notion.databases.retrieve()` to inspect the schema, which confirmed:
   ```json
   {
     "type": "status",
     "status": {
       "options": [
         { "name": "Not started", "color": "default" },
         { "name": "In progress", "color": "blue" },
         { "name": "Done", "color": "green" }
       ],
       "groups": [...]
     }
   }
   ```
4. The `groups` array is unique to `status` properties; `select` properties don't have it.

## Solution

Fix the read path:

```js
// Before
const status = props["Status"]?.select?.name || "Not started";

// After
const status = props["Status"]?.status?.name || "Not started";
```

Fix the write path:

```js
// Before
properties["Status"] = { select: { name: newStatus } };

// After
properties["Status"] = { status: { name: newStatus } };
```

**Defensive pattern** for handling any single-value property type:

```js
function getPropertyValue(prop) {
  const type = prop.type;
  return prop[type]?.name;
}
```

This works because Notion always nests the value under a key matching the `type` field.

## Prevention

- **Always retrieve the database schema first.** Call `databases.retrieve(database_id)` and check the `type` field before writing property accessors.
- **Log `property.type` during development.** The fastest diagnostic is `console.log(property.type)` which immediately shows `"select"` or `"status"`.
- **Treat Notion UI property type changes as breaking changes.** Converting a select to status in the Notion UI changes the API shape immediately.
- **Build a typed property map** that reads the schema and provides type-safe accessors, so mismatches are caught at startup rather than at runtime.

## Quick Diagnostic Checklist

- [ ] Have you called `databases.retrieve` and checked the `type` field?
- [ ] Does your code use `.status.name` for status properties and `.select.name` for select properties?
- [ ] Does your write payload use the matching key (`status: {}` vs `select: {}`)?
- [ ] Are you logging `property.type` to confirm the actual type?
