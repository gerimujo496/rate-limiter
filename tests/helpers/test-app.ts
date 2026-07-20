import express from "express";
import { Route } from "../../src/conf/routes.js";
import { apiRateLimit } from "../../src/middleware/rate-limiter/bucket-algorithm.js";

export function createRateLimitTestApp() {
  const app = express();

  app.set("trust proxy", true);
  app.use(apiRateLimit);

  app.get(`${Route.RateLimiter}${Route.TokenBucket}`, (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  return app;
}
