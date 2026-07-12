export enum Route {
  RateLimiter = "/rate-limiter",
  Health = "/health",
  TokenBucket = "/token-bucket",
}

export interface AppRouteDefinition {
  method: "GET";
  path: string;
}

export const APP_ROUTES: readonly AppRouteDefinition[] = [
  { method: "GET", path: Route.Health },
  { method: "GET", path: `${Route.RateLimiter}${Route.TokenBucket}` },
];
