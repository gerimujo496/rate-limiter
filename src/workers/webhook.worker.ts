import { Worker } from "bullmq";
import { updateWebhookDeliveryResult } from "../helpers/webhooks.js";
import {
  getBullMqConnection,
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_QUEUE_NAME,
  type WebhookJobData,
} from "../lib/bullmq.js";

export async function deliverWebhookJob(job: {
  id?: string;
  attemptsMade?: number;
  opts?: { attempts?: number };
  data: WebhookJobData;
}): Promise<void> {
  const { deliveryId, webhookId, url, payload } = job.data;
  const attempt = (job.attemptsMade ?? 0) + 1;
  const maxAttempts = job.opts?.attempts ?? WEBHOOK_MAX_ATTEMPTS;
  const isLastAttempt = attempt >= maxAttempts;
  const bullmqJobId = job.id ?? null;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "distributed_api_service-webhook",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorMessage = `Webhook ${webhookId} failed with status ${response.status}: ${url}`;

      if (isLastAttempt) {
        await updateWebhookDeliveryResult(deliveryId, {
          success: false,
          httpStatus: response.status,
          errorMessage,
          attempt,
          bullmqJobId,
        });
      }

      throw new Error(errorMessage);
    }

    await updateWebhookDeliveryResult(deliveryId, {
      success: true,
      httpStatus: response.status,
      attempt,
      bullmqJobId,
    });
  } catch (error) {
    const alreadyRecordedHttpFailure =
      error instanceof Error && error.message.includes("failed with status");

    if (!alreadyRecordedHttpFailure && isLastAttempt) {
      await updateWebhookDeliveryResult(deliveryId, {
        success: false,
        httpStatus: null,
        errorMessage: error instanceof Error ? error.message : String(error),
        attempt,
        bullmqJobId,
      });
    }

    throw error;
  }
}

export function startWebhookWorker(): Worker<WebhookJobData> {
  const worker = new Worker<WebhookJobData>(
    WEBHOOK_QUEUE_NAME,
    deliverWebhookJob,
    { connection: getBullMqConnection() },
  );

  worker.on("completed", (job) => {
    console.log(
      `Webhook job ${job.id} delivered to ${job.data.url} (delivery ${job.data.deliveryId})`,
    );
  });

  worker.on("failed", (job, error) => {
    const attempt = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts.attempts ?? WEBHOOK_MAX_ATTEMPTS;
    console.error(
      `Webhook job ${job?.id} failed (attempt ${attempt}/${maxAttempts}): ${error.message}`,
    );
  });

  return worker;
}
