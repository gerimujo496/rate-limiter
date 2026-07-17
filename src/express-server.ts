import express, { type Application } from "express";
import type { AppConfig } from "./config.js";
import { Route } from "./conf/routes.js";
import { buildHealthResponse } from "./health-response.js";
import { createRateLimiterExpressRouter } from "./routes/index.js";
import { createUrlsRouter } from "./routes/urls.js";

export function createExpressApp(config: AppConfig): Application {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.status(200).json(
      buildHealthResponse({
        nodeEnv: config.nodeEnv,
      }),
    );
  });

  app.use(Route.RateLimiter, createRateLimiterExpressRouter());
  app.use(createUrlsRouter());

  return app;
}
