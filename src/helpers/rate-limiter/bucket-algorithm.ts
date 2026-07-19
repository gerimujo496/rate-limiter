import { executeRateLimitScript } from "../../lib/redis.js";
import { ExtractedRequestDetails } from "../../utils/extractRequestDetails.js";
import { Route } from "../../conf/routes.js";
import {
  RateLimitConfigError,
  RateLimitUnavailableError,
  validateRequestDetailsOrThrowError,
} from "../../utils/error.js";
import {
  RateLimitConfig,
  RateLimitResult,
} from "../../types/bucket-algorithm.js";
import { RateLimitIpKeyPrefix } from "./index.js";

export async function checkRequestRateLimitBucketAlgorithm(
  requestDetails: ExtractedRequestDetails,
  route: Route,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  validateRequestDetailsOrThrowError(requestDetails);

  const { ip, httpMethod } = requestDetails;

  const policy = config.get(route)?.get(httpMethod);

  if (policy === undefined) {
    throw new RateLimitConfigError(route, httpMethod);
  }

  const { maxRequests, timeWindowSeconds } = policy.rateLimit;

  const redisKey = [RateLimitIpKeyPrefix, route, httpMethod, ip].join(":");

  try {
    return await executeRateLimitScript(
      redisKey,
      maxRequests,
      timeWindowSeconds,
    );
  } catch (error) {
    // Fail-closed: if Redis cannot answer, reject the request rather than
    // letting traffic bypass the limiter.
    console.error(
      `Rate limit check failed for ${route} ${httpMethod} (fail-closed):`,
      error,
    );
    throw new RateLimitUnavailableError();
  }
}
