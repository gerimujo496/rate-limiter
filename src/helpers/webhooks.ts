import { query } from "../lib/db.js";
import {
  RegisterWebhookBody,
  WebhookHttpMethod,
  WebhookRecord,
} from "../types/webhook.js";
import { BadRequestError } from "../utils/error.js";

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
