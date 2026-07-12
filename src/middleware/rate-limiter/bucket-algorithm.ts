// src/middleware/request-logger.ts
import type { NextFunction, Request, Response } from "express";
import {
  hasExceededRequestRateLimit,
  RateLimitAlgorithm,
} from "../../helpers/rate-limiter/index.js";
import { rateLimitConfig } from "../../conf/rate-limiting/bucket-algorithm.js";
import { Route } from "../../conf/routes.js";
import {
  errorHandler,
  RateLimitConfigError,
  RateLimitExceededError,
} from "../../utils/error.js";

export async function apiRateLimit(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    const hasExceeded = await hasExceededRequestRateLimit(
      RateLimitAlgorithm.TokenBucket,
      request,
      Route.TokenBucket,
      rateLimitConfig,
    );

    if (hasExceeded) throw new RateLimitExceededError("Rate limit exceeded.");

    next();
  } catch (error) {
    const { status, message } = errorHandler(error);

    response.status(status).json({ error: message });
  }
}
