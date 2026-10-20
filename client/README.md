# Example client

A small document-processing app that demonstrates the Usage Metering service end to end: a thin BFF holds API keys, and a Flutter web UI talks only to `/api` on the same origin.

## Run

```bash
docker compose up --build
```

Open http://localhost:8080.

Local development (service + Postgres already up):

```bash
cd client/demo && flutter build web --release
cd .. && npm run dev
```

## Pages

- **Auth** — try the demo (one click), sign in with an API key, or create an account (API key shown once).
- **Dashboard** — account plan, shared usage bar, UTC month, change account plan, users summary.
- **Users** — paginated list, register, change plan, per-user monthly usage.
- **Plans** — filter by scope, create/edit custom plans (predefined are read-only).
- **Consume** — process a document, see accept/reject, retry the same `requestId`.
- **History** — filter by user/outcome/month; each row keeps the limits that applied then.
- **Scenarios** — seven guided scripts (accept, user reject, account reject, plan switch, plan edit, lower allowance, idempotent retry).

## Architecture (short)

1. Flutter UI widgets only render state and call Cubit methods — no HTTP/JSON in views.
2. Feature Cubits + repositories talk to `ApiClient` (the only HTTP layer).
3. The Express BFF validates with Zod, keeps `session_id` (httpOnly cookie) → API key in memory, and proxies 1:1 to the metering service.
4. `POST /api/auth/demo` reuses or creates the Alice/Bob demo account (key stored in `STATE_FILE`).

## Limitations

- Sessions live in BFF memory and are lost on restart (sign in again or start the demo).
- `ADMIN_KEY` is inside the BFF so the demo can create accounts; it never reaches the browser.
- The service has no delete/rename endpoints; old demo accounts remain in the database.
- The API key appears in a browser response only once, right after sign-up.
