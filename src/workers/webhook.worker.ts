import { Worker } from "bullmq";
import {
  getBullMqConnection,
  WEBHOOK_QUEUE_NAME,
  type WebhookJobData,
} from "../lib/bullmq.js";

export async function deliverWebhookJob(job: {
  data: WebhookJobData;
}): Promise<void> {
  const { webhookId, url, payload } = job.data;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "distributed_api_service-webhook",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `Webhook ${webhookId} failed with status ${response.status}: ${url}`,
    );
  }
}

export function startWebhookWorker(): Worker<WebhookJobData> {
  const worker = new Worker<WebhookJobData>(
    WEBHOOK_QUEUE_NAME,
    deliverWebhookJob,
    { connection: getBullMqConnection() },
  );

  worker.on("completed", (job) => {
    console.log(`Webhook job ${job.id} delivered to ${job.data.url}`);
  });

  worker.on("failed", (job, error) => {
    const attempt = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts.attempts ?? 10;
    console.error(
      `Webhook job ${job?.id} failed (attempt ${attempt}/${maxAttempts}): ${error.message}`,
    );
  });

  return worker;
}
