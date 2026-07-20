import { describe, expect, it } from "vitest";
import { setRateLimitHeaders } from "../../src/middleware/rate-limiter/headers.js";

function createMockResponse() {
  const headers = new Map<string, string>();

  return {
    headers,
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
  };
}

describe("setRateLimitHeaders", () => {
  it("sets limit and remaining headers for allowed requests", () => {
    const response = createMockResponse();

    setRateLimitHeaders(response as never, {
      allowed: true,
      limit: 10,
      remaining: 7,
      retryAfterSeconds: 0,
    });

    expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("7");
    expect(response.headers.has("Retry-After")).toBe(false);
  });

  it("sets Retry-After when the request is denied", () => {
    const response = createMockResponse();

    setRateLimitHeaders(response as never, {
      allowed: false,
      limit: 10,
      remaining: 0,
      retryAfterSeconds: 6,
    });

    expect(response.headers.get("Retry-After")).toBe("6");
  });
});
