# Distributed Rate Limiter

A TypeScript Express service that demonstrates **shared, consistent rate limiting across horizontally scaled API instances**. The core design problem: when each replica keeps its own in-memory counter, clients can multiply their effective quota and concurrent requests can race on read-modify-write. This project solves that with a **single source of truth in Redis**, updated **atomically via Lua**.

The limiter runs as **global middleware** on registered routes. The primary demo surface is `GET /rate-limiter/token-bucket`.

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
```

### Layer responsibilities

| Layer | Location | Role |
| --- | --- | --- |
| Boot | `src/index.ts`, `src/config.ts` | Load env, start Express |
| HTTP | `src/express-server.ts`, `src/routes/` | Mount handlers behind the middleware |
| Middleware | `src/middleware/rate-limiter/` | Resolve route policy, run limit check, set headers, map errors to HTTP |
| Domain helpers | `src/helpers/rate-limiter/` | Build Redis key, call Lua script, interpret allow/deny |
| Config | `src/conf/rate-limiting/` | Per-route / per-method token-bucket policies |
| Infrastructure | `src/lib/redis.ts`, `src/lib/scripts/` | Upstash REST client + Lua script |

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
2. `resolveRateLimitRoute` maps the path to a policy (longest-prefix match for nested paths).
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

## API (rate limiter demo)

These are the endpoints this README documents. All pass through `apiRateLimit`.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Liveness / process metadata |
| `GET` | `/rate-limiter/token-bucket` | Demo endpoint for the token-bucket limiter |

### Rate limit responses

**Allowed (200)** — headers include:

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

### Demo response (200)

```json
{
  "ip": "127.0.0.1",
  "service": "rate-limiter",
  "framework": "express",
  "algorithm": "token-bucket",
  "route": "/rate-limiter/token-bucket",
  "message": "Request allowed by token-bucket rate limiter.",
  "status": "ok"
}
```

Repeat the token-bucket request more than 10 times quickly to observe **429** responses.

---

## Project layout

```text
src/
  conf/
    rate-limiting/         # Per-route token-bucket policies
    routes.ts              # Route enum
  middleware/rate-limiter/ # Global gate + rate-limit headers
  helpers/rate-limiter/    # Key building, route resolution, Lua orchestration
  lib/
    redis.ts               # Upstash REST client + EVAL wrapper
    scripts/               # Lua token-bucket script
  routes/                  # Express routers (demo + other routes in repo)
  utils/                   # Request extraction and errors
  types/                   # Shared TypeScript types
tests/
  unit/                    # Middleware, headers, config (mocked Redis)
  integration/             # Lua correctness, concurrency, HTTP flow
.github/workflows/         # CI (typecheck, build, tests)
```

---

## Prerequisites

- Node.js **22+**
- npm
- [Upstash Redis](https://upstash.com/) (REST URL + token)
- Docker (optional) — local Redis for integration tests

---

## Environment

Copy `.env.example` to `.env` and fill in your values:

```env
PORT=3000
NODE_ENV=development

# Required to run the rate limiter
UPSTASH_REDIS_REST_URL=https://....upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# Required for integration tests only
TEST_REDIS_URL=redis://127.0.0.1:6379
```

| Variable | Required | Description |
| --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash REST token |
| `PORT` | No | Listen port (default `3000`) |
| `TRUST_PROXY` | No | Proxy hops to trust for client IP (default `1`; `false` disables) |
| `TEST_REDIS_URL` | Tests only | Local Redis for integration tests |

Missing Upstash credentials prevent the server from starting. A `.env` file is optional — env vars can also be set directly (e.g. in CI).

---

## Run locally

### Start Redis for tests (optional)

```bash
docker compose up -d redis
```

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
- **Redis TIME** drives refill timestamps so app-instance clock skew cannot desync buckets.
- **`trust proxy`** + `request.ip` key rate limits on the real client IP behind a load balancer (`TRUST_PROXY`, default `1` hop).
- **Token bucket** allows bursts up to capacity, then a predictable refill rate.
- Limits are **per IP** (plus route and method). Extending to API keys or user IDs means changing how the Redis key is built.
- Bucket keys use a **sliding idle TTL** equal to the refill window. After idle expiry, the next request recreates a full bucket.
- **Fail-closed** on Redis outages: the API returns **503** instead of allowing traffic through.
- **`/health` and `/metrics` are exempt** from rate limiting so probes and scrapers cannot starve themselves.
- Integration tests caught real Lua edge cases (e.g. treating `0` tokens as a missing value incorrectly reset the bucket to full).

---

## Tech stack

Express 5 · TypeScript · Upstash Redis · Lua · Vitest
