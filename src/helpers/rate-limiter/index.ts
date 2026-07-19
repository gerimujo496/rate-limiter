import type { Request } from "express";

import { checkRequestRateLimitBucketAlgorithm } from "./bucket-algorithm.js";
import { extractRequestDetails } from "../../utils/extractRequestDetails.js";
import { Route } from "../../conf/routes.js";
import { BadRequestError } from "../../utils/error.js";
import {
  RateLimitConfig,
  RateLimitResult,
} from "../../types/bucket-algorithm.js";

export enum RateLimitAlgorithm {
  TokenBucket = "token-bucket",
}

export const RateLimitIpKeyPrefix = "rate-limit-ip:";

export const evaluateRequestRateLimit = async (
  algorithm: RateLimitAlgorithm,
  request: Request,
  route: Route,
  config: RateLimitConfig,
): Promise<RateLimitResult> => {
  const requestDetails = await extractRequestDetails(request);

  if (!requestDetails) {
    throw new BadRequestError("Failed to extract request details.");
  }

  if (algorithm === RateLimitAlgorithm.TokenBucket) {
    return checkRequestRateLimitBucketAlgorithm(requestDetails, route, config);
  }

  throw new BadRequestError(`Unsupported rate limit algorithm: ${algorithm}`);
};
