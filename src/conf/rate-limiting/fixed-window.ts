import {
  FixedWindowRateLimitConfig,
  FixedWindowRateLimitPolicy,
} from "../../types/fixed-window-algorithm.js";
import { HttpMethod } from "../../types/http-method.js";
import { Route } from "../routes.js";

export const fixedWindowRateLimitConfig: FixedWindowRateLimitConfig = new Map<
  Route,
  Map<HttpMethod, FixedWindowRateLimitPolicy>
>();

fixedWindowRateLimitConfig.set(
  Route.FixedWindow,
  new Map<HttpMethod, FixedWindowRateLimitPolicy>([
    [
      "GET",
      {
        httpMethod: "GET",
        rateLimit: { maxRequests: 10, timeWindowSeconds: 60 },
      },
    ],
  ]),
);
