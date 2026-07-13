import { getRedisValue, setRedisValue } from "../../lib/redis.js";
import { ExtractedRequestDetails } from "../../utils/extractRequestDetails.js";
import { Route } from "../../conf/routes.js";
import {
  RateLimitConfigError,
  validateRequestDetailsOrThrowError,
} from "../../utils/error.js";
import { RateLimitConfig, RequestsUsage } from "../../types/bucket-algorithm.js";
import { RateLimitIpKeyPrefix } from "./index.js";

export async function checkRequestRateLimitBucketAlgorithm(
  requestDetails: ExtractedRequestDetails,
  route: Route,
  config: RateLimitConfig,
): Promise<boolean> {
  const requestUsage = await getRedisValue(requestDetails.ip);

  if (!requestUsage) {
    return refillBucket(requestDetails, config, route);
  }

  return checkIfRateLimitExceeded(
    requestDetails,
    config,
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

//   const bug =  new Promise((resolve) => {setTimeout(resolve, 4000);
//     return true;});
// if(await bug) {
//   console.log("Bug triggered: Simulating a delay of 4 seconds.");
//    await setRedisValue(
//     `${RateLimitIpKeyPrefix}${ip}`,
//     {
//       tokenCount: usage.tokenCount - 1,
//       lastRequestTimestamp: usage.lastRequestTimestamp,
//     },
//     rateLimit.rateLimit.timeWindowSeconds,
//   );
// }

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

