# Distributed Rate Limiter

A TypeScript Express service that demonstrates **shared, consistent rate limiting across horizontally scaled API instances**. The core design problem: when each replica keeps its own in-memory counter, clients can multiply their effective quota and concurrent requests can race on read-modify-write. This project solves that with a **single source of truth in Redis**, updated **atomically via Lua**.

The rate limiter runs as **global middleware** on every registered route. Supporting workloads (URL shortener, users CRUD, async webhooks) exercise the same middleware under realistic API traffic.

---

## What problem this solves

| Problem | What goes wrong without a shared limiter | How this project addresses it |
| --- | --- | --- |
| **Multi-instance drift** | N replicas × local limit ≈ N× the intended quota | All instances read/write the same Redis key per client |
| **Race conditions** | Concurrent `GET` → decide → `SET` lets several requests pass before any write lands | Refill, consume, and persist run inside **one Redis Lua script** (`EVAL`) |
| **Burst vs sustained rate** | Fixed windows allow edge bursts; naive counters feel either too strict or too loose | **Token bucket**: allow short bursts up to capacity, then refill at a steady rate |
| **Inconsistent decisions** | Two servers can disagree on remaining quota | Redis is the authority; the app only interprets `allowed` / denied |
| **Limiter unavailable** | Failing open silently bypasses protection | **Fail-closed**: Redis errors return **503** with `Retry-After`, not allow |

This is a **reference implementation** of that pattern — not a production API gateway.

---

## Architecture

```mermaid
flowchart TD
    C[Clients] --> LB[Load balancer / many app instances]
    LB --> A1[Express instance A]
    LB --> A2[Express instance B]

    A1 --> MW[apiRateLimit middleware]
    A2 --> MW2[apiRateLimit middleware]

    MW --> EV[evaluateRequestRateLimit]
    MW2 --> EV2[evaluateRequestRateLimit]

    EV --> B[checkRequestRateLimitBucketAlgorithm]
    EV2 --> B2[checkRequestRateLimitBucketAlgorithm]

    B --> R[(Upstash Redis)]
    B2 --> R

    R --> L[Lua token-bucket script]
    L --> R

    A1 --> PG[(PostgreSQL)]
    A2 --> PG

    A1 --> Q[BullMQ webhook worker]
    Q --> R2[(Redis TCP / Upstash)]
```

### Layer responsibilities

| Layer | Location | Role |
| --- | --- | --- |
| Boot | `src/index.ts`, `src/config.ts` | Load env, start Express, start webhook worker |
| HTTP | `src/express-server.ts`, `src/routes/` | Mount health, rate-limiter demo, URLs, users, webhooks |
| Middleware | `src/middleware/rate-limiter/` | Resolve route policy, run limit check, set headers, map errors to HTTP |
| Domain helpers | `src/helpers/rate-limiter/` | Build Redis key, call Lua script, interpret allow/deny |
| Config | `src/conf/rate-limiting/` | Per-route / per-method token-bucket policies |
| Infrastructure | `src/lib/redis.ts`, `src/lib/scripts/` | Upstash REST client + Lua script |
| Persistence | `src/lib/db.ts`, `docker/postgres/` | Postgres for URLs, users, webhooks |
| Async delivery | `src/lib/bullmq.ts`, `src/workers/` | BullMQ worker delivers webhook payloads with retries |

### Request path (allowed / denied / unavailable)

```mermaid
sequenceDiagram
    participant Client
    participant Express
    participant Middleware
    participant Helper
    participant Redis

    Client->>Express: HTTP request
    Express->>Middleware: apiRateLimit
    Middleware->>Middleware: resolveRateLimitRoute(path)
    Middleware->>Helper: evaluateRequestRateLimit
    Helper->>Helper: extract IP + method, load policy
    Helper->>Redis: EVAL token-bucket Lua
    Redis-->>Helper: [allowed, remaining, retryAfter]
    Helper-->>Middleware: RateLimitResult
    Middleware->>Middleware: set X-RateLimit-* headers
    alt allowed
        Middleware->>Express: next()
        Express-->>Client: handler response
    else rate limit exceeded
        Middleware-->>Client: 429 + Retry-After
    else Redis unavailable
        Middleware-->>Client: 503 + Retry-After
    end
```

1. `apiRateLimit` runs before every handler on registered routes.
2. `resolveRateLimitRoute` maps the path to a policy (longest-prefix match for nested routes).
3. `evaluateRequestRateLimit` builds the Redis key and calls the Lua script.
4. Middleware sets standard rate-limit headers and either calls `next()`, returns **429**, or returns **503** on Redis failure.

---

## How the token bucket works

Each client (keyed by **IP + route + HTTP method**) owns a bucket:

- **Capacity** (`maxRequests`) — maximum tokens held at once (burst size).
- **Refill period** (`timeWindowSeconds`) — time to regenerate a full bucket.
- **Cost** — each allowed request consumes **1** token.

Default config: **10 requests / 60 seconds** → one token restored every 6 seconds.

### Atomic execution

The Node process does **not** load the bucket, change it, and write it back in separate Redis commands. That would race under concurrency.

`executeRateLimitScript` runs a Lua script via Upstash `EVAL` that, in one atomic step:

1. Loads the bucket JSON (or creates a full bucket).
2. Refills whole tokens based on elapsed time since `lastRefillTimestamp`.
3. Consumes a token if enough remain, otherwise denies.
4. Persists `{ tokenCount, lastRefillTimestamp }` with a sliding idle TTL.
5. Returns `[allowed, remainingTokens, retryAfterSeconds]`.

Redis runs each script atomically, so concurrent requests from many app instances cannot interleave mid-update.

### Redis key format

```text
rate-limit-ip:{route}:{method}:{ip}
```

Example: `rate-limit-ip::/token-bucket:GET:127.0.0.1`

Policies live in `src/conf/rate-limiting/bucket-algorithm.ts`.

---

## API surface

All routes below pass through the rate limiter middleware.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Liveness / process metadata |
| `GET` | `/rate-limiter/token-bucket` | Demo endpoint for the token-bucket limiter |
| `POST` | `/urls` | Create a short URL |
| `GET` | `/shorturl/:shortUrl` | Redirect to the long URL |
| `GET` | `/users` | List users |
| `GET` | `/users/:id` | Get user by id |
| `POST` | `/users` | Create user (triggers webhooks) |
| `PUT` | `/users/:id` | Update user |
| `DELETE` | `/users/:id` | Delete user |
| `POST` | `/webhooks` | Register a webhook callback URL |
| `POST` | `/webhooks/handlers/ok` | Demo handler — returns 200 |
| `POST` | `/webhooks/handlers/fail` | Demo handler — returns 500 (for retry testing) |

### Rate limit responses

**Allowed** — handler runs; headers include:

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
```

**Denied (429):**

```json
{ "error": "Rate limit exceeded." }
```

**Redis unavailable (503):**

```json
{ "error": "Rate limiter unavailable. Request rejected." }
```

With `Retry-After: 5`

---

## Project layout

```text
src/
  conf/                    # Routes and rate-limit policies
  routes/                  # Express routers
  middleware/rate-limiter/ # Global rate-limit gate + headers
  helpers/
    rate-limiter/          # Algorithm orchestration, route resolution
    urls.ts / users.ts / webhooks.ts
  services/                # URL shortener, webhook trigger
  workers/                 # BullMQ webhook delivery worker
  lib/
    redis.ts               # Upstash REST client + Lua EVAL
    db.ts                  # Postgres pool
    bullmq.ts              # Job queue
    scripts/               # Lua token-bucket script
  utils/                   # Request extraction, validation, errors
  types/                   # Shared TypeScript types
tests/
  unit/                    # Middleware, headers, config (mocked Redis)
  integration/             # Lua correctness, concurrency, HTTP flow
docker/
  postgres/                # Schema init scripts
.github/workflows/         # CI (typecheck, build, tests)
```

---

## Prerequisites

- Node.js **22+**
- npm
- [Upstash Redis](https://upstash.com/) (REST URL + token) for running the app
- Docker (optional) — local Postgres and Redis for development/testing

---

## Environment

Copy `.env.example` to `.env` and fill in your values:

```env
PORT=3000
BASE_URL=http://localhost:3000
NODE_ENV=development

# Required to run the app
UPSTASH_REDIS_REST_URL=https://....upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# Required for URL shortener, users, webhooks
DATABASE_URL=postgresql://postgres:postgres@localhost:15432/url_shortener

# Local Redis for integration tests
TEST_REDIS_URL=redis://127.0.0.1:6379
```

| Variable | Required | Description |
| --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | Yes (app) | Upstash Redis REST URL for rate limiting + cache |
| `UPSTASH_REDIS_REST_TOKEN` | Yes (app) | Upstash REST token |
| `DATABASE_URL` | Yes (app) | Postgres connection string |
| `BASE_URL` | Yes (app) | Public base URL for generated short links |
| `PORT` | No | Listen port (default `3000`) |
| `TEST_REDIS_URL` | Tests only | Local Redis for integration tests |
| `UPSTASH_REDIS_URL` | No | BullMQ TCP Redis URL (optional; derived from Upstash REST if unset) |

Missing Upstash credentials prevent the server from starting. A `.env` file is optional — env vars can also be set directly (e.g. in CI).

---

## Run locally

### Start dependencies

```bash
docker compose up -d
```

This starts **Redis** (port `6379`) and **Postgres** (port `15432`).

### Start the app

```bash
npm install
npm run dev
```

### Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Dev server with reload (`tsx watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run typecheck` | Typecheck without emit |
| `npm run start` | Run with `tsx` |
| `npm test` | Run all tests (unit + integration) |
| `npm run test:unit` | Unit tests only (no Redis required) |
| `npm run test:integration` | Integration tests (requires local Redis) |

### Quick check

```bash
curl http://localhost:3000/health
curl http://localhost:3000/rate-limiter/token-bucket
```

Repeat the second call more than 10 times quickly to observe **429** responses.

---

## Testing

The test suite validates the distributed-systems claims:

| Layer | What it proves |
| --- | --- |
| **Unit** | Fail-closed → 503, deny → 429, route resolution, headers, config coverage |
| **Integration (Lua)** | Refill math, deny at empty bucket, corrupt JSON reset, key TTL |
| **Integration (concurrency)** | 20 parallel requests → at most 10 allowed on one key |
| **Integration (HTTP)** | Middleware returns 200 + headers, then 429 after exhaustion |

```bash
docker compose up -d redis
npm test
```

CI runs on every push and pull request via GitHub Actions (typecheck, build, full test suite with a Redis service container).

---

## Design notes

- **Shared state in Redis** makes the limit correct across horizontally scaled instances.
- **Lua atomicity** makes the limit correct under concurrent requests.
- **Token bucket** allows bursts up to capacity, then a predictable refill rate.
- Limits are **per IP** (plus route and method). Extending to API keys or user IDs means changing how the Redis key is built.
- Bucket keys use a **sliding idle TTL** equal to the refill window. After idle expiry, the next request recreates a full bucket.
- **Fail-closed** on Redis outages: the API returns **503** instead of allowing traffic through.
- **Webhooks** use BullMQ with retries/backoff; demo handlers (`ok` / `fail`) make delivery behavior observable.
- Integration tests caught real Lua edge cases (e.g. treating `0` tokens as a missing value incorrectly reset the bucket to full).

---

## Tech stack

Express 5 · TypeScript · Upstash Redis · Lua · PostgreSQL · BullMQ · Zod · Vitest
