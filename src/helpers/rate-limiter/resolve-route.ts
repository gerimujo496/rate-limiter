import { Route } from "../../conf/routes.js";

/**
 * Probe and metrics paths must never consume quota.
 * Load balancers and scrapers hit these constantly.
 */
const RATE_LIMIT_EXEMPT_PREFIXES: readonly string[] = [
  Route.Health,
  Route.Metrics,
];

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
].sort((a, b) => b.prefix.length - a.prefix.length);

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function resolveRateLimitRoute(path: string): Route | null {
  const normalized = path.split("?")[0] ?? path;

  for (const prefix of RATE_LIMIT_EXEMPT_PREFIXES) {
    if (matchesPrefix(normalized, prefix)) {
      return null;
    }
  }

  for (const { prefix, route } of ROUTE_PREFIXES) {
    if (matchesPrefix(normalized, prefix)) {
      return route;
    }
  }

  return null;
}
