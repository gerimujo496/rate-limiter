import request from "supertest";
import {
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { Route } from "../../src/conf/routes.js";
import { createRateLimitTestApp } from "../helpers/test-app.js";
import {
  createTestRedisClient,
  executeRateLimitScriptForTests,
  isTestRedisAvailable,
} from "../helpers/token-bucket-eval.js";

vi.mock("../../src/lib/redis.js", async () => {
  const bridge = await import("../helpers/token-bucket-eval.js");

  return {
    executeRateLimitScript: bridge.executeRateLimitScriptForTests,
    redis: {},
    getRedisValue: vi.fn(),
    setRedisValue: vi.fn(),
    tryAcquireLock: vi.fn(),
    releaseLock: vi.fn(),
  };
});

describe.runIf(await isTestRedisAvailable())("rate limit HTTP flow", () => {
  let redisAvailable = false;

  beforeAll(async () => {
    redisAvailable = await isTestRedisAvailable();
    if (!redisAvailable) {
      return;
    }

    const redis = createTestRedisClient();
    await redis.connect();
    await redis.flushdb();
    redis.disconnect();
  });

  afterEach(async () => {
    if (!redisAvailable) {
      return;
    }

    const redis = createTestRedisClient();
    await redis.connect();
    await redis.flushdb();
    redis.disconnect();
  });

  it("returns 200 with rate-limit headers under the configured limit", async () => {
    const response = await request(createRateLimitTestApp()).get(
      `${Route.RateLimiter}${Route.TokenBucket}`,
    );

    expect(response.status).toBe(200);
    expect(response.headers["x-ratelimit-limit"]).toBe("10");
    expect(response.headers["x-ratelimit-remaining"]).toBe("9");
  });

  it("returns 429 after the bucket is exhausted", async () => {
    const app = createRateLimitTestApp();
    const path = `${Route.RateLimiter}${Route.TokenBucket}`;

    for (let index = 0; index < 10; index += 1) {
      const allowed = await request(app).get(path);
      expect(allowed.status).toBe(200);
    }

    const denied = await request(app).get(path);

    expect(denied.status).toBe(429);
    expect(denied.headers["x-ratelimit-remaining"]).toBe("0");
    expect(Number(denied.headers["retry-after"])).toBeGreaterThanOrEqual(1);
  });

  it("keys separate quotas on X-Forwarded-For client IPs behind trust proxy", async () => {
    const app = createRateLimitTestApp();
    const path = `${Route.RateLimiter}${Route.TokenBucket}`;

    for (let index = 0; index < 10; index += 1) {
      const allowed = await request(app)
        .get(path)
        .set("X-Forwarded-For", "203.0.113.10");
      expect(allowed.status).toBe(200);
    }

    const deniedForFirstClient = await request(app)
      .get(path)
      .set("X-Forwarded-For", "203.0.113.10");
    expect(deniedForFirstClient.status).toBe(429);

    const allowedForSecondClient = await request(app)
      .get(path)
      .set("X-Forwarded-For", "203.0.113.20");
    expect(allowedForSecondClient.status).toBe(200);
    expect(allowedForSecondClient.headers["x-ratelimit-remaining"]).toBe("9");
  });
});
