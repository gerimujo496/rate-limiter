import process from "node:process";
import "./load-env.js";

export interface AppConfig {
  port: number;
  nodeEnv: string;
  /**
   * How many reverse proxies sit in front of the app.
   * `1` = trust the immediate LB (typical). Affects `request.ip` / X-Forwarded-For.
   */
  trustProxy: boolean | number;
}

function parseCliArgs(argv: string[]): Record<string, string> {
  const parsedArgs: Record<string, string> = {};

  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      continue;
    }

    const [rawKey, rawValue] = arg.slice(2).split("=");
    if (!rawKey || rawValue === undefined) {
      continue;
    }

    parsedArgs[rawKey] = rawValue;
  }

  return parsedArgs;
}

function parsePort(value: string): number {
  const port = Number.parseInt(value, 10);

  if (Number.isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }

  return port;
}

/** Defaults to 1 hop (one load balancer). Set TRUST_PROXY=false to disable. */
export function parseTrustProxy(value: string | undefined): boolean | number {
  if (value === undefined || value.trim() === "") {
    return 1;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false" || normalized === "0") {
    return false;
  }

  const hops = Number.parseInt(normalized, 10);

  if (Number.isNaN(hops) || hops < 0) {
    throw new Error(
      `Invalid TRUST_PROXY: ${value}. Use true, false, or a non-negative hop count.`,
    );
  }

  return hops;
}

export function loadConfig(): AppConfig {
  const cliArgs = parseCliArgs(process.argv.slice(2));
  const port = parsePort(cliArgs.port ?? process.env.PORT ?? "3000");

  return {
    port,
    nodeEnv: process.env.NODE_ENV ?? "development",
    trustProxy: parseTrustProxy(
      cliArgs["trust-proxy"] ?? process.env.TRUST_PROXY,
    ),
  };
}
