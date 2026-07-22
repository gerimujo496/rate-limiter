import { enqueueWebhookDelivery } from "../lib/bullmq.js";
import {
  createPendingWebhookDelivery,
  getWebhooksByMethod,
} from "../helpers/webhooks.js";
import type { WebhookPayload } from "../types/webhook-job.js";
import { WebhookHttpMethod } from "../types/webhook.js";

export type { WebhookPayload };

/**
 * Creates a pending delivery row per matching webhook, enqueues jobs,
 * and returns tracking IDs for the API response.
 *
 * Failures here are logged and swallowed so Users CRUD still succeeds
 * even if delivery tracking / queue is unavailable.
 */
export async function triggerWebhooks(
  method: WebhookHttpMethod,
  event: string,
  data: unknown,
): Promise<number[]> {
  try {
    const webhooks = await getWebhooksByMethod(method);

    if (webhooks.length === 0) {
      return [];
    }

    const payload: WebhookPayload = { event, method, data };
    const deliveryIds: number[] = [];

    for (const webhook of webhooks) {
      try {
        const delivery = await createPendingWebhookDelivery({
          webhookId: webhook.id,
          event,
          method,
          targetUrl: webhook.url,
        });

        await enqueueWebhookDelivery({
          deliveryId: delivery.id,
          webhookId: webhook.id,
          url: webhook.url,
          payload,
        });

        deliveryIds.push(delivery.id);
      } catch (error) {
        console.error(
          `Failed to enqueue webhook ${webhook.id} for ${event}:`,
          error,
        );
      }
    }

    return deliveryIds;
  } catch (error) {
    console.error(`Failed to trigger webhooks for ${event}:`, error);
    return [];
  }
}
