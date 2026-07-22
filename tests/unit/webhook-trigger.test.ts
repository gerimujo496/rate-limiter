import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/helpers/webhooks.js", () => ({
  getWebhooksByMethod: vi.fn(),
  createPendingWebhookDelivery: vi.fn(),
  insertWebhook: vi.fn(),
}));

vi.mock("../../src/lib/bullmq.js", () => ({
  enqueueWebhookDelivery: vi.fn(),
  WEBHOOK_QUEUE_NAME: "webhooks",
  WEBHOOK_JOB_NAME: "deliver-webhook",
  WEBHOOK_MAX_ATTEMPTS: 10,
  getBullMqConnection: vi.fn(),
  webhookQueue: {},
}));

describe("triggerWebhooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty list when no webhooks match", async () => {
    const { getWebhooksByMethod } = await import(
      "../../src/helpers/webhooks.js"
    );
    const { enqueueWebhookDelivery } = await import("../../src/lib/bullmq.js");
    const { triggerWebhooks } = await import(
      "../../src/services/webhook.service.js"
    );

    vi.mocked(getWebhooksByMethod).mockResolvedValueOnce([]);

    const ids = await triggerWebhooks("POST", "user.created", { id: 1 });

    expect(ids).toEqual([]);
    expect(enqueueWebhookDelivery).not.toHaveBeenCalled();
  });

  it("creates pending deliveries, enqueues jobs, and returns tracking ids", async () => {
    const { getWebhooksByMethod, createPendingWebhookDelivery } = await import(
      "../../src/helpers/webhooks.js"
    );
    const { enqueueWebhookDelivery } = await import("../../src/lib/bullmq.js");
    const { triggerWebhooks } = await import(
      "../../src/services/webhook.service.js"
    );

    vi.mocked(getWebhooksByMethod).mockResolvedValueOnce([
      { id: 10, url: "https://example.com/a", methods: ["POST"] },
      { id: 11, url: "https://example.com/b", methods: ["POST", "PUT"] },
    ]);
    vi.mocked(createPendingWebhookDelivery)
      .mockResolvedValueOnce({
        id: 100,
        webhook_id: 10,
        event: "user.created",
        method: "POST",
        target_url: "https://example.com/a",
        success: null,
        http_status: null,
        error_message: null,
        attempt: 0,
        bullmq_job_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .mockResolvedValueOnce({
        id: 101,
        webhook_id: 11,
        event: "user.created",
        method: "POST",
        target_url: "https://example.com/b",
        success: null,
        http_status: null,
        error_message: null,
        attempt: 0,
        bullmq_job_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      });
    vi.mocked(enqueueWebhookDelivery).mockResolvedValue(undefined);

    const user = { id: 1, name: "Ada", phone_number: "+1" };
    const ids = await triggerWebhooks("POST", "user.created", user);

    expect(ids).toEqual([100, 101]);
    expect(createPendingWebhookDelivery).toHaveBeenCalledTimes(2);
    expect(enqueueWebhookDelivery).toHaveBeenCalledWith({
      deliveryId: 100,
      webhookId: 10,
      url: "https://example.com/a",
      payload: { event: "user.created", method: "POST", data: user },
    });
    expect(enqueueWebhookDelivery).toHaveBeenCalledWith({
      deliveryId: 101,
      webhookId: 11,
      url: "https://example.com/b",
      payload: { event: "user.created", method: "POST", data: user },
    });
  });
});
