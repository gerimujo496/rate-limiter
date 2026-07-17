import { Route } from "../conf/routes.js";
import { ExtractedRequestDetails } from "./extractRequestDetails.js";

export class RateLimitConfigError extends Error {
  constructor(route: Route, httpMethod: ExtractedRequestDetails["httpMethod"]) {
    super(
      `Missing rate limit configuration for route "${route}" and method "${httpMethod}".`,
    );
    this.name = "RateLimitConfigError";
  }
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

export class MethodNotAllowedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MethodNotAllowedError";
  }
}

export class RateLimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitExceededError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export const errorHandler = (
  error: unknown,
): { status: number; message: string } => {
  if (error instanceof RateLimitConfigError) {
    return { status: 500, message: error.message };
  }
  if (error instanceof RateLimitExceededError) {
    return { status: 429, message: error.message };
  }
  if (error instanceof BadRequestError) {
    return { status: 400, message: error.message };
  }
  if (error instanceof NotFoundError) {
    return { status: 404, message: error.message };
  }
  return { status: 500, message: "Internal server error." };
};

export const validateRequestDetailsOrThrowError = (
  requestDetails: ExtractedRequestDetails,
) => {
  const { ip, httpMethod } = requestDetails;

  if (!ip) {
    throw new BadRequestError("IP address is empty or undefined.");
  }

  if (!httpMethod) {
    throw new MethodNotAllowedError("HTTP method is empty or undefined.");
  }
};
