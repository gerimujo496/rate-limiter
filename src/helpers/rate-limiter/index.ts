import type { Request } from "express";
import type { RateLimitConfig } from "../../conf/rate-limiting/bucket-algorithm.js";
import { checkRequestRateLimitBucketAlgorithm } from "./bucket-algorithm.js";
import { extractRequestDetails } from "../../utils/extractRequestDetails.js";
import { Route } from "../../conf/routes.js";
import { BadRequestError } from "../../utils/error.js";

export enum RateLimitAlgorithm {
  TokenBucket = "token-bucket",
}

export const RateLimitIpKeyPrefix = "rate-limit-ip:";

export const hasExceededRequestRateLimit = async (
  algorithm: RateLimitAlgorithm,
  request: Request,
  route: Route,
  config: RateLimitConfig,
): Promise<boolean> => {
  const requestDetails = await extractRequestDetails(request);

  if (!requestDetails) {
    throw new BadRequestError("Failed to extract request details.");
  }

  if (algorithm === RateLimitAlgorithm.TokenBucket) {
    return checkRequestRateLimitBucketAlgorithm(requestDetails, route, config);
  }

  return false;
};
