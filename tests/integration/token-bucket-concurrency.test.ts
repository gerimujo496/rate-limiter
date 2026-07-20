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
const BASE_TIME_SECONDS = 1_700_000_100;

describe.runIf(await isTestRedisAvailable())(
  "token bucket concurrency",
  () => {
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

    it("allows at most capacity requests under concurrent load", async () => {
      const key = "test:bucket:concurrent";

      const results = await Promise.all(
        Array.from({ length: 20 }, () =>
          evalTokenBucketScript(
            redis,
            key,
            CAPACITY,
            REFILL_PERIOD_SECONDS,
            BASE_TIME_SECONDS,
          ),
        ),
      );

      const allowedCount = results.filter((result) => result.allowed).length;

      expect(allowedCount).toBe(CAPACITY);
    });

    it("allows additional requests after refill time advances concurrently", async () => {
      const key = "test:bucket:concurrent-refill";

      const initialResults = await Promise.all(
        Array.from({ length: CAPACITY }, () =>
          evalTokenBucketScript(
            redis,
            key,
            CAPACITY,
            REFILL_PERIOD_SECONDS,
            BASE_TIME_SECONDS,
          ),
        ),
      );
      expect(initialResults.every((result) => result.allowed)).toBe(true);

      const afterRefillResults = await Promise.all(
        Array.from({ length: 5 }, () =>
          evalTokenBucketScript(
            redis,
            key,
            CAPACITY,
            REFILL_PERIOD_SECONDS,
            BASE_TIME_SECONDS + 6,
          ),
        ),
      );

      const allowedAfterRefill = afterRefillResults.filter(
        (result) => result.allowed,
      ).length;

      expect(allowedAfterRefill).toBe(1);
    });
  },
);
