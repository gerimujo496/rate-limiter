import type { WebhookHttpMethod } from "./webhook.js";

export interface WebhookPayload {
  event: string;
  method: WebhookHttpMethod;
  data: unknown;
}

export interface WebhookJobData {
  deliveryId: number;
  webhookId: number;
  url: string;
  payload: WebhookPayload;
}
