# Example client: document processing demo

A static Flutter web UI served by nginx. The browser talks to the metering service through a same-origin `/svc` proxy (no CORS, no Node demo server).

## Run everything

```
docker compose up --build
```

Open http://localhost:8080 and click **Create demo account** (paste the admin key; the default matches `.env.example`).

That creates an account, two custom plans, and two users (`alice` on Basic, `bob` on Premium). The account starts on a tiny custom plan (100 units per month, 50 per request) so the shared limit is easy to reach. The API key is kept in the browser (localStorage).

## The four demo moments

1. Alice, 10 units: accepted.
2. Alice, 25 units: rejected by the user's per-request limit (Basic allows 20).
3. Bob, 50 units twice: the second is rejected by the shared account allowance.
4. Switch Alice to "Demo Boost" or the account to "Pro" in the Usage card, and repeat the request: the answer changes with no change to the client code.

Use **Retry last request** to see an idempotent replay. Use the restart icon to forget this demo account and start over (local only; old accounts stay in the database).

## Local development

After changing Dart code:

```
docker compose up -d --build client
```

## Security note

The API key is kept in the browser's localStorage. That is acceptable for this local demo. A real application would call the service from its own backend. The admin key is typed once to create the account and is never stored.
