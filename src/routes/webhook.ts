import { Router } from "express";
import { Route } from "../conf/routes.js";
import { insertWebhook } from "../helpers/webhooks.js";
import { registerWebhookBodySchema } from "../schemas/webhook.js";
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
