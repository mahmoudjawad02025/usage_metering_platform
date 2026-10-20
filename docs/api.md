# API Reference

Version 1.0.0

Usage Metering and Quota Service, HTTP API.

[Back to the project README](../README.md) · [Design decisions](design_decisions.md) · [Performance](performance.md)

<br>
<hr>
<br>

## Table of Contents

1. [Overview](#overview)
2. [Conventions](#conventions)
3. [Authentication](#authentication)
4. [Errors](#errors)
5. [Pagination](#pagination)
6. [Core Concepts](#core-concepts)
7. [Quick Reference](#quick-reference)
8. [Typical Flow](#typical-flow)
9. [Health](#health)
    1. [GET /health](#get-health)
10. [Accounts](#accounts)
    1. [POST /accounts](#post-accounts)
    2. [GET /accounts/me](#get-accounts-me)
    3. [PUT /accounts/me/plan](#put-accounts-me-plan)
11. [Plans](#plans)
    1. [GET /plans](#get-plans)
    2. [POST /plans](#post-plans)
    3. [GET /plans/:id](#get-plans-id)
    4. [PATCH /plans/:id](#patch-plans-id)
12. [Users](#users)
    1. [POST /users](#post-users)
    2. [GET /users](#get-users)
    3. [GET /users/:id](#get-users-id)
    4. [PUT /users/:id/plan](#put-users-id-plan)
13. [Usage](#usage)
    1. [POST /usage/consume](#post-usage-consume)
    2. [GET /usage](#get-usage)
    3. [GET /usage/users/:userId](#get-usage-users-userid)
    4. [GET /usage/history](#get-usage-history)
14. [Status Code Summary](#status-code-summary)
15. [Limits and Validation Rules](#limits-and-validation-rules)
16. [About This Document](#about-this-document)

<br>
<hr>
<br>

<a id="overview"></a>

## Overview

The service lets a calling application (an **account**) ask whether one of its **users** may consume a number of **units**. Every request is checked against the account plan and the user plan. The decision is recorded and the units are counted only if the request is accepted.

Default base URL when you run the Docker Compose stack: `http://localhost:3000`.

All examples use `curl` with these shell variables:

```bash
BASE=http://localhost:3000
ADMIN_KEY=change_me_to_a_long_random_admin_key     # local demo default
API_KEY=umk_...                                    # returned once by POST /accounts
```

PowerShell users: use `curl.exe`, and put the JSON body in a file (`-d "@body.json"`) to avoid quoting problems.

<br>
<hr>
<br>

<a id="conventions"></a>

## Conventions

1. Request and response bodies are JSON. Send `content-type: application/json` with every body.
2. Field names are camelCase. Identifiers are UUIDs.
3. Timestamps are ISO 8601 strings in UTC (`2026-10-18T15:55:10.868Z`).
4. A month is written `YYYY-MM` and always means a **UTC calendar month**.
5. Request bodies are validated strictly: unknown fields are rejected with `400`.
6. The maximum request body size is 100 KB (`413` above that).
7. A consume request that is **rejected** by the rules still answers `200` with `"accepted": false`. Only problems with the request itself use 4xx codes.

<br>
<hr>
<br>

<a id="authentication"></a>

## Authentication

| Header | Used for | Notes |
| :-- | :-- | :-- |
| `x-admin-key` | `POST /accounts` only | The static `ADMIN_KEY` of the service. Needed because no account exists yet. |
| `x-api-key` | Every other endpoint except `/health` | Issued once when the account is created. Identifies the calling account. |

1. The API key starts with `umk_`. The service stores only its SHA-256 hash, so a lost key cannot be shown again.
2. A key gives access **only to its own account's data**. A user, plan or request that belongs to another account answers `404`, exactly like one that does not exist.
3. A missing, malformed or unknown key answers `401` with code `UNAUTHORIZED`.

<br>
<hr>
<br>

<a id="errors"></a>

## Errors

Every error uses the same body:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found"
  }
}
```

`details` is present only for validation errors, as a list of the invalid fields:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": [
      { "field": "units", "message": "<validation message, text varies>" }
    ]
  }
}
```

Clients should switch on `code`, not on `message`.

| Code | HTTP | Meaning |
| :-- | :-- | :-- |
| `VALIDATION_ERROR` | 400 | A body, query string or URL parameter is invalid. `details` lists each field. |
| `INVALID_JSON` | 400 | The body is not valid JSON. |
| `PLAN_SCOPE_MISMATCH` | 400 | A user plan was used where an account plan is required, or the reverse. |
| `UNAUTHORIZED` | 401 | Missing or invalid API key (or admin key). |
| `FORBIDDEN` | 403 | Identified but not allowed. |
| `PLAN_READ_ONLY` | 403 | An attempt to edit a predefined plan. |
| `NOT_FOUND` | 404 | The resource or route does not exist, or belongs to another account. |
| `CONFLICT` | 409 | A uniqueness rule failed (duplicate plan name, duplicate user `externalId`). |
| `REQUEST_ID_REUSED` | 409 | A `requestId` was already used with a different `userId` or `units`. |
| `PAYLOAD_TOO_LARGE` | 413 | The body is larger than 100 KB. |
| `INTERNAL_ERROR` | 500 | Unexpected failure. No internal detail is returned. A consume that fails this way consumed nothing, and retrying with the same `requestId` is safe. |

<br>
<hr>
<br>

<a id="pagination"></a>

## Pagination

List endpoints (`/plans`, `/users`, `/usage`, `/usage/history`) accept:

| Query parameter | Default | Rules |
| :-- | :-- | :-- |
| `limit` | `20` | Integer from 1 to 100 |
| `offset` | `0` | Integer, 0 or more |

Response shape:

```json
{ "items": [], "total": 0, "limit": 20, "offset": 0 }
```

`total` is the number of rows that match the filters across all pages. Pagination is offset based (simple, as the brief allows). For `/usage`, the pagination applies to the **users** list.

<br>
<hr>
<br>

<a id="core-concepts"></a>

## Core Concepts

**Account, user, plan, units**

1. An **account** has one account plan. Its limits are shared by all its users.
2. A **user** has one user plan. Its limits are individual.
3. A **plan** has a scope (`account` or `user`), a `monthlyAllowance` and a `maxPerRequest`. Predefined plans are read-only. Custom plans belong to one account and can be assigned to that account or its users. Several users may share one plan and still have separate usage totals.
4. **Units** are the single resource that is counted.

**Predefined plans**

| Plan | Scope | monthlyAllowance | maxPerRequest |
| :-- | :-- | --: | --: |
| Starter | account | 10000 | 100 |
| Pro | account | 100000 | 1000 |
| Basic | user | 1000 | 20 |
| Premium | user | 10000 | 200 |

**How a consume request is decided**

1. Both plans must allow the request. The rules, in the order in which the first failing one is reported:
    1. user `max_per_request`
    2. account `max_per_request`
    3. user `monthly_allowance`
    4. account `monthly_allowance`
2. The request is **all or nothing**: either the full amount is accepted or nothing is consumed.
3. An accepted request adds the units to the user's usage and to the account's usage. The account's usage is the sum of its users' accepted usage.
4. `remaining` is `max(0, monthlyAllowance - consumed)`. It is never negative, even if an allowance is lowered below existing usage.

**Idempotency**

1. `requestId` is an idempotency key, unique **per account**, with no expiry.
2. Same `requestId`, same `userId`, same `units`: the stored decision is returned with `"replayed": true`. Balances in the answer are the balances at the time of the original decision. Nothing is counted again. A rejected request is also stored, so replaying it returns the same rejection even if plans changed in between.
3. Same `requestId` with a different `userId` or `units`: `409 REQUEST_ID_REUSED`.
4. If a consume answers `5xx` or the connection drops, retry with the **same** `requestId`.

**Months**

1. A request belongs to the UTC month in which it is first processed. A replay keeps the original month.
2. Each month starts with zero usage at both levels. Previous months stay available through `period` parameters.

**Plan changes**

1. Plan changes apply to new requests after the update succeeds. Editing a custom plan affects everything assigned to it.
2. Switching a plan keeps the units already consumed and does not grant a fresh allowance.
3. The request history stores the limits that applied when each decision was made, so it stays correct after plans change.
4. `remaining` for a **past** month is calculated against the plan limits that apply today (plans are not versioned).

<br>
<hr>
<br>

<a id="quick-reference"></a>

## Quick Reference

| Method | Path | Auth | Purpose |
| :-- | :-- | :-- | :-- |
| GET | [/health](#get-health) | none | Readiness check |
| POST | [/accounts](#post-accounts) | admin key | Create an account and issue its API key |
| GET | [/accounts/me](#get-accounts-me) | API key | The calling account and its plan |
| PUT | [/accounts/me/plan](#put-accounts-me-plan) | API key | Change the account plan |
| GET | [/plans](#get-plans) | API key | List predefined plans and own custom plans |
| POST | [/plans](#post-plans) | API key | Create a custom plan |
| GET | [/plans/:id](#get-plans-id) | API key | Read one plan |
| PATCH | [/plans/:id](#patch-plans-id) | API key | Update a custom plan |
| POST | [/users](#post-users) | API key | Register a user |
| GET | [/users](#get-users) | API key | List users |
| GET | [/users/:id](#get-users-id) | API key | Read one user |
| PUT | [/users/:id/plan](#put-users-id-plan) | API key | Change a user's plan |
| POST | [/usage/consume](#post-usage-consume) | API key | Ask to consume units and record the decision |
| GET | [/usage](#get-usage) | API key | Account and per-user consumed and remaining units |
| GET | [/usage/users/:userId](#get-usage-users-userid) | API key | One user's usage |
| GET | [/usage/history](#get-usage-history) | API key | Paginated request outcomes |

<br>
<hr>
<br>

<a id="typical-flow"></a>

## Typical Flow

```bash
# 1. Operator: create an account. Save the apiKey, it is shown once.
curl -s -X POST $BASE/accounts -H "x-admin-key: $ADMIN_KEY" -H "content-type: application/json" \
  -d '{"name":"Acme Docs"}'

# 2. Application: register a user (Basic plan by default).
curl -s -X POST $BASE/users -H "x-api-key: $API_KEY" -H "content-type: application/json" \
  -d '{"externalId":"alice"}'

# 3. Application: before doing the work, ask the service.
curl -s -X POST $BASE/usage/consume -H "x-api-key: $API_KEY" -H "content-type: application/json" \
  -d '{"userId":"<user id>","units":10,"requestId":"doc-1"}'

# 4. Only if "accepted" is true: process the document.

# 5. Inspect usage and history at any time.
curl -s "$BASE/usage" -H "x-api-key: $API_KEY"
curl -s "$BASE/usage/history?limit=5" -H "x-api-key: $API_KEY"
```

<br>
<hr>
<br>

<a id="health"></a>

## Health

<a id="get-health"></a>

### GET /health

Readiness check. Runs a trivial query against the database. No authentication.

| Status | Body |
| :-- | :-- |
| 200 | `{ "status": "ok" }` |
| 503 | `{ "status": "unavailable" }` (the database cannot be reached) |

```bash
curl -s $BASE/health
```

<br>
<hr>
<br>

<a id="accounts"></a>

## Accounts

<a id="post-accounts"></a>

### POST /accounts

Creates an account and issues its API key. **Requires the admin key** (`x-admin-key`).

Body:

| Field | Type | Required | Rules |
| :-- | :-- | :-- | :-- |
| `name` | string | yes | 1 to 200 characters after trimming |
| `planId` | UUID | no | A **predefined account plan**. Default: Starter. |

Response `201`:

```json
{
  "account": {
    "id": "5b885e09-8825-4eba-9c83-3c6f6f65f822",
    "name": "Acme Docs",
    "plan": {
      "id": "a0000000-0000-4000-8000-000000000001",
      "scope": "account",
      "name": "Starter",
      "monthlyAllowance": 10000,
      "maxPerRequest": 100,
      "isPredefined": true,
      "createdAt": "2026-10-14T08:16:38.539Z",
      "updatedAt": "2026-10-14T08:16:38.539Z"
    },
    "createdAt": "2026-10-17T20:03:22.235Z"
  },
  "apiKey": "umk_Jguxb825tuNe8Y5OWtlI2I76oxpzsIN57tFXC2MBXwY"
}
```

The `apiKey` is returned **only here**. The service stores a hash and cannot show it again.

Errors: `400 VALIDATION_ERROR` (including unknown fields), `400 PLAN_SCOPE_MISMATCH` (a user plan), `401 UNAUTHORIZED` (missing or wrong admin key), `404 NOT_FOUND` (unknown plan, or a custom plan).

```bash
curl -s -X POST $BASE/accounts \
  -H "x-admin-key: $ADMIN_KEY" -H "content-type: application/json" \
  -d '{"name":"Acme Docs"}'
```

<a id="get-accounts-me"></a>

### GET /accounts/me

Returns the authenticated account with its current plan. Response `200`: the same `account` object as above.

Errors: `401`.

```bash
curl -s $BASE/accounts/me -H "x-api-key: $API_KEY"
```

<a id="put-accounts-me-plan"></a>

### PUT /accounts/me/plan

Changes the plan of the authenticated account. Usage already consumed is kept; no fresh allowance is granted.

Body:

| Field | Type | Required | Rules |
| :-- | :-- | :-- | :-- |
| `planId` | UUID | yes | A predefined account plan or one of the account's own **account-scope** plans |

Response `200`: the updated `account`.

Errors: `400 VALIDATION_ERROR`, `400 PLAN_SCOPE_MISMATCH` (a user plan), `401`, `404 NOT_FOUND` (unknown plan, or a custom plan of another account).

```bash
curl -s -X PUT $BASE/accounts/me/plan \
  -H "x-api-key: $API_KEY" -H "content-type: application/json" \
  -d '{"planId":"a0000000-0000-4000-8000-000000000002"}'
```

<br>
<hr>
<br>

<a id="plans"></a>

## Plans

A plan object:

```json
{
  "id": "a0000000-0000-4000-8000-000000000001",
  "scope": "account",
  "name": "Starter",
  "monthlyAllowance": 10000,
  "maxPerRequest": 100,
  "isPredefined": true,
  "createdAt": "2026-10-14T08:16:38.539Z",
  "updatedAt": "2026-10-14T08:16:38.539Z"
}
```

Plans of other accounts are never visible.

<a id="get-plans"></a>

### GET /plans

Lists the predefined plans and the account's own custom plans. Predefined plans come first, then plans are ordered by name.

Query parameters: `scope` (`account` or `user`, optional), `limit`, `offset`.

Response `200`: a page of plan objects.

Errors: `400 VALIDATION_ERROR` (for example `scope=team`), `401`.

```bash
curl -s "$BASE/plans?scope=user" -H "x-api-key: $API_KEY"
```

<br>
<hr>
<br>

<a id="post-plans"></a>

### POST /plans

Creates a custom plan owned by the authenticated account. A custom plan can be assigned to the account (scope `account`) or to users (scope `user`).

Body:

| Field | Type | Required | Rules |
| :-- | :-- | :-- | :-- |
| `scope` | `"account"` or `"user"` | yes | Cannot be changed later |
| `name` | string | yes | 1 to 100 characters after trimming. Unique per account and scope. |
| `monthlyAllowance` | integer | yes | 0 to 1,000,000,000 |
| `maxPerRequest` | integer | yes | 1 to 1,000,000,000 |

Response `201`: the created plan (`isPredefined: false`).

Errors: `400 VALIDATION_ERROR` (including unknown fields such as `isPredefined`), `401`, `409 CONFLICT` (duplicate name in the same scope for this account).

```bash
curl -s -X POST $BASE/plans \
  -H "x-api-key: $API_KEY" -H "content-type: application/json" \
  -d '{"scope":"user","name":"Intern","monthlyAllowance":50,"maxPerRequest":5}'
```

<a id="get-plans-id"></a>

### GET /plans/:id

Returns one plan, if it is predefined or owned by the authenticated account.

Errors: `400 VALIDATION_ERROR` (malformed id), `401`, `404 NOT_FOUND` (unknown, or owned by another account).

```bash
curl -s $BASE/plans/<plan id> -H "x-api-key: $API_KEY"
```

<a id="patch-plans-id"></a>

### PATCH /plans/:id

Updates fields of a custom plan owned by the account. Only the fields you send change. The change applies to the **next** consume request of everything assigned to the plan; no restart is needed.

Body (at least one field):

| Field | Type | Rules |
| :-- | :-- | :-- |
| `name` | string | 1 to 100 characters after trimming. Unique per account and scope. |
| `monthlyAllowance` | integer | 0 to 1,000,000,000 |
| `maxPerRequest` | integer | 1 to 1,000,000,000 |

The `scope` cannot be changed (sending it is a validation error).

If an allowance is lowered below the usage already consumed, `remaining` becomes `0` and further consumption at that level is rejected until allowance is available again. Past request history is not changed.

Response `200`: the updated plan.

Errors: `400 VALIDATION_ERROR` (empty body, `scope`, unknown fields), `401`, `403 PLAN_READ_ONLY` (predefined plan), `404 NOT_FOUND` (unknown or another account's plan), `409 CONFLICT` (renaming into an existing name).

```bash
curl -s -X PATCH $BASE/plans/<plan id> \
  -H "x-api-key: $API_KEY" -H "content-type: application/json" \
  -d '{"maxPerRequest":50}'
```

<br>
<hr>
<br>

<a id="users"></a>

## Users

A user object:

```json
{
  "id": "4843e0a2-ed63-4cde-88a8-4377912e4664",
  "externalId": "alice",
  "plan": {
    "id": "b0000000-0000-4000-8000-000000000001",
    "scope": "user",
    "name": "Basic",
    "monthlyAllowance": 1000,
    "maxPerRequest": 20,
    "isPredefined": true,
    "createdAt": "2026-10-14T08:16:38.539Z",
    "updatedAt": "2026-10-14T08:16:38.539Z"
  },
  "createdAt": "2026-10-18T12:28:50.412Z"
}
```

`id` is the identifier used in all other calls (`userId`). `externalId` is the identifier from the calling application's own system, stored for mapping.

<a id="post-users"></a>

### POST /users

Registers a user under the authenticated account. The account always comes from the API key; it cannot be sent in the body.

Body:

| Field | Type | Required | Rules |
| :-- | :-- | :-- | :-- |
| `externalId` | string | yes | 1 to 255 characters after trimming. Unique within the account. |
| `planId` | UUID | no | A predefined user plan or one of the account's own **user-scope** plans. Default: Basic. |

Response `201`: the user.

Errors: `400 VALIDATION_ERROR` (including an `accountId` field), `400 PLAN_SCOPE_MISMATCH` (an account plan), `401`, `404 NOT_FOUND` (unknown plan, or a custom plan of another account), `409 CONFLICT` (`externalId` already used in this account).

```bash
curl -s -X POST $BASE/users \
  -H "x-api-key: $API_KEY" -H "content-type: application/json" \
  -d '{"externalId":"alice"}'
```

<a id="get-users"></a>

### GET /users

Lists the users of the authenticated account, oldest first.

Query parameters: `limit`, `offset`.

Response `200`: a page of users.

```bash
curl -s "$BASE/users?limit=50" -H "x-api-key: $API_KEY"
```

<a id="get-users-id"></a>

### GET /users/:id

Returns one user with the plan currently applied.

Errors: `400 VALIDATION_ERROR` (malformed id), `401`, `404 NOT_FOUND` (unknown, or a user of another account).

```bash
curl -s $BASE/users/<user id> -H "x-api-key: $API_KEY"
```

<a id="put-users-id-plan"></a>

### PUT /users/:id/plan

Changes the plan of a user. Usage already consumed is kept; no fresh allowance is granted.

Body:

| Field | Type | Required | Rules |
| :-- | :-- | :-- | :-- |
| `planId` | UUID | yes | A predefined user plan or one of the account's own **user-scope** plans |

Response `200`: the updated user.

Errors: `400 VALIDATION_ERROR`, `400 PLAN_SCOPE_MISMATCH` (an account plan), `401`, `404 NOT_FOUND` (unknown user or plan, or anything that belongs to another account).

```bash
curl -s -X PUT $BASE/users/<user id>/plan \
  -H "x-api-key: $API_KEY" -H "content-type: application/json" \
  -d '{"planId":"b0000000-0000-4000-8000-000000000002"}'
```

<br>
<hr>
<br>

<a id="usage"></a>

## Usage

<a id="post-usage-consume"></a>

### POST /usage/consume

Asks to consume units for a user. The service checks the account plan and the user plan together, records the decision, and counts the units only if the request is accepted. **Both accepted and rejected decisions answer `200`.**

Body:

| Field | Type | Required | Rules |
| :-- | :-- | :-- | :-- |
| `userId` | UUID | yes | A user of the authenticated account |
| `units` | integer | yes | A positive whole number, 1 to 1,000,000,000 (not a string, not a decimal) |
| `requestId` | string | yes | 1 to 128 characters after trimming. Idempotency key, unique per account. |

Response `200`:

| Field | Meaning |
| :-- | :-- |
| `accepted` | Whether the full amount was accepted and counted |
| `replayed` | `true` when this is a retry and the stored decision is returned |
| `requestId`, `units` | Echo of the request |
| `period` | The UTC month (`YYYY-MM`) in which the request was first processed |
| `rejection` | `null` when accepted. Otherwise `{ rule, level, limit, remaining? }` |
| `account`, `user` | The plan applied, `consumed` and `remaining` after this decision. `user` also has `id`. |

`rejection.rule` is `max_per_request` or `monthly_allowance`. `rejection.level` is `account` or `user`. `limit` is the per-request limit or the monthly allowance, depending on the rule. `remaining` is present only for `monthly_allowance`.

Accepted (this is a real response from the service):

```json
{
  "accepted": true,
  "replayed": false,
  "requestId": "doc-1",
  "units": 10,
  "period": "2026-10",
  "rejection": null,
  "account": {
    "plan": { "id": "a0000000-0000-4000-8000-000000000001", "name": "Starter", "monthlyAllowance": 10000, "maxPerRequest": 100 },
    "consumed": 10,
    "remaining": 9990
  },
  "user": {
    "id": "4843e0a2-ed63-4cde-88a8-4377912e4664",
    "plan": { "id": "b0000000-0000-4000-8000-000000000001", "name": "Basic", "monthlyAllowance": 1000, "maxPerRequest": 20 },
    "consumed": 10,
    "remaining": 990
  }
}
```

Rejected by the user's per-request limit (25 units for a Basic user, still HTTP 200, nothing consumed):

```json
{
  "accepted": false,
  "replayed": false,
  "requestId": "doc-2",
  "units": 25,
  "period": "2026-10",
  "rejection": { "rule": "max_per_request", "level": "user", "limit": 20 },
  "account": {
    "plan": { "id": "a0000000-0000-4000-8000-000000000001", "name": "Starter", "monthlyAllowance": 10000, "maxPerRequest": 100 },
    "consumed": 10,
    "remaining": 9990
  },
  "user": {
    "id": "4843e0a2-ed63-4cde-88a8-4377912e4664",
    "plan": { "id": "b0000000-0000-4000-8000-000000000001", "name": "Basic", "monthlyAllowance": 1000, "maxPerRequest": 20 },
    "consumed": 10,
    "remaining": 990
  }
}
```

Rejected by the account's shared monthly allowance: `"rejection": { "rule": "monthly_allowance", "level": "account", "limit": 15, "remaining": 5 }` (for an account plan of 15 units per month with 10 already consumed, asking for 10).

Replay: sending the same body again returns the same response with `"replayed": true`. Nothing is counted again.

Errors: `400 VALIDATION_ERROR` (zero, negative, decimal or string `units`, missing or too long `requestId`, malformed `userId`, unknown fields), `401`, `404 NOT_FOUND` (unknown user or a user of another account; nothing is consumed), `409 REQUEST_ID_REUSED`.

```bash
curl -s -X POST $BASE/usage/consume \
  -H "x-api-key: $API_KEY" -H "content-type: application/json" \
  -d '{"userId":"<user id>","units":10,"requestId":"doc-1"}'
```

<a id="get-usage"></a>

### GET /usage

Returns consumed and remaining units for the account and for each of its users, for one UTC month.

Query parameters:

| Parameter | Default | Rules |
| :-- | :-- | :-- |
| `period` | current UTC month | `YYYY-MM` |
| `limit`, `offset` | 20, 0 | Paginate the **users** list |

Users that have no usage in the month are included with `consumed: 0`.

Response `200` (real response from the service):

```json
{
  "period": "2026-10",
  "account": {
    "plan": { "id": "a0000000-0000-4000-8000-000000000001", "name": "Starter", "monthlyAllowance": 10000, "maxPerRequest": 100 },
    "consumed": 10,
    "remaining": 9990
  },
  "users": {
    "items": [
      {
        "id": "4843e0a2-ed63-4cde-88a8-4377912e4664",
        "externalId": "alice",
        "plan": { "id": "b0000000-0000-4000-8000-000000000001", "name": "Basic", "monthlyAllowance": 1000, "maxPerRequest": 20 },
        "consumed": 10,
        "remaining": 990
      }
    ],
    "total": 1,
    "limit": 20,
    "offset": 0
  }
}
```

The `plan` shown is the plan **currently applied**, so callers can inspect the limits in force. For a past month, `remaining` is calculated against today's plan limits.

Errors: `400 VALIDATION_ERROR` (for example `period=2026-13` or `period=2026-10-01`), `401`.

```bash
curl -s "$BASE/usage?period=2026-09" -H "x-api-key: $API_KEY"
```

<a id="get-usage-users-userid"></a>

### GET /usage/users/:userId

Returns the usage of one user for a UTC month.

Query parameter: `period` (`YYYY-MM`, default current month).

Response `200`:

```json
{
  "period": "2026-10",
  "user": {
    "id": "4843e0a2-ed63-4cde-88a8-4377912e4664",
    "externalId": "alice",
    "plan": { "id": "b0000000-0000-4000-8000-000000000001", "name": "Basic", "monthlyAllowance": 1000, "maxPerRequest": 20 },
    "consumed": 10,
    "remaining": 990
  }
}
```

Errors: `400 VALIDATION_ERROR`, `401`, `404 NOT_FOUND` (unknown user or a user of another account).

```bash
curl -s "$BASE/usage/users/<user id>?period=2026-10" -H "x-api-key: $API_KEY"
```

<a id="get-usage-history"></a>

### GET /usage/history

Returns the request outcomes of the account, **newest first**, accepted and rejected, as a page.

Query parameters (all optional):

| Parameter | Rules |
| :-- | :-- |
| `userId` | UUID. Only requests of this user. A user of another account simply yields an empty page. |
| `accepted` | `true` or `false` |
| `period` | `YYYY-MM` |
| `limit`, `offset` | Pagination |

Each item:

```json
{
  "id": "01c3f72f-7087-45b4-9432-7b52889cce23",
  "requestId": "doc-1",
  "userId": "4843e0a2-ed63-4cde-88a8-4377912e4664",
  "units": 10,
  "period": "2026-10",
  "accepted": true,
  "rejection": null,
  "appliedLimits": {
    "account": { "planId": "a0000000-0000-4000-8000-000000000001", "planName": "Starter", "monthlyAllowance": 10000, "maxPerRequest": 100, "consumedBefore": 0 },
    "user": { "planId": "b0000000-0000-4000-8000-000000000001", "planName": "Basic", "monthlyAllowance": 1000, "maxPerRequest": 20, "consumedBefore": 0 }
  },
  "createdAt": "2026-10-18T15:55:10.868Z"
}
```

`appliedLimits` is a snapshot of the plans and the counters **at decision time**. It stays unchanged when plans are edited or switched later, so history remains truthful. For a rejected request, `rejection` has the same shape as in the consume response, built from the limits that applied then.

Errors: `400 VALIDATION_ERROR` (for example `accepted=maybe`, `userId=alice`, `limit=0`, `limit=101`, `offset=-1`), `401`.

```bash
curl -s "$BASE/usage/history?accepted=false&limit=10" -H "x-api-key: $API_KEY"
```

<br>
<hr>
<br>

<a id="status-code-summary"></a>

## Status Code Summary

| Status | When |
| :-- | :-- |
| 200 | Success, **including a consume that is rejected by the rules** |
| 201 | A resource was created (account, plan, user) |
| 400 | Invalid input, invalid JSON, wrong plan scope |
| 401 | Missing or invalid API key or admin key |
| 403 | Editing a predefined plan |
| 404 | Not found, or belongs to another account, or unknown route |
| 409 | Duplicate plan name or user `externalId`, or a reused `requestId` |
| 413 | Body larger than 100 KB |
| 500 | Unexpected failure (nothing was consumed) |
| 503 | `/health` only: the database cannot be reached |

<br>
<hr>
<br>

<a id="limits-and-validation-rules"></a>

## Limits and Validation Rules

| Item | Rule |
| :-- | :-- |
| Account name | 1 to 200 characters after trimming |
| Plan name | 1 to 100 characters after trimming, unique per account and scope |
| User `externalId` | 1 to 255 characters after trimming, unique per account |
| `requestId` | 1 to 128 characters after trimming, unique per account |
| `units` | Integer, 1 to 1,000,000,000 |
| `monthlyAllowance` | Integer, 0 to 1,000,000,000 |
| `maxPerRequest` | Integer, 1 to 1,000,000,000 |
| `period` | `YYYY-MM`, month 01 to 12 |
| `limit` | 1 to 100 (default 20) |
| `offset` | 0 or more (default 0) |
| Request body | At most 100 KB, unknown fields rejected |

<br>
<hr>
<br>

<a id="about-this-document"></a>

## About This Document

1. This reference is **written by hand**, not generated. A generated reference cannot explain the decision rules, idempotency and plan-change behavior, which are the heart of this API.
2. To keep it honest, the response shapes shown here are the ones pinned by the contract tests (`service/tests/integration/api_contract.test.ts`) and the example responses marked as real were copied from running the service. If a response shape changes, a test fails.
3. There is no OpenAPI file and no interactive documentation page. Generating an OpenAPI description from the Zod validation schemas is listed as a next step in the [README](../README.md#next).
4. Not provided: rate limiting, API key rotation or revocation, endpoints to delete accounts, users or plans.