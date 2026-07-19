import { enqueueWebhookDelivery } from "../lib/bullmq.js";
import { getWebhooksByMethod } from "../helpers/webhooks.js";
import type { WebhookPayload } from "../types/webhook-job.js";
import { WebhookHttpMethod } from "../types/webhook.js";

export type { WebhookPayload };

export async function triggerWebhooks(
  method: WebhookHttpMethod,
  event: string,
  data: unknown,
): Promise<void> {
  const webhooks = await getWebhooksByMethod(method);

  if (webhooks.length === 0) {
    return;
  }

  const payload: WebhookPayload = { event, method, data };

  await Promise.all(
    webhooks.map((webhook) =>
      enqueueWebhookDelivery({
        webhookId: webhook.id,
        url: webhook.url,
        payload,
      }),
    ),
  );
}
