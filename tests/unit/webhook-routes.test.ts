import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "../../src/conf/routes.js";
import { createWebhookRouter } from "../../src/routes/webhook.js";

vi.mock("../../src/helpers/webhooks.js", () => ({
  insertWebhook: vi.fn(),
  getWebhooksByMethod: vi.fn(),
  getWebhookDeliveryById: vi.fn(),
}));

function createWebhookTestApp() {
  const app = express();
  app.use(express.json());
  app.use(createWebhookRouter());
  return app;
}

describe("webhook HTTP routes", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("registers a webhook and returns 201", async () => {
    const { insertWebhook } = await import("../../src/helpers/webhooks.js");
    vi.mocked(insertWebhook).mockResolvedValueOnce({
      id: 1,
      url: "https://example.com/hook",
      methods: ["POST"],
    });

    const response = await request(createWebhookTestApp())
      .post(Route.Webhooks)
      .send({
        url: "https://example.com/hook",
        methods: ["POST"],
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: 1,
      url: "https://example.com/hook",
      methods: ["POST"],
    });
  });

  it("returns delivery tracking status by id", async () => {
    const { getWebhookDeliveryById } = await import(
      "../../src/helpers/webhooks.js"
    );
    vi.mocked(getWebhookDeliveryById).mockResolvedValueOnce({
      id: 42,
      webhook_id: 1,
      event: "user.created",
      method: "POST",
      target_url: "https://example.com/hook",
      success: null,
      http_status: null,
      error_message: null,
      attempt: 0,
      bullmq_job_id: null,
      created_at: new Date("2026-07-22T12:00:00.000Z"),
      updated_at: new Date("2026-07-22T12:00:00.000Z"),
    });

    const response = await request(createWebhookTestApp()).get(
      `${Route.Webhooks}/deliveries/42`,
    );

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(42);
    expect(response.body.status).toBe("pending");
    expect(response.body.success).toBeNull();
  });

  it("returns 400 for invalid registration bodies", async () => {
    const response = await request(createWebhookTestApp())
      .post(Route.Webhooks)
      .send({ url: "bad", methods: [] });

    expect(response.status).toBe(400);
    expect(response.body.error).toBeTruthy();
  });

  it("demo ok handler returns 200 with the received payload", async () => {
    const response = await request(createWebhookTestApp())
      .post(Route.WebhookHandlerOk)
      .send({ event: "user.created" });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  it("demo fail handler returns 500 for retry testing", async () => {
    const response = await request(createWebhookTestApp())
      .post(Route.WebhookHandlerFail)
      .send({ event: "user.created" });

    expect(response.status).toBe(500);
    expect(response.body.status).toBe("error");
  });
});
