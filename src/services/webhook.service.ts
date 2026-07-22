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
 */
export async function triggerWebhooks(
  method: WebhookHttpMethod,
  event: string,
  data: unknown,
): Promise<number[]> {
  const webhooks = await getWebhooksByMethod(method);

  if (webhooks.length === 0) {
    return [];
  }

  const payload: WebhookPayload = { event, method, data };
  const deliveryIds: number[] = [];

  for (const webhook of webhooks) {
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
  }

  return deliveryIds;
}
