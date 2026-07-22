import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/db.js", () => ({
  query: vi.fn(),
}));

describe("webhook delivery persistence helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a pending delivery row with success = null", async () => {
    const { query } = await import("../../src/lib/db.js");
    const { createPendingWebhookDelivery } = await import(
      "../../src/helpers/webhooks.js"
    );

    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: 11,
          webhook_id: 3,
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
        },
      ],
      command: "INSERT",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    const record = await createPendingWebhookDelivery({
      webhookId: 3,
      event: "user.created",
      method: "POST",
      targetUrl: "https://example.com/hook",
    });

    expect(record.id).toBe(11);
    expect(record.success).toBeNull();
  });

  it("updates a delivery row with the final result", async () => {
    const { query } = await import("../../src/lib/db.js");
    const { updateWebhookDeliveryResult } = await import(
      "../../src/helpers/webhooks.js"
    );

    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: 11,
          webhook_id: 3,
          event: "user.created",
          method: "POST",
          target_url: "https://example.com/hook",
          success: true,
          http_status: 200,
          error_message: null,
          attempt: 1,
          bullmq_job_id: "job-1",
          created_at: new Date("2026-07-22T12:00:00.000Z"),
          updated_at: new Date("2026-07-22T12:01:00.000Z"),
        },
      ],
      command: "UPDATE",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    const record = await updateWebhookDeliveryResult(11, {
      success: true,
      httpStatus: 200,
      attempt: 1,
      bullmqJobId: "job-1",
    });

    expect(record.success).toBe(true);
    expect(record.attempt).toBe(1);
  });
});
