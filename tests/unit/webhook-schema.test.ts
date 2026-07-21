import { describe, expect, it } from "vitest";
import { registerWebhookBodySchema } from "../../src/schemas/webhook.js";

describe("registerWebhookBodySchema", () => {
  it("accepts a valid callback URL and methods", () => {
    const parsed = registerWebhookBodySchema.parse({
      url: "https://api.gerimujo.com/webhooks/handlers/ok",
      methods: ["POST", "PUT"],
    });

    expect(parsed.url).toBe("https://api.gerimujo.com/webhooks/handlers/ok");
    expect(parsed.methods).toEqual(["POST", "PUT"]);
  });

  it("deduplicates methods", () => {
    const parsed = registerWebhookBodySchema.parse({
      url: "https://example.com/hook",
      methods: ["POST", "POST", "DELETE"],
    });

    expect(parsed.methods).toEqual(["POST", "DELETE"]);
  });

  it("rejects an empty methods array", () => {
    expect(() =>
      registerWebhookBodySchema.parse({
        url: "https://example.com/hook",
        methods: [],
      }),
    ).toThrow();
  });

  it("rejects an invalid URL", () => {
    expect(() =>
      registerWebhookBodySchema.parse({
        url: "not-a-url",
        methods: ["POST"],
      }),
    ).toThrow();
  });
});
