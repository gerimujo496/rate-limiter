import type { Request } from "express";
import type { HttpMethod } from "../conf/rate-limiting/bucket-algorithm.js";

const HTTP_METHODS: readonly HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "QUERY",
  "PATCH",
  "HEAD",
  "OPTIONS",
];

export interface ExtractedRequestDetails {
  ip: string;
  httpMethod: HttpMethod;
}

export function isHttpMethod(value: string): value is HttpMethod {
  return HTTP_METHODS.includes(value as HttpMethod);
}

export async function extractRequestDetails(
  request: Request,
): Promise<ExtractedRequestDetails | null> {
  const ip = request.ip;
  const httpMethod = request.method.toUpperCase();

  if (!ip || !isHttpMethod(httpMethod)) {
    return null;
  }

  return {
    ip,
    httpMethod,
  };
}
