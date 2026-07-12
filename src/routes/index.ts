import { Router } from "express";
import { getIpAdressFromRequest } from "../middleware/helper.js";
import { apiRateLimit } from "../middleware/rate-limiter/bucket-algorithm.js";
import { Route } from "../conf/routes.js";

export function createRateLimiterExpressRouter() {
  const router = Router();

  router.get(Route.TokenBucket, apiRateLimit, (request, response) => {
    response.status(200).json({
      ip: getIpAdressFromRequest(request),
      service: "rate-limiter",
      framework: "express",
      algorithm: "token-bucket",
      route: `${Route.RateLimiter}${Route.TokenBucket}`,
      status: "ok",
    });
  });

  return router;
}
