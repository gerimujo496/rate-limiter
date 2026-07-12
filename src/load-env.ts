import process from "node:process";

if (typeof process.loadEnvFile === "function") {
  process.loadEnvFile();
}
