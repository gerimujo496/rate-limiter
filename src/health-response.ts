import type { AppConfig } from "./config.js";

interface HealthResponseOptions {
  nodeEnv: AppConfig["nodeEnv"];
  service?: string;
}

export function buildHealthResponse({
  nodeEnv,
  service = "distributed_api_service"
}: HealthResponseOptions) {
  return {
    status: "ok",
    service,
    framework: "express",
    environment: nodeEnv,
    uptimeSeconds: Number(process.uptime().toFixed(2)),
    timestamp: new Date().toISOString()
  };
}
