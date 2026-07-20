import { existsSync } from "node:fs";
import process from "node:process";

if (typeof process.loadEnvFile === "function" && existsSync(".env")) {
  process.loadEnvFile();
}
