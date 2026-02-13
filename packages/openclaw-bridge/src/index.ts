import { loadConfig } from "./config.js";
import { OpenClawBridgeWorker } from "./worker.js";

async function main() {
  const config = loadConfig();
  const worker = new OpenClawBridgeWorker(config);

  const shutdown = async () => {
    console.log("Shutting down openclaw bridge...");
    await worker.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });

  console.log("Starting openclaw bridge worker", {
    workerId: config.workerId,
    gatewayWsUrl: config.gatewayWsUrl,
    workspaceId: config.workspaceId,
  });

  await worker.start();
}

main().catch((error) => {
  console.error("Bridge fatal error:", error);
  process.exit(1);
});
