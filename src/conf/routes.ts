import { HttpMethod } from "../types/http-method.js";


export enum Route {
  RateLimiter = "/rate-limiter",
  Health = "/health",
  TokenBucket = "/token-bucket",
  Urls = "/urls",
  ShortUrl = "/shorturl",
  Webhooks = "/webhooks",
  WebhookHandlerOk = "/webhooks/handlers/ok",
  WebhookHandlerFail = "/webhooks/handlers/fail",
  Users = "/users",
}

export interface AppRouteDefinition {
  method: HttpMethod;
  path: string;
}

export const APP_ROUTES: readonly AppRouteDefinition[] = [
  { method: "GET", path: Route.Health },
  { method: "GET", path: `${Route.RateLimiter}${Route.TokenBucket}` },
  { method: "GET", path: Route.Urls },
  { method: "GET", path: `${Route.Urls}/:shortUrl` },
  { method: "POST", path: Route.Urls },
  { method: "POST", path: Route.Webhooks },
  { method: "POST", path: Route.WebhookHandlerOk },
  { method: "POST", path: Route.WebhookHandlerFail },
  { method: "GET", path: Route.Users },
  { method: "GET", path: `${Route.Users}/:id` },
  { method: "POST", path: Route.Users },
  { method: "PUT", path: `${Route.Users}/:id` },
  { method: "DELETE", path: `${Route.Users}/:id` },
];
