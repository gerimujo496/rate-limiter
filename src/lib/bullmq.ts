import { Queue, type ConnectionOptions } from "bullmq";
import process from "node:process";
import "../load-env.js";
import type { WebhookJobData } from "../types/webhook-job.js";

export const WEBHOOK_QUEUE_NAME = "webhooks";
export const WEBHOOK_JOB_NAME = "deliver-webhook";
export const WEBHOOK_MAX_ATTEMPTS = 10;

export type { WebhookJobData };

export function getBullMqConnection(): ConnectionOptions {
  const redisUrl = process.env.UPSTASH_REDIS_URL;

  if (redisUrl) {
    return {
      url: redisUrl,
      maxRetriesPerRequest: null,
    };
  }

  const restUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!restUrl || !token) {
    throw new Error(
      "Missing Redis env vars for BullMQ. Set UPSTASH_REDIS_URL or UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    );
  }

  return {
    host: new URL(restUrl).hostname,
    port: 6379,
    password: token,
    tls: {},
    maxRetriesPerRequest: null,
  };
}

export const webhookQueue = new Queue<WebhookJobData>(WEBHOOK_QUEUE_NAME, {
  connection: getBullMqConnection(),
  defaultJobOptions: {
    attempts: WEBHOOK_MAX_ATTEMPTS,
    backoff: {
      type: "fixed",
      delay: 10_000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export async function enqueueWebhookDelivery(
  job: WebhookJobData,
): Promise<void> {
  await webhookQueue.add(WEBHOOK_JOB_NAME, job);
}
