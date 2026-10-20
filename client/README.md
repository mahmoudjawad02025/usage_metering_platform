# Example client: document processing demo
A small "document processing" application that uses the metering service on behalf of its users.
## Run everything
```
docker compose up --build
```
Open http://localhost:8080.
- The demo server creates an account, issues its API key, creates two plans, and registers two users
  (`alice` on Basic, `bob` on Premium). The key stays on the server (`/data/demo_state.json`).
- The account starts on a tiny custom plan (100 units per month, 50 per request) so its shared limit is easy to reach.
## The four demo moments
1. Alice, 10 units: accepted.
2. Alice, 25 units: rejected by the user's per-request limit (Basic allows 20).
3. Bob, 50 units twice: the second is rejected by the shared account allowance.
4. Switch Alice to "Demo Boost" or the account to "Pro" in the Usage card, and repeat the request:
   the answer changes with no change to the client code.
Use "Retry last request" to see an idempotent replay, and the restart icon to start over with a fresh account.
## Local development
Start the service and PostgreSQL (`docker compose up -d postgres service`), then:
```
cd client/demo && flutter build web --release
cd .. && npm run dev
```