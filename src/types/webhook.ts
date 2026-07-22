import type { WebhookHttpMethod } from "../schemas/webhook.js";

export {
  WEBHOOK_HTTP_METHODS,
  type RegisterWebhookBody,
  type WebhookHttpMethod,
} from "../schemas/webhook.js";

export interface WebhookRecord {
  id: number;
  url: string;
  methods: WebhookHttpMethod[];
}

/** success: null = pending, true = delivered, false = failed after all attempts */
export interface WebhookDeliveryRecord {
  id: number;
  webhook_id: number | null;
  event: string;
  method: WebhookHttpMethod;
  target_url: string;
  success: boolean | null;
  http_status: number | null;
  error_message: string | null;
  attempt: number;
  bullmq_job_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePendingWebhookDeliveryInput {
  webhookId: number;
  event: string;
  method: WebhookHttpMethod;
  targetUrl: string;
}

export interface UpdateWebhookDeliveryResultInput {
  success: boolean;
  httpStatus?: number | null;
  errorMessage?: string | null;
  attempt: number;
  bullmqJobId?: string | null;
}
