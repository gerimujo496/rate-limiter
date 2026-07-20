import Redis from "ioredis";
import { rateLimitKeyTtlSeconds } from "../../src/helpers/rate-limiter/key-ttl.js";
import { tokenBucketLuaScript } from "../../src/lib/scripts/check-rate-limit.lua.js";
import type { RateLimitResult } from "../../src/types/bucket-algorithm.js";

export const TEST_REDIS_URL =
  process.env.TEST_REDIS_URL ?? "redis://127.0.0.1:6379";

export function createTestRedisClient(): Redis {
  return new Redis(TEST_REDIS_URL, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2_000,
    lazyConnect: true,
  });
}

export async function isTestRedisAvailable(): Promise<boolean> {
  const client = createTestRedisClient();

  try {
    await client.connect();
    await client.ping();
    return true;
  } catch {
    return false;
  } finally {
    client.disconnect();
  }
}

type TokenBucketLuaResult = [allowed: number, remainingTokens: number, retryAfterSeconds: number];

export async function evalTokenBucketScript(
  redis: Redis,
  key: string,
  maxRequests: number,
  refillPeriodSeconds: number,
  currentTimeSeconds: number,
  requestedTokens = 1,
): Promise<Pick<RateLimitResult, "allowed" | "remaining" | "retryAfterSeconds">> {
  const keyTtlSeconds = rateLimitKeyTtlSeconds(refillPeriodSeconds);

  const result = (await redis.eval(
    tokenBucketLuaScript,
    1,
    key,
    maxRequests.toString(),
    refillPeriodSeconds.toString(),
    currentTimeSeconds.toString(),
    requestedTokens.toString(),
    keyTtlSeconds.toString(),
  )) as TokenBucketLuaResult;

  const [allowed, remainingTokens, retryAfterSeconds] = result;

  return {
    allowed: Number(allowed) === 1,
    remaining: Math.max(0, Math.floor(Number(remainingTokens))),
    retryAfterSeconds: Math.max(0, Math.floor(Number(retryAfterSeconds))),
  };
}

export async function executeRateLimitScriptForTests(
  key: string,
  maxRequests: number,
  refillPeriodSeconds: number,
): Promise<RateLimitResult> {
  const redis = createTestRedisClient();
  await redis.connect();

  try {
    const result = await evalTokenBucketScript(
      redis,
      key,
      maxRequests,
      refillPeriodSeconds,
      Math.floor(Date.now() / 1000),
    );

    return {
      allowed: result.allowed,
      limit: maxRequests,
      remaining: result.remaining,
      retryAfterSeconds: result.retryAfterSeconds,
    };
  } finally {
    redis.disconnect();
  }
}
