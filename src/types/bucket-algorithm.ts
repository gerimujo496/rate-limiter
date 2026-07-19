import { Route } from "../conf/routes.js";
import { HttpMethod } from "./http-method.js";

export interface RateLimitPolicy {
  httpMethod: HttpMethod;
  rateLimit: { maxRequests: number; timeWindowSeconds: number };
}
export type RequestsUsage = {
  tokenCount: number;
  lastRefillTimestamp: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

export type RateLimitConfig = Map<Route, Map<HttpMethod, RateLimitPolicy>>;