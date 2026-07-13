import { RateLimitConfig, RateLimitPolicy } from "../../types/bucket-algorithm.js";
import { HttpMethod } from "../../types/http-method.js";
import { Route } from "../routes.js";





export const rateLimitConfig: RateLimitConfig = new Map<
  Route,
  Map<HttpMethod, RateLimitPolicy>
>();

rateLimitConfig.set(
  Route.TokenBucket,
  new Map<HttpMethod, RateLimitPolicy>([
    [
      "GET",
      {
        httpMethod: "GET",
        rateLimit: { maxRequests: 10, timeWindowSeconds: 60 },
      },
    ],
    [
      "POST",
      {
        httpMethod: "POST",
        rateLimit: { maxRequests: 10, timeWindowSeconds: 60 },
      },
    ],
  ]),
);
