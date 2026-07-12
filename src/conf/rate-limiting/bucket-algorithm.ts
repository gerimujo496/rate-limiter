import { Route } from "../routes.js";

export type HttpMethod =
  | "GET"
  | "POST"
  | "QUERY"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "HEAD"
  | "OPTIONS";

interface RateLimitPolicy {
  httpMethod: HttpMethod;
  rateLimit: { maxRequests: number; timeWindowSeconds: number };
}
export type RequestsUsage = { tokenCount: number; lastRequestTimestamp: Date };

export type RateLimitConfig = Map<Route, Map<HttpMethod, RateLimitPolicy>>;

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
