import type { Request } from "express";

export const getIpAdressFromRequest = (request: Request): string => {
  const forwardedFor = request.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(",")[0]?.trim();
  const ip = forwardedIp || request.ip || request.socket.remoteAddress || "";
  return ip;
};
