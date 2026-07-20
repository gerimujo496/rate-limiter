import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "../../src/conf/routes.js";
import { rateLimitConfig } from "../../src/conf/rate-limiting/bucket-algorithm.js";
import { checkRequestRateLimitBucketAlgorithm } from "../../src/helpers/rate-limiter/bucket-algorithm.js";
import { apiRateLimit } from "../../src/middleware/rate-limiter/bucket-algorithm.js";
import { RateLimitUnavailableError } from "../../src/utils/error.js";

vi.mock("../../src/lib/redis.js", () => ({
  executeRateLimitScript: vi.fn(),
  redis: {},
  getRedisValue: vi.fn(),
  setRedisValue: vi.fn(),
  tryAcquireLock: vi.fn(),
  releaseLock: vi.fn(),
}));

function createMinimalRateLimitApp() {
  const app = express();

  app.use(apiRateLimit);
  app.get(`${Route.RateLimiter}${Route.TokenBucket}`, (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  return app;
}

describe("apiRateLimit fail-closed middleware", () => {
  beforeEach(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { executeRateLimitScript } = await import("../../src/lib/redis.js");
    vi.mocked(executeRateLimitScript).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 503 with Retry-After when Redis is unavailable", async () => {
    const { executeRateLimitScript } = await import("../../src/lib/redis.js");
    vi.mocked(executeRateLimitScript).mockRejectedValue(
      new Error("redis unavailable"),
    );

    const response = await request(createMinimalRateLimitApp()).get(
      `${Route.RateLimiter}${Route.TokenBucket}`,
    );

    expect(response.status).toBe(503);
    expect(response.body.error).toMatch(/unavailable/i);
    expect(response.headers["retry-after"]).toBe("5");
  });

  it("returns 429 when the limiter denies the request", async () => {
    const { executeRateLimitScript } = await import("../../src/lib/redis.js");
    vi.mocked(executeRateLimitScript).mockResolvedValue({
      allowed: false,
      limit: 10,
      remaining: 0,
      retryAfterSeconds: 6,
    });

    const response = await request(createMinimalRateLimitApp()).get(
      `${Route.RateLimiter}${Route.TokenBucket}`,
    );

    expect(response.status).toBe(429);
    expect(response.headers["x-ratelimit-limit"]).toBe("10");
    expect(response.headers["x-ratelimit-remaining"]).toBe("0");
    expect(response.headers["retry-after"]).toBe("6");
  });
});

describe("checkRequestRateLimitBucketAlgorithm fail-closed", () => {
  beforeEach(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { executeRateLimitScript } = await import("../../src/lib/redis.js");
    vi.mocked(executeRateLimitScript).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects with RateLimitUnavailableError when Redis cannot answer", async () => {
    const { executeRateLimitScript } = await import("../../src/lib/redis.js");
    vi.mocked(executeRateLimitScript).mockRejectedValueOnce(
      new Error("redis unavailable"),
    );

    await expect(
      checkRequestRateLimitBucketAlgorithm(
        { ip: "127.0.0.1", httpMethod: "GET" },
        Route.TokenBucket,
        rateLimitConfig,
      ),
    ).rejects.toBeInstanceOf(RateLimitUnavailableError);
  });
});
