import {
  RateLimitConfig,
  RateLimitPolicy,
} from "../../types/bucket-algorithm.js";
import { HttpMethod } from "../../types/http-method.js";
import { Route } from "../routes.js";

const DEFAULT_MAX_REQUESTS = 10;
const DEFAULT_TIME_WINDOW_SECONDS = 60;

function createPolicy(
  httpMethod: HttpMethod,
  maxRequests = DEFAULT_MAX_REQUESTS,
  timeWindowSeconds = DEFAULT_TIME_WINDOW_SECONDS,
): RateLimitPolicy {
  return {
    httpMethod,
    rateLimit: { maxRequests, timeWindowSeconds },
  };
}

function createMethodPolicies(
  methods: readonly HttpMethod[],
): Map<HttpMethod, RateLimitPolicy> {
  return new Map(
    methods.map((httpMethod) => [httpMethod, createPolicy(httpMethod)]),
  );
}

export const rateLimitConfig: RateLimitConfig = new Map([
  [Route.TokenBucket, createMethodPolicies(["GET", "POST"])],
  [Route.Urls, createMethodPolicies(["POST"])],
  [Route.ShortUrl, createMethodPolicies(["GET"])],
  [Route.Webhooks, createMethodPolicies(["POST"])],
  [Route.WebhookHandlerOk, createMethodPolicies(["POST"])],
  [Route.WebhookHandlerFail, createMethodPolicies(["POST"])],
  [Route.Users, createMethodPolicies(["GET", "POST", "PUT", "DELETE"])],
]);
