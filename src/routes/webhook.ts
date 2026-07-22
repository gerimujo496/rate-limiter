import { Router } from "express";
import { Route } from "../conf/routes.js";
import {
  getWebhookDeliveryById,
  insertWebhook,
} from "../helpers/webhooks.js";
import {
  registerWebhookBodySchema,
  webhookDeliveryIdParamSchema,
} from "../schemas/webhook.js";
import { errorHandler } from "../utils/error.js";
import { parseSchema } from "../utils/validation.js";

export function createWebhookRouter() {
  const router = Router();

  router.post(Route.Webhooks, async (request, response) => {
    try {
      const body = parseSchema(registerWebhookBodySchema, request.body);
      const webhook = await insertWebhook(body);

      response.status(201).json(webhook);
    } catch (error) {
      const { status, message } = errorHandler(error);
      response.status(status).json({ error: message });
    }
  });

  router.get(`${Route.Webhooks}/deliveries/:id`, async (request, response) => {
    try {
      const { id } = parseSchema(webhookDeliveryIdParamSchema, request.params);
      const delivery = await getWebhookDeliveryById(id);

      response.status(200).json({
        id: delivery.id,
        webhook_id: delivery.webhook_id,
        event: delivery.event,
        method: delivery.method,
        target_url: delivery.target_url,
        status:
          delivery.success === null
            ? "pending"
            : delivery.success
              ? "succeeded"
              : "failed",
        success: delivery.success,
        http_status: delivery.http_status,
        error_message: delivery.error_message,
        attempt: delivery.attempt,
        bullmq_job_id: delivery.bullmq_job_id,
        created_at: delivery.created_at,
        updated_at: delivery.updated_at,
      });
    } catch (error) {
      const { status, message } = errorHandler(error);
      response.status(status).json({ error: message });
    }
  });

  router.post(Route.WebhookHandlerOk, (request, response) => {
    console.log(
      `[webhook:ok] ${request.method} ${Route.WebhookHandlerOk}`,
      JSON.stringify(request.body, null, 2),
    );
    response.status(200).json({
      status: "ok",
      message: "Webhook received successfully.",
      received: request.body,
    });
  });

  router.post(Route.WebhookHandlerFail, (request, response) => {
    console.error(
      `[webhook:fail] ${request.method} ${Route.WebhookHandlerFail}`,
      JSON.stringify(request.body, null, 2),
    );
    response.status(500).json({
      status: "error",
      message: "Webhook handler intentionally failed.",
      received: request.body,
    });
  });

  return router;
}
