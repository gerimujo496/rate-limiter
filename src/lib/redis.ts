import process from "node:process";
import { Redis } from "@upstash/redis";
import "../load-env.js";
import { RequestsUsage } from "../types/bucket-algorithm.js";
import { RateLimitIpKeyPrefix } from "../helpers/rate-limiter/index.js";

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

export async function getRedisValue(
  key: string,
): Promise<RequestsUsage | null> {
  try {
    const value = await redis.get<RequestsUsage | null>(
      `${RateLimitIpKeyPrefix}${key}`,
    );
    return value;
  } catch (error) {
    console.error(`Error getting value from Redis for key "${key}":`, error);
    return null;
  }
}

export async function setRedisValue(
  key: string,
  value: RequestsUsage,
  expirationInSeconds: number,
): Promise<void> {
  try {
    await redis.set(key, value, { ex: expirationInSeconds });
  } catch (error) {
    console.error(`Error setting value in Redis for key "${key}":`, error);
  }
}
