import { HttpMethod } from "../types/http-method.js";


export enum Route {
  RateLimiter = "/rate-limiter",
  Health = "/health",
  TokenBucket = "/token-bucket",
  LeakingBucket = "/leaking-bucket",
  FixedWindow = "/fixed-window",

}

export interface AppRouteDefinition {
  method: HttpMethod;
  path: string;
}

export const APP_ROUTES: readonly AppRouteDefinition[] = [
  { method: "GET", path: Route.Health },
  { method: "GET", path: `${Route.RateLimiter}${Route.TokenBucket}` },
 ];
