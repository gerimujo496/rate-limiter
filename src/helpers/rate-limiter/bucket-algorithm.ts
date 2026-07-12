import type { Request } from "express";
import type {
  RateLimitConfig,
  RequestsUsage,
} from "../../conf/rate-limiting/bucket-algorithm.js";
import { getRedisValue, setRedisValue } from "../../lib/redis.js";
import {
  ExtractedRequestDetails,
  isHttpMethod,
} from "../../utils/extractRequestDetails.js";
import { RateLimitIpKeyPrefix } from "./index.js";
import { Route } from "../../conf/routes.js";
import {
  BadRequestError,
  MethodNotAllowedError,
  RateLimitConfigError,
  validateRequestDetailsOrThrowError,
} from "../../utils/error.js";

export async function checkRequestRateLimitBucketAlgorithm(
  requestDetails: ExtractedRequestDetails,
  route: Route,
  _config: RateLimitConfig,
): Promise<boolean> {
  const requestUsage = await getRedisValue(requestDetails.ip);

  if (!requestUsage) {
    return await refillBucket(requestDetails, _config, route);
  }

  return await checkIfRateLimitExceeded(
    requestDetails,
    _config,
    route,
    requestUsage,
  );
}

const refillBucket = async (
  request: ExtractedRequestDetails,
  config: RateLimitConfig,
  route: Route,
) => {
  const ip = request.ip;
  const httpMethod = request.httpMethod;

  const rateLimit = config.get(route)?.get(httpMethod);
  if (rateLimit === undefined) {
    throw new RateLimitConfigError(route, httpMethod);
  }

  await setRedisValue(
    `${RateLimitIpKeyPrefix}${ip}`,
    {
      tokenCount: rateLimit.rateLimit.maxRequests - 1,
      lastRequestTimestamp: new Date(),
    },
    rateLimit.rateLimit.timeWindowSeconds,
  );

  return false;
};

const checkIfRateLimitExceeded = async (
  request: ExtractedRequestDetails,
  config: RateLimitConfig,
  route: Route,
  usage: RequestsUsage,
) => {
  const ip = request.ip;
  const httpMethod = request.httpMethod;

  validateRequestDetailsOrThrowError(request);

  const rateLimit = config.get(route)?.get(httpMethod);
  if (rateLimit === undefined) {
    throw new RateLimitConfigError(route, httpMethod);
  }

  if (usage.tokenCount <= 0) return true;

  await setRedisValue(
    `${RateLimitIpKeyPrefix}${ip}`,
    {
      tokenCount: usage.tokenCount - 1,
      lastRequestTimestamp: usage.lastRequestTimestamp,
    },
    rateLimit.rateLimit.timeWindowSeconds,
  );

  return false;
};
