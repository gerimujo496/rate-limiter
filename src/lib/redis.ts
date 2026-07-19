import { randomUUID } from "node:crypto";
import process from "node:process";
import { Redis } from "@upstash/redis";
import "../load-env.js";
import { RateLimitResult } from "../types/bucket-algorithm.js";
import { rateLimitKeyTtlSeconds } from "../helpers/rate-limiter/key-ttl.js";
import { tokenBucketLuaScript } from "./scripts/check-rate-limit.lua.js";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  throw new Error(
    "Missing Upstash Redis env vars. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
  );
}

export const redis = new Redis({
  url,
  token,
});

const releaseLockLuaScript = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

export async function getRedisValue<T>(key: string): Promise<T | null> {
  try {
    return await redis.get<T | null>(key);
  } catch (error) {
    console.error(`Error getting value from Redis for key "${key}":`, error);
    return null;
  }
}

export async function setRedisValue<T>(
  key: string,
  value: T,
  expirationInSeconds: number,
): Promise<void> {
  try {
    await redis.set(key, value, { ex: expirationInSeconds });
  } catch (error) {
    console.error(`Error setting value in Redis for key "${key}":`, error);
  }
}

/** Returns a lock token on success, otherwise null. */
export async function tryAcquireLock(
  key: string,
  ttlSeconds: number,
): Promise<string | null> {
  const lockToken = randomUUID();
  const result = await redis.set(key, lockToken, {
    nx: true,
    ex: ttlSeconds,
  });

  return result === "OK" ? lockToken : null;
}

export async function releaseLock(
  key: string,
  lockToken: string,
): Promise<void> {
  try {
    await redis.eval(releaseLockLuaScript, [key], [lockToken]);
  } catch (error) {
    console.error(`Error releasing lock for key "${key}":`, error);
  }
}

type TokenBucketLuaResult = [
  allowed: 0 | 1,
  remainingTokens: number,
  retryAfterSeconds: number,
];

export async function executeRateLimitScript(
  key: string,
  maxRequests: number,
  refillPeriodSeconds: number,
): Promise<RateLimitResult> {
  const keyTtlSeconds = rateLimitKeyTtlSeconds(refillPeriodSeconds);

  const result = await redis.eval<
    [string, string, string, string, string],
    TokenBucketLuaResult
  >(tokenBucketLuaScript, [key], [
    maxRequests.toString(),
    refillPeriodSeconds.toString(),
    Math.floor(Date.now() / 1000).toString(),
    "1",
    keyTtlSeconds.toString(),
  ]);

  const [allowed, remainingTokens, retryAfterSeconds] = result;

  return {
    allowed: Number(allowed) === 1,
    limit: maxRequests,
    remaining: Math.max(0, Math.floor(Number(remainingTokens))),
    retryAfterSeconds: Math.max(0, Math.floor(Number(retryAfterSeconds))),
  };
}
