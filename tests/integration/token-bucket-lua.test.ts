import type Redis from "ioredis";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import {
  createTestRedisClient,
  evalTokenBucketScript,
  isTestRedisAvailable,
} from "../helpers/token-bucket-eval.js";

const CAPACITY = 10;
const REFILL_PERIOD_SECONDS = 60;
const BASE_TIME_SECONDS = 1_700_000_000;

describe.runIf(await isTestRedisAvailable())("token bucket Lua script", () => {
  let redis: Redis;

  beforeAll(async () => {
    redis = createTestRedisClient();
    await redis.connect();
  });

  afterEach(async () => {
    await redis.flushdb();
  });

  afterAll(() => {
    redis.disconnect();
  });

  it("starts a new bucket full and consumes one token per allowed request", async () => {
    const key = "test:bucket:new";

    const first = await evalTokenBucketScript(
      redis,
      key,
      CAPACITY,
      REFILL_PERIOD_SECONDS,
      BASE_TIME_SECONDS,
    );

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(CAPACITY - 1);
  });

  it("denies requests once the bucket is empty", async () => {
    const key = "test:bucket:deny";

    for (let index = 0; index < CAPACITY; index += 1) {
      const result = await evalTokenBucketScript(
        redis,
        key,
        CAPACITY,
        REFILL_PERIOD_SECONDS,
        BASE_TIME_SECONDS,
      );
      expect(result.allowed).toBe(true);
    }

    const denied = await evalTokenBucketScript(
      redis,
      key,
      CAPACITY,
      REFILL_PERIOD_SECONDS,
      BASE_TIME_SECONDS,
    );

    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("refills whole tokens based on elapsed time", async () => {
    const key = "test:bucket:refill";

    for (let index = 0; index < CAPACITY; index += 1) {
      await evalTokenBucketScript(
        redis,
        key,
        CAPACITY,
        REFILL_PERIOD_SECONDS,
        BASE_TIME_SECONDS,
      );
    }

    const denied = await evalTokenBucketScript(
      redis,
      key,
      CAPACITY,
      REFILL_PERIOD_SECONDS,
      BASE_TIME_SECONDS,
    );
    expect(denied.allowed).toBe(false);

    const refilled = await evalTokenBucketScript(
      redis,
      key,
      CAPACITY,
      REFILL_PERIOD_SECONDS,
      BASE_TIME_SECONDS + 6,
    );

    expect(refilled.allowed).toBe(true);
    expect(refilled.remaining).toBe(0);
  });

  it("resets corrupt bucket values to a full bucket", async () => {
    const key = "test:bucket:corrupt";
    await redis.set(key, "not-json");

    const result = await evalTokenBucketScript(
      redis,
      key,
      CAPACITY,
      REFILL_PERIOD_SECONDS,
      BASE_TIME_SECONDS,
    );

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(CAPACITY - 1);
  });

  it("keeps separate quotas for separate client keys", async () => {
    const keyA = "test:bucket:client-a";
    const keyB = "test:bucket:client-b";

    for (let index = 0; index < CAPACITY; index += 1) {
      await evalTokenBucketScript(
        redis,
        keyA,
        CAPACITY,
        REFILL_PERIOD_SECONDS,
        BASE_TIME_SECONDS,
      );
    }

    const deniedForA = await evalTokenBucketScript(
      redis,
      keyA,
      CAPACITY,
      REFILL_PERIOD_SECONDS,
      BASE_TIME_SECONDS,
    );
    const allowedForB = await evalTokenBucketScript(
      redis,
      keyB,
      CAPACITY,
      REFILL_PERIOD_SECONDS,
      BASE_TIME_SECONDS,
    );

    expect(deniedForA.allowed).toBe(false);
    expect(allowedForB.allowed).toBe(true);
  });

  it("refreshes key expiry on each update", async () => {
    const key = "test:bucket:ttl";

    await evalTokenBucketScript(
      redis,
      key,
      CAPACITY,
      REFILL_PERIOD_SECONDS,
      BASE_TIME_SECONDS,
    );

    const ttl = await redis.ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(REFILL_PERIOD_SECONDS);
  });
});
