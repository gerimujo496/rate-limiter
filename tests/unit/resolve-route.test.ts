import { describe, expect, it } from "vitest";
import { Route } from "../../src/conf/routes.js";
import { resolveRateLimitRoute } from "../../src/helpers/rate-limiter/resolve-route.js";

describe("resolveRateLimitRoute", () => {
  it("maps the token-bucket demo route", () => {
    expect(resolveRateLimitRoute("/rate-limiter/token-bucket")).toBe(
      Route.TokenBucket,
    );
  });

  it("uses longest-prefix matching for webhook handler routes", () => {
    expect(resolveRateLimitRoute("/webhooks/handlers/ok")).toBe(
      Route.WebhookHandlerOk,
    );
    expect(resolveRateLimitRoute("/webhooks/handlers/fail")).toBe(
      Route.WebhookHandlerFail,
    );
    expect(resolveRateLimitRoute("/webhooks")).toBe(Route.Webhooks);
  });

  it("maps nested user paths to the users policy", () => {
    expect(resolveRateLimitRoute("/users")).toBe(Route.Users);
    expect(resolveRateLimitRoute("/users/123")).toBe(Route.Users);
  });

  it("returns null for unknown routes so middleware skips limiting", () => {
    expect(resolveRateLimitRoute("/unknown")).toBeNull();
  });

  it("ignores query strings when resolving the route", () => {
    expect(resolveRateLimitRoute("/health?probe=1")).toBe(Route.Health);
  });
});
