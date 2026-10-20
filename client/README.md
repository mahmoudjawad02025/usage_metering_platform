# Example client

A small **document-processing** demo that calls the Usage Metering service on behalf of its users.

- **Flutter web** (`demo/`): UI only. Talks to `/api` on the same origin. Never holds an API key; never calls the metering service directly.
- **Express BFF** (`src/`): Keeps the account API key server-side (httpOnly `session_id` cookie → in-memory map), validates with Zod, and proxies account/plans/users/usage calls to the service. Auth helpers (`sign-up`, `sign-in`, `demo`) live here; metering rules stay in the service.

Root project docs (API, performance, assumptions): [`../Readme.md`](../Readme.md).

## Run (recommended)

From the **repository root**:

```bash
docker compose up --build
```

Open http://localhost:8080. No Flutter IDE step is required; the image builds the web UI and starts the BFF.

## Local development

Service + Postgres already running (`docker compose up -d postgres service`):

```bash
cd client/demo && flutter build web --release
cd .. && npm run dev
```

Then open http://localhost:8080. The BFF serves the built files from `demo/build/web` and `/api` together (same origin).

### Optional: Flutter web debug (hot reload)

1. Terminal: `cd client && npm run dev` (BFF on port **8080**).
2. Run Flutter against that BFF (do **not** bind Flutter to 8080):

```bash
cd client/demo
flutter run -d chrome --web-port=5173 --dart-define=API_BASE=http://localhost:8080
```

Or in Cursor: Run and Debug → **demo web → BFF :8080** ([`demo/.vscode/launch.json`](demo/.vscode/launch.json)).

Right-click “Run Without Debugging” on `main.dart` alone opens a random port and calls `/api` there — that fails unless `API_BASE` points at the BFF.

## Demo checklist (brief requirements)

After open → **Start demo** (reuses the saved demo account via `STATE_FILE`) or **Fresh demo account** (creates a new Alice/Bob setup):

| # | What to show | How |
| - | ------------ | --- |
| 1 | Users under one account, different plans | `alice` on **Basic** (1000/mo, 20/req), `bob` on **Premium** (10000/mo, 200/req). Account on custom **Demo Tiny** (100/mo, 50/req). |
| 2 | Accepted action | **Consume**: alice, **10** units → accepted; remaining updates. |
| 3 | Rejection by a **user** limit | alice, **25** units → rejected (`max_per_request` / user; Basic allows 20). Nothing consumed. |
| 4 | Rejection by the **shared account** limit | Use **Scenarios → #3**, or consume with bob until Demo Tiny monthly remaining is 0, then another request → rejected (`monthly_allowance` / account). |
| 5 | Plan switch without client code change | Change alice’s plan (e.g. to **Demo Boost**) or the account plan on **Dashboard** / **Users**, then repeat a request that failed before → outcome changes; UI only lists plans from the API. |
| 6 | Decision + remaining allowances | **Consume** DecisionCard and **Dashboard** usage bars. |
| 7 | History / past months | **History** (filters + `appliedLimits` snapshot). Month pickers on Dashboard/Users. |

**Scenarios** page runs the same ideas as guided scripts (stable helper users `scenario-1` …). **Retry last request** on Consume shows idempotent replay (`replayed: true`).

## Pages

- **Auth** — Start demo, sign in with an API key, or create an account (API key shown **once** after sign-up).
- **Dashboard** — Account plan, shared usage, UTC month, change account plan, users summary.
- **Users** — List/register, change plan, per-user usage by month.
- **Plans** — Filter by scope; create/edit **custom** plans (predefined are read-only).
- **Consume** — Process document; accept/reject; retry same `requestId`.
- **History** — Filter by user / outcome / month; prior applied limits.
- **Scenarios** — Seven guided runs (accept, user reject, account reject, plan switch, plan edit, lower allowance, idempotent retry).

## Architecture

1. Widgets only render Cubit state and call Cubit methods (no HTTP/JSON in views).
2. Feature repositories + `ApiClient` are the only HTTP layer in Flutter.
3. BFF: Zod validation; `session_id` cookie → API key in memory; most `/api/*` routes pass through to the service.
4. `POST /api/auth/demo` creates or reuses the Alice/Bob demo account (`ADMIN_KEY` + `STATE_FILE` on the server). Sign-up also uses `ADMIN_KEY` inside the BFF only.
5. Accept/reject and remaining units always come from the service response — the client does not invent metering decisions.

## Limitations

- Sessions are **in memory**; a BFF restart signs everyone out (sign in again or Start demo).
- The browser receives an API key **only** in the sign-up response (copy once). Demo/sign-in never return the key; day-to-day traffic uses the session cookie.
- The metering service has **no delete** endpoints. Scenario helpers reuse stable ids; usage **history** still grows. Wipe data with `docker compose down -v`.
- Simulated “process document” work runs only when the consume result is newly accepted (not on replay).
