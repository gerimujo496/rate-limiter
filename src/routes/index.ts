import { Router } from "express";
import { getClientIp } from "../middleware/helper.js";
import { Route } from "../conf/routes.js";

export function createRateLimiterExpressRouter() {
  const router = Router();

  router.get(Route.TokenBucket, (request, response) => {
    response.status(200).json({
      ip: getClientIp(request),
      service: "distributed_api_service",
      framework: "express",
      algorithm: "token-bucket",
      route: `${Route.RateLimiter}${Route.TokenBucket}`,
      message: "Request allowed by token-bucket rate limiter.",
      status: "ok",
    });
  });

  return router;
}
