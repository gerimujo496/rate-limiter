import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverWebhookJob } from "../../src/workers/webhook.worker.js";

describe("deliverWebhookJob", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("POSTs the payload to the webhook URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal("fetch", fetchMock);

    await deliverWebhookJob({
      data: {
        webhookId: 7,
        url: "https://example.com/hook",
        payload: {
          event: "user.created",
          method: "POST",
          data: { id: 1 },
        },
      },
    });

    expect(fetchMock).toHaveBeenCalledWith("https://example.com/hook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "distributed_api_service-webhook",
      },
      body: JSON.stringify({
        event: "user.created",
        method: "POST",
        data: { id: 1 },
      }),
    });
  });

  it("throws when the remote endpoint returns a non-OK status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    await expect(
      deliverWebhookJob({
        data: {
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
  });
});
