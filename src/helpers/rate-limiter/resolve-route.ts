import { Route } from "../../conf/routes.js";

/** Longest-prefix first so nested paths (e.g. webhook handlers) win. */
const ROUTE_PREFIXES: ReadonlyArray<{ prefix: string; route: Route }> = [
  {
    prefix: `${Route.RateLimiter}${Route.TokenBucket}`,
    route: Route.TokenBucket,
  },
  { prefix: Route.WebhookHandlerOk, route: Route.WebhookHandlerOk },
  { prefix: Route.WebhookHandlerFail, route: Route.WebhookHandlerFail },
  { prefix: Route.Webhooks, route: Route.Webhooks },
  { prefix: Route.ShortUrl, route: Route.ShortUrl },
  { prefix: Route.Urls, route: Route.Urls },
  { prefix: Route.Users, route: Route.Users },
  { prefix: Route.Health, route: Route.Health },
].sort((a, b) => b.prefix.length - a.prefix.length);

export function resolveRateLimitRoute(path: string): Route | null {
  const normalized = path.split("?")[0] ?? path;

  for (const { prefix, route } of ROUTE_PREFIXES) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return route;
    }
  }

  return null;
}
