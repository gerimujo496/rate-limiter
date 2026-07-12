import process from "node:process";
import "./load-env.js";

export interface AppConfig {
  port: number;
  nodeEnv: string;
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

export function loadConfig(): AppConfig {
  const cliArgs = parseCliArgs(process.argv.slice(2));
  const port = parsePort(cliArgs.port ?? process.env.PORT ?? "3000");

  return {
    port,
    nodeEnv: process.env.NODE_ENV ?? "development"
  };
}
