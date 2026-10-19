**Performance: method, results and lessons**

1. How the load tests work
    1. Tool: autocannon, driven from TypeScript (`perf/scripts`).
    2. Data: created through the public API (admin key, accounts, plans, users). Nothing is inserted with SQL.
    3. Requests: `POST /usage/consume` with random users, random units (1 to 10) and a unique request id.
    4. Every run: seed data, warm up on a separate account (3 s), measured load (20 s, 50 connections), wait 1.5 s, verify with SQL.
    5. Scenarios:
        1. `spread`: 20 accounts x 50 users, nothing is rejected.
        2. `hot-account`: 1 account x 100 users, nothing is rejected.
        3. `hot-account-limited`: 1 account, allowance 5000, most requests rejected.
        4. `hot-user-limited`: 1 account x 1 user, allowance 3000, most requests rejected.
    6. Correctness checks after every run (a run fails if any check fails):
        1. account counter = sum of user counters = sum of accepted units in the log;
        2. no account or user counter above its allowance;
        3. every user counter = accepted units of that user in the log;
        4. every successful response has one log row.

2. How to reproduce
    1. Requirements: Docker, Node 22, a free port 3000 and 5432.
    2. Start the stack on a clean database: `docker compose down -v` then `docker compose up -d --build postgres service`.
    3. `cd perf`, `npm install`.
    4. One configuration: set `LABEL` (for example `$env:LABEL="baseline-1"`), then `npm run load:consume` and `npm run load:contention`.
    5. Settings (environment variables): `CONNECTIONS` (50), `DURATION` (20), `WARMUP` (3), `NOTES`.
    6. `npm run summarize` writes `perf/results/summary.md`.

3. Environment of the committed results
    1. Machine: 13th Gen Intel Core i7-13700H, 20 logical CPUs, 16 GB RAM, Windows 10.0.26300 (from result files).
    2. Docker: Docker Desktop on Windows (exact version not recorded in the result files), PostgreSQL 16, service pool size 10 unless the label says otherwise.
    3. The load generator, Docker and the database run on the same machine.

4. Results (medians of three runs, labels baseline-1..3 and round-trips-1..3)
    1. `spread`: 353 req/s, p50 138 ms, p99 195 ms then 734 req/s, p50 66 ms, p99 91 ms.
    2. `hot-account`: 135 req/s, p50 370 ms, p99 415 ms then 226 req/s, p50 218 ms, p99 369 ms.
    3. `hot-account-limited`: median 909 accepted requests, counter saturates at the 5000-unit allowance (invariants: counter = accepted units and stays ≤ allowance), 151 req/s; invariants pass.
    4. `hot-user-limited`: median 531 accepted requests, counter saturates at the 3000-unit allowance (invariants: counter = accepted units and stays ≤ allowance), 152 req/s; invariants pass.
    5. Full table: `perf/results/summary.md`.

5. Bottleneck
    1. Every consume locks the account counter row until commit, so one account is served one request at a time.
    2. Its maximum throughput is about 1 / (time the row is locked). More connections only lengthen the queue (latency), not the throughput.
    3. Different accounts do not block each other, which is why `spread` is about 2.6 times faster than `hot-account` in our measurements.
    4. Evidence: baseline medians — `spread` 353 req/s (p50 138 ms, p99 195 ms) versus `hot-account` 135 req/s (p50 370 ms, p99 415 ms).

6. Pool size experiment (labels pool-5, pool-20, pool-40)
    1. `spread`: 323 → 335 → 344 req/s from pool 5 → 20 → 40 (baseline at pool 10 median 353). Throughput plateaued around the default of 10; pool 40 raised p99 to 380 ms versus 195 ms at baseline.
    2. `hot-account`: 126 / 136 / 131 req/s versus baseline 135 — no meaningful change (the account row lock dominates).
    3. Decision: keep `DB_POOL_MAX=10`; larger pools do not raise hot-account throughput and do not clearly improve spread beyond run-to-run noise.

7. Improvement: fewer round trips inside the consume transaction
    1. What changed: locking first and inserting counters only when missing, one query for both plans, one statement for both counter updates. Round trips per accepted request: 13 to 9. Round trips while the account row is locked: 9 to 7.
    2. What did not change: lock order (account row, then user row), decisions, API.
    3. Correctness: all 302 tests pass, invariants pass in every scenario, no deadlock in the PostgreSQL log.
    4. Effect: `spread` 353 to 734 req/s (~+108%), `hot-account` 135 to 226 req/s (~+67%). Both gains are outside run-to-run noise (spread baseline spanned about 327–366; the lowest round-trips hot-account run at 192 still beat the highest baseline at 142).
    5. Rejected ideas: merging the counter inserts or the row locks into one statement (loses the guaranteed lock order); `synchronous_commit = off` (risks losing committed usage records).

8. Limits of these tests
    1. Closed-loop load (fixed connections): latency percentiles look better than with independent clients.
    2. Single machine: absolute numbers depend on the hardware; comparisons between labels on the same machine are the reliable result.
    3. The data set is small and fresh: a database with millions of log rows would behave differently (index size, cache).
    4. Offset pagination and COUNT queries were not load tested.

9. What I would do next
    1. Shard the account counter to remove the hot row (with a reservation scheme per shard), accepting a less exact limit near the boundary.
    2. Cache the API key lookup for a short time (acceptable because keys cannot be revoked in this version).
    3. Keyset pagination for the history.
    4. Run the load generator from another machine, and test with a large database.