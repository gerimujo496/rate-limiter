import type { Response } from "express";
import type { RateLimitResult } from "../../types/bucket-algorithm.js";

export function setRateLimitHeaders(
  response: Response,
  result: RateLimitResult,
): void {
  response.setHeader("X-RateLimit-Limit", String(result.limit));
  response.setHeader("X-RateLimit-Remaining", String(result.remaining));

  if (!result.allowed && result.retryAfterSeconds > 0) {
    response.setHeader("Retry-After", String(result.retryAfterSeconds));
  }
}
