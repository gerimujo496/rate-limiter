import { executeRateLimitScript } from "../../lib/redis.js";
import { ExtractedRequestDetails } from "../../utils/extractRequestDetails.js";
import { Route } from "../../conf/routes.js";
import {
  RateLimitConfigError,
  validateRequestDetailsOrThrowError,
} from "../../utils/error.js";
import { RateLimitConfig } from "../../types/bucket-algorithm.js";
import { RateLimitIpKeyPrefix } from "./index.js";

export async function checkRequestRateLimitBucketAlgorithm(
  requestDetails: ExtractedRequestDetails,
  route: Route,
  config: RateLimitConfig,
): Promise<boolean> {
  validateRequestDetailsOrThrowError(requestDetails);

  const { ip, httpMethod } = requestDetails;

  const policy = config.get(route)?.get(httpMethod);

  if (policy === undefined) {
    throw new RateLimitConfigError(route, httpMethod);
  }

  const { maxRequests, timeWindowSeconds } = policy.rateLimit;

  const redisKey = [RateLimitIpKeyPrefix, route, httpMethod, ip].join(":");

  const allowed = await executeRateLimitScript(
    redisKey,
    maxRequests,
    timeWindowSeconds,
  );

  return !allowed;
}
