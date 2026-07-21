import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/helpers/webhooks.js", () => ({
  getWebhooksByMethod: vi.fn(),
  insertWebhook: vi.fn(),
}));

vi.mock("../../src/lib/bullmq.js", () => ({
  enqueueWebhookDelivery: vi.fn(),
  WEBHOOK_QUEUE_NAME: "webhooks",
  WEBHOOK_JOB_NAME: "deliver-webhook",
  getBullMqConnection: vi.fn(),
  webhookQueue: {},
}));

describe("triggerWebhooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when no webhooks match the method", async () => {
    const { getWebhooksByMethod } = await import(
      "../../src/helpers/webhooks.js"
    );
    const { enqueueWebhookDelivery } = await import("../../src/lib/bullmq.js");
    const { triggerWebhooks } = await import(
      "../../src/services/webhook.service.js"
    );

    vi.mocked(getWebhooksByMethod).mockResolvedValueOnce([]);

    await triggerWebhooks("POST", "user.created", { id: 1 });

    expect(getWebhooksByMethod).toHaveBeenCalledWith("POST");
    expect(enqueueWebhookDelivery).not.toHaveBeenCalled();
  });

  it("enqueues one delivery job per matching webhook", async () => {
    const { getWebhooksByMethod } = await import(
      "../../src/helpers/webhooks.js"
    );
    const { enqueueWebhookDelivery } = await import("../../src/lib/bullmq.js");
    const { triggerWebhooks } = await import(
      "../../src/services/webhook.service.js"
    );

    vi.mocked(getWebhooksByMethod).mockResolvedValueOnce([
      {
        id: 10,
        url: "https://example.com/a",
        methods: ["POST"],
      },
      {
        id: 11,
        url: "https://example.com/b",
        methods: ["POST", "PUT"],
      },
    ]);
    vi.mocked(enqueueWebhookDelivery).mockResolvedValue(undefined);

    const user = { id: 1, name: "Ada", phone_number: "+1" };
    await triggerWebhooks("POST", "user.created", user);

    expect(enqueueWebhookDelivery).toHaveBeenCalledTimes(2);
    expect(enqueueWebhookDelivery).toHaveBeenCalledWith({
      webhookId: 10,
      url: "https://example.com/a",
      payload: { event: "user.created", method: "POST", data: user },
    });
    expect(enqueueWebhookDelivery).toHaveBeenCalledWith({
      webhookId: 11,
      url: "https://example.com/b",
      payload: { event: "user.created", method: "POST", data: user },
    });
  });
});
