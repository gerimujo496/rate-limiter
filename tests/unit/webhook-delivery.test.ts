import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/helpers/webhooks.js", () => ({
  updateWebhookDeliveryResult: vi.fn(),
  insertWebhook: vi.fn(),
  getWebhooksByMethod: vi.fn(),
  createPendingWebhookDelivery: vi.fn(),
}));

describe("deliverWebhookJob", () => {
  beforeEach(async () => {
    const { updateWebhookDeliveryResult } = await import(
      "../../src/helpers/webhooks.js"
    );
    vi.mocked(updateWebhookDeliveryResult).mockResolvedValue({
      id: 50,
      webhook_id: 7,
      event: "user.created",
      method: "POST",
      target_url: "https://example.com/hook",
      success: true,
      http_status: 200,
      error_message: null,
      attempt: 1,
      bullmq_job_id: "job-1",
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("updates the delivery row to success when the callback returns OK", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    );

    const { updateWebhookDeliveryResult } = await import(
      "../../src/helpers/webhooks.js"
    );
    const { deliverWebhookJob } = await import(
      "../../src/workers/webhook.worker.js"
    );

    await deliverWebhookJob({
      id: "job-1",
      attemptsMade: 0,
      opts: { attempts: 10 },
      data: {
        deliveryId: 50,
        webhookId: 7,
        url: "https://example.com/hook",
        payload: {
          event: "user.created",
          method: "POST",
          data: { id: 1 },
        },
      },
    });

    expect(updateWebhookDeliveryResult).toHaveBeenCalledWith(50, {
      success: true,
      httpStatus: 200,
      attempt: 1,
      bullmqJobId: "job-1",
    });
  });

  it("does not mark failed on intermediate attempts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );

    const { updateWebhookDeliveryResult } = await import(
      "../../src/helpers/webhooks.js"
    );
    const { deliverWebhookJob } = await import(
      "../../src/workers/webhook.worker.js"
    );

    await expect(
      deliverWebhookJob({
        id: "job-2",
        attemptsMade: 0,
        opts: { attempts: 10 },
        data: {
          deliveryId: 50,
          webhookId: 7,
          url: "https://example.com/fail",
          payload: {
            event: "user.created",
            method: "POST",
            data: { id: 1 },
          },
        },
      }),
    ).rejects.toThrow(/failed with status 500/);

    expect(updateWebhookDeliveryResult).not.toHaveBeenCalled();
  });

  it("marks failed only on the final attempt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );

    const { updateWebhookDeliveryResult } = await import(
      "../../src/helpers/webhooks.js"
    );
    const { deliverWebhookJob } = await import(
      "../../src/workers/webhook.worker.js"
    );

    await expect(
      deliverWebhookJob({
        id: "job-3",
        attemptsMade: 9,
        opts: { attempts: 10 },
        data: {
          deliveryId: 50,
          webhookId: 7,
          url: "https://example.com/fail",
          payload: {
            event: "user.created",
            method: "POST",
            data: { id: 1 },
          },
        },
      }),
    ).rejects.toThrow(/failed with status 500/);

    expect(updateWebhookDeliveryResult).toHaveBeenCalledWith(50, {
      success: false,
      httpStatus: 500,
      errorMessage: expect.stringContaining("failed with status 500"),
      attempt: 10,
      bullmqJobId: "job-3",
    });
  });
});
