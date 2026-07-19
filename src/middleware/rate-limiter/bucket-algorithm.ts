import type { NextFunction, Request, Response } from "express";
import {
  evaluateRequestRateLimit,
  RateLimitAlgorithm,
} from "../../helpers/rate-limiter/index.js";
import { resolveRateLimitRoute } from "../../helpers/rate-limiter/resolve-route.js";
import { rateLimitConfig } from "../../conf/rate-limiting/bucket-algorithm.js";
import {
  errorHandler,
  RateLimitExceededError,
  RateLimitUnavailableError,
} from "../../utils/error.js";
import { setRateLimitHeaders } from "./headers.js";

const REDIS_OUTAGE_RETRY_AFTER_SECONDS = 5;

export async function apiRateLimit(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    const route = resolveRateLimitRoute(request.path);

    if (route === null) {
      next();
      return;
    }

    const result = await evaluateRequestRateLimit(
      RateLimitAlgorithm.TokenBucket,
      request,
      route,
      rateLimitConfig,
    );

    setRateLimitHeaders(response, result);

    if (!result.allowed) {
      throw new RateLimitExceededError("Rate limit exceeded.");
    }

    next();
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      response.setHeader(
        "Retry-After",
        String(REDIS_OUTAGE_RETRY_AFTER_SECONDS),
      );
    }

    const { status, message } = errorHandler(error);

    response.status(status).json({ error: message });
  }
}
