import { describe, expect, it } from "vitest";
import { rateLimitConfig } from "../../src/conf/rate-limiting/bucket-algorithm.js";
import { Route } from "../../src/conf/routes.js";
import { HttpMethod } from "../../src/types/http-method.js";
import { checkRequestRateLimitBucketAlgorithm } from "../../src/helpers/rate-limiter/bucket-algorithm.js";
import { RateLimitConfigError } from "../../src/utils/error.js";

const ROUTES_WITH_POLICIES: readonly Route[] = [
  Route.Health,
  Route.TokenBucket,
  Route.Urls,
  Route.ShortUrl,
  Route.Webhooks,
  Route.WebhookHandlerOk,
  Route.WebhookHandlerFail,
  Route.Users,
];

describe("rateLimitConfig", () => {
  it.each(ROUTES_WITH_POLICIES)("defines policies for %s", (route) => {
    expect(rateLimitConfig.has(route)).toBe(true);
    expect(rateLimitConfig.get(route)?.size).toBeGreaterThan(0);
  });

  it("throws when a route and method have no configured policy", async () => {
    await expect(
      checkRequestRateLimitBucketAlgorithm(
        { ip: "127.0.0.1", httpMethod: "PATCH" as HttpMethod },
        Route.Health,
        rateLimitConfig,
      ),
    ).rejects.toBeInstanceOf(RateLimitConfigError);
  });
});
