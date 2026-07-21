import type { Request } from "express";

/**
 * Client IP used for rate-limit keys.
 * Requires `app.set("trust proxy", ...)` so Express derives this from
 * X-Forwarded-For when the app sits behind a load balancer.
 */
export function getClientIp(request: Request): string {
  const rawIp = request.ip || request.socket.remoteAddress || "";

  // Node often reports IPv4 as ::ffff:127.0.0.1 — normalize for stable Redis keys.
  if (rawIp.startsWith("::ffff:")) {
    return rawIp.slice("::ffff:".length);
  }

  return rawIp;
}
