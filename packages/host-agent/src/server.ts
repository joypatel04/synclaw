import express, { type NextFunction, type Request, type Response } from "express";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type RuntimeCreateBody = {
  workspaceId: string;
  jobId: string;
  region: string;
  openclawGatewayToken: string;
  filesBridgeToken: string;
  filesBridgePort?: number;
  filesBridgeRootPath?: string;
  upstreamPort?: number;
  resourceProfile?: string;
  controlUiAllowedOrigins?: string[];
};

const PORT = Number(process.env.PORT ?? "8790");
const AUTH_TOKEN = (process.env.MANAGED_HOST_AGENT_SHARED_TOKEN ?? "").trim();
const OPENCLAW_IMAGE = (process.env.MANAGED_HOST_AGENT_OPENCLAW_IMAGE ?? "ghcr.io/openclaw/openclaw:latest").trim();
const FS_BRIDGE_IMAGE = (process.env.MANAGED_HOST_AGENT_FS_BRIDGE_IMAGE ?? "ghcr.io/synclaw/fs-bridge:latest").trim();
const DOCKER_TIMEOUT_MS = Number(process.env.MANAGED_HOST_AGENT_DOCKER_TIMEOUT_MS ?? "60000");
const DEFAULT_UPSTREAM_PORT = Number(process.env.MANAGED_UPSTREAM_WS_PORT ?? "18789");
const DEFAULT_FS_BRIDGE_PORT = Number(process.env.MANAGED_FILES_BRIDGE_PORT ?? "8787");
const DEFAULT_FS_BRIDGE_ROOT = (process.env.MANAGED_FILES_BRIDGE_ROOT_PATH ?? "/root/.openclaw").trim();

const app = express();
app.use(express.json({ limit: "2mb" }));

function log(event: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...data }));
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!AUTH_TOKEN) {
    res.status(500).json({ error: "MANAGED_HOST_AGENT_SHARED_TOKEN is not configured." });
    return;
  }
  const auth = req.headers.authorization ?? "";
  if (!auth.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token." });
    return;
  }
  const token = auth.slice("Bearer ".length).trim();
  if (token !== AUTH_TOKEN) {
    res.status(403).json({ error: "Invalid token." });
    return;
  }
  next();
}

function sanitizeWorkspaceId(workspaceId: string): string {
  return workspaceId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 48);
}

function runtimeNames(workspaceId: string) {
  const key = sanitizeWorkspaceId(workspaceId);
  return {
    key,
    network: `synclaw-net-${key}`,
    volume: `synclaw-vol-${key}`,
    openclawContainer: `synclaw-openclaw-${key}`,
    fsBridgeContainer: `synclaw-fsbridge-${key}`,
  };
}

async function docker(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return await execFileAsync("docker", args, { timeout: DOCKER_TIMEOUT_MS });
}

async function dockerAllowFailure(args: string[]) {
  try {
    await docker(args);
    return true;
  } catch {
    return false;
  }
}

async function ensureNetwork(name: string) {
  const exists = await dockerAllowFailure(["network", "inspect", name]);
  if (!exists) {
    await docker(["network", "create", name]);
  }
}

async function ensureVolume(name: string) {
  const exists = await dockerAllowFailure(["volume", "inspect", name]);
  if (!exists) {
    await docker(["volume", "create", name]);
  }
}

async function containerExists(name: string): Promise<boolean> {
  return await dockerAllowFailure(["inspect", name]);
}

async function removeContainerIfExists(name: string) {
  if (await containerExists(name)) {
    await dockerAllowFailure(["rm", "-f", name]);
  }
}

async function runOpenClawContainer(input: {
  workspaceId: string;
  containerName: string;
  network: string;
  volume: string;
  upstreamPort: number;
  gatewayToken: string;
}) {
  const envArgs = [
    "-e",
    `OPENCLAW_GATEWAY_TOKEN=${input.gatewayToken}`,
    "-e",
    `OPENCLAW_GATEWAY_PORT=${String(input.upstreamPort)}`,
    "-e",
    `OPENCLAW_WORKSPACE_ID=${input.workspaceId}`,
  ];
  const command = [
    "sh",
    "-lc",
    [
      "set -euo pipefail",
      "mkdir -p /root/.openclaw",
      "if [ ! -f /root/.openclaw/openclaw.json ]; then",
      "  echo '{}' >/root/.openclaw/openclaw.json",
      "fi",
      "openclaw gateway run --allow-unconfigured --auth token --token \"$OPENCLAW_GATEWAY_TOKEN\" --port \"$OPENCLAW_GATEWAY_PORT\" --bind lan",
    ].join("; "),
  ];

  await docker([
    "run",
    "-d",
    "--name",
    input.containerName,
    "--restart",
    "unless-stopped",
    "--network",
    input.network,
    "-p",
    `${String(input.upstreamPort)}:${String(input.upstreamPort)}`,
    "-v",
    `${input.volume}:/root/.openclaw`,
    ...envArgs,
    OPENCLAW_IMAGE,
    ...command,
  ]);
}

async function runFsBridgeContainer(input: {
  workspaceId: string;
  containerName: string;
  network: string;
  volume: string;
  filesBridgePort: number;
  filesBridgeToken: string;
  filesBridgeRootPath: string;
}) {
  await docker([
    "run",
    "-d",
    "--name",
    input.containerName,
    "--restart",
    "unless-stopped",
    "--network",
    input.network,
    "-p",
    `${String(input.filesBridgePort)}:${String(input.filesBridgePort)}`,
    "-e",
    `FS_BRIDGE_TOKEN=${input.filesBridgeToken}`,
    "-e",
    `FS_BRIDGE_PORT=${String(input.filesBridgePort)}`,
    "-e",
    `FS_BRIDGE_ROOT_PATH=${input.filesBridgeRootPath}`,
    "-e",
    `OPENCLAW_WORKSPACE_ID=${input.workspaceId}`,
    "-v",
    `${input.volume}:${input.filesBridgeRootPath}`,
    FS_BRIDGE_IMAGE,
  ]);
}

async function readContainerRunning(container: string): Promise<boolean> {
  try {
    const { stdout } = await docker(["inspect", container, "--format", "{{.State.Running}}"]);
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

async function readContainerId(container: string): Promise<string | null> {
  try {
    const { stdout } = await docker(["inspect", container, "--format", "{{.Id}}"]);
    const id = stdout.trim();
    return id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

app.get("/agent/health", (_req, res) => {
  res.json({ ok: true, service: "synclaw-host-agent" });
});

app.post("/agent/runtime/create", requireAuth, async (req, res) => {
  const body = req.body as RuntimeCreateBody;
  if (!body?.workspaceId || !body?.openclawGatewayToken || !body?.filesBridgeToken) {
    res.status(400).json({
      error: "workspaceId, openclawGatewayToken, and filesBridgeToken are required.",
    });
    return;
  }

  const names = runtimeNames(body.workspaceId);
  const upstreamPort = Number(body.upstreamPort ?? DEFAULT_UPSTREAM_PORT);
  const filesBridgePort = Number(body.filesBridgePort ?? DEFAULT_FS_BRIDGE_PORT);
  const filesBridgeRootPath = (body.filesBridgeRootPath ?? DEFAULT_FS_BRIDGE_ROOT).trim();
  try {
    await ensureNetwork(names.network);
    await ensureVolume(names.volume);
    await removeContainerIfExists(names.openclawContainer);
    await removeContainerIfExists(names.fsBridgeContainer);

    await runOpenClawContainer({
      workspaceId: body.workspaceId,
      containerName: names.openclawContainer,
      network: names.network,
      volume: names.volume,
      upstreamPort,
      gatewayToken: body.openclawGatewayToken,
    });

    await runFsBridgeContainer({
      workspaceId: body.workspaceId,
      containerName: names.fsBridgeContainer,
      network: names.network,
      volume: names.volume,
      filesBridgePort,
      filesBridgeToken: body.filesBridgeToken,
      filesBridgeRootPath,
    });

    const openclawContainerId = await readContainerId(names.openclawContainer);
    const fsBridgeContainerId = await readContainerId(names.fsBridgeContainer);
    const openclawRunning = await readContainerRunning(names.openclawContainer);
    const fsBridgeRunning = await readContainerRunning(names.fsBridgeContainer);
    if (!openclawRunning || !fsBridgeRunning) {
      throw new Error("Tenant containers failed to reach running state.");
    }

    log("runtime_created", {
      workspaceId: body.workspaceId,
      runtimeId: names.key,
      upstreamPort,
      filesBridgePort,
    });

    res.json({
      ok: true,
      runtimeId: names.key,
      upstreamHost: process.env.MANAGED_HOST_UPSTREAM_IP ?? process.env.HOST_IP ?? "127.0.0.1",
      upstreamPort,
      fsBridgeBaseUrl: `http://${process.env.MANAGED_HOST_UPSTREAM_IP ?? process.env.HOST_IP ?? "127.0.0.1"}:${String(filesBridgePort)}`,
      openclawContainerId,
      fsBridgeContainerId,
      volumeName: names.volume,
      resourceProfile: body.resourceProfile ?? "default",
    });
  } catch (error) {
    log("runtime_create_failed", {
      workspaceId: body.workspaceId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/agent/runtime/delete", requireAuth, async (req, res) => {
  const workspaceId = String(req.body?.workspaceId ?? "").trim();
  if (!workspaceId) {
    res.status(400).json({ error: "workspaceId is required." });
    return;
  }
  const names = runtimeNames(workspaceId);
  await removeContainerIfExists(names.openclawContainer);
  await removeContainerIfExists(names.fsBridgeContainer);
  await dockerAllowFailure(["network", "rm", names.network]);
  res.json({ ok: true, deleted: true });
});

app.post("/agent/runtime/restart", requireAuth, async (req, res) => {
  const workspaceId = String(req.body?.workspaceId ?? "").trim();
  if (!workspaceId) {
    res.status(400).json({ error: "workspaceId is required." });
    return;
  }
  const names = runtimeNames(workspaceId);
  const openclawExists = await containerExists(names.openclawContainer);
  const fsBridgeExists = await containerExists(names.fsBridgeContainer);
  if (!openclawExists || !fsBridgeExists) {
    res.status(404).json({ ok: false, error: "Runtime not found." });
    return;
  }
  await docker(["restart", names.openclawContainer]);
  await docker(["restart", names.fsBridgeContainer]);
  res.json({
    ok: true,
    runtimeId: names.key,
    upstreamHost: process.env.MANAGED_HOST_UPSTREAM_IP ?? process.env.HOST_IP ?? "127.0.0.1",
    upstreamPort: DEFAULT_UPSTREAM_PORT,
    fsBridgeBaseUrl: `http://${process.env.MANAGED_HOST_UPSTREAM_IP ?? process.env.HOST_IP ?? "127.0.0.1"}:${String(DEFAULT_FS_BRIDGE_PORT)}`,
    openclawContainerId: await readContainerId(names.openclawContainer),
    fsBridgeContainerId: await readContainerId(names.fsBridgeContainer),
    volumeName: names.volume,
  });
});

app.get("/agent/runtime/status", requireAuth, async (req, res) => {
  const workspaceId = String(req.query.workspaceId ?? "").trim();
  if (!workspaceId) {
    res.status(400).json({ error: "workspaceId is required." });
    return;
  }
  const names = runtimeNames(workspaceId);
  const openclawExists = await containerExists(names.openclawContainer);
  const fsBridgeExists = await containerExists(names.fsBridgeContainer);
  if (!openclawExists || !fsBridgeExists) {
    res.status(404).json({ ok: false, runtimeStatus: "missing" });
    return;
  }
  const openclawRunning = await readContainerRunning(names.openclawContainer);
  const fsBridgeRunning = await readContainerRunning(names.fsBridgeContainer);
  const runtimeStatus =
    openclawRunning && fsBridgeRunning ? "ready" : "degraded";
  res.json({
    ok: runtimeStatus === "ready",
    runtimeStatus,
    runtimeId: names.key,
    upstreamHost: process.env.MANAGED_HOST_UPSTREAM_IP ?? process.env.HOST_IP ?? "127.0.0.1",
    upstreamPort: DEFAULT_UPSTREAM_PORT,
    fsBridgeBaseUrl: `http://${process.env.MANAGED_HOST_UPSTREAM_IP ?? process.env.HOST_IP ?? "127.0.0.1"}:${String(DEFAULT_FS_BRIDGE_PORT)}`,
    openclawContainerId: await readContainerId(names.openclawContainer),
    fsBridgeContainerId: await readContainerId(names.fsBridgeContainer),
    volumeName: names.volume,
  });
});

app.listen(PORT, () => {
  log("service_started", { port: PORT, openclawImage: OPENCLAW_IMAGE, fsBridgeImage: FS_BRIDGE_IMAGE });
});
