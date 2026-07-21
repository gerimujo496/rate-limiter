import express, { type Application } from "express";
import type { AppConfig } from "./config.js";
import { Route } from "./conf/routes.js";
import { buildHealthResponse } from "./health-response.js";
import { apiRateLimit } from "./middleware/rate-limiter/bucket-algorithm.js";
import { createRateLimiterExpressRouter } from "./routes/index.js";
import { createUrlsRouter } from "./routes/urls.js";
import { createUsersRouter } from "./routes/users.js";
import { createWebhookRouter } from "./routes/webhook.js";

export function createExpressApp(config: AppConfig): Application {
  const app = express();

  app.disable("x-powered-by");
  // Trust the load balancer so request.ip / rate-limit keys use the real client IP.
  app.set("trust proxy", config.trustProxy);
  app.use(express.json());
  app.use(apiRateLimit);

  app.get("/health", (_request, response) => {
    response.status(200).json(
      buildHealthResponse({
        nodeEnv: config.nodeEnv,
      }),
    );
  });

  app.use(Route.RateLimiter, createRateLimiterExpressRouter());
  app.use(createUrlsRouter());
  app.use(createWebhookRouter());
  app.use(createUsersRouter());

  return app;
}
