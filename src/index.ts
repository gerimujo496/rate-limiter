import { createExpressApp } from "./express-server.js";
import { APP_ROUTES } from "./conf/routes.js";
import { loadConfig } from "./config.js";

async function start(): Promise<void> {
  const config = loadConfig();
  const app = createExpressApp(config);

  await new Promise<void>((resolve, reject) => {
    const server = app.listen(config.port, "0.0.0.0", () => resolve());
    server.on("error", reject);
  });

  console.log(`Server listening on http://localhost:${config.port} using express`);
  console.log("Registered routes:");

  for (const route of APP_ROUTES) {
    console.log(`${route.method} ${route.path}`);
  }
}

start().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
