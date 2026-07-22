import { query } from "../lib/db.js";
import {
  CreatePendingWebhookDeliveryInput,
  RegisterWebhookBody,
  UpdateWebhookDeliveryResultInput,
  WebhookDeliveryRecord,
  WebhookHttpMethod,
  WebhookRecord,
} from "../types/webhook.js";
import { BadRequestError, NotFoundError } from "../utils/error.js";

const DELIVERY_RETURNING = `
  id,
  webhook_id,
  event,
  method,
  target_url,
  success,
  http_status,
  error_message,
  attempt,
  bullmq_job_id,
  created_at,
  updated_at
`;

export async function insertWebhook(
  webhook: RegisterWebhookBody,
): Promise<WebhookRecord> {
  const result = await query<WebhookRecord>(
    `
      INSERT INTO webhooks (url, methods)
      VALUES ($1, $2::http_method[])
      RETURNING id, url, methods
    `,
    [webhook.url, webhook.methods],
  );

  if (!result.rows[0]) {
    throw new BadRequestError("Failed to register webhook.");
  }

  return result.rows[0];
}

export async function getWebhooksByMethod(
  method: WebhookHttpMethod,
): Promise<WebhookRecord[]> {
  const result = await query<WebhookRecord>(
    `
      SELECT id, url, methods
      FROM webhooks
      WHERE $1 = ANY(methods)
    `,
    [method],
  );

  return result.rows;
}

export async function createPendingWebhookDelivery(
  delivery: CreatePendingWebhookDeliveryInput,
): Promise<WebhookDeliveryRecord> {
  const result = await query<WebhookDeliveryRecord>(
    `
      INSERT INTO webhook_deliveries (
        webhook_id,
        event,
        method,
        target_url,
        success,
        attempt
      )
      VALUES ($1, $2, $3::http_method, $4, NULL, 0)
      RETURNING ${DELIVERY_RETURNING}
    `,
    [delivery.webhookId, delivery.event, delivery.method, delivery.targetUrl],
  );

  if (!result.rows[0]) {
    throw new BadRequestError("Failed to create webhook delivery tracking row.");
  }

  return result.rows[0];
}

export async function updateWebhookDeliveryResult(
  deliveryId: number,
  update: UpdateWebhookDeliveryResultInput,
): Promise<WebhookDeliveryRecord> {
  const result = await query<WebhookDeliveryRecord>(
    `
      UPDATE webhook_deliveries
      SET
        success = $2,
        http_status = $3,
        error_message = $4,
        attempt = $5,
        bullmq_job_id = COALESCE($6, bullmq_job_id),
        updated_at = NOW()
      WHERE id = $1
      RETURNING ${DELIVERY_RETURNING}
    `,
    [
      deliveryId,
      update.success,
      update.httpStatus ?? null,
      update.errorMessage ?? null,
      update.attempt,
      update.bullmqJobId ?? null,
    ],
  );

  if (!result.rows[0]) {
    throw new NotFoundError(
      `Webhook delivery "${deliveryId}" was not found.`,
    );
  }

  return result.rows[0];
}

export async function getWebhookDeliveryById(
  deliveryId: number,
): Promise<WebhookDeliveryRecord> {
  const result = await query<WebhookDeliveryRecord>(
    `
      SELECT ${DELIVERY_RETURNING}
      FROM webhook_deliveries
      WHERE id = $1
    `,
    [deliveryId],
  );

  if (!result.rows[0]) {
    throw new NotFoundError(
      `Webhook delivery "${deliveryId}" was not found.`,
    );
  }

  return result.rows[0];
}
