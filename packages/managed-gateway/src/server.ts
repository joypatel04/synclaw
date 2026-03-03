import express, { type Request, type Response, type NextFunction } from "express";
import http, { type IncomingMessage } from "node:http";
import net from "node:net";
import path from "node:path";
import { mkdirSync, readFileSync } from "node:fs";
import { Client as SshClient, type ClientChannel } from "ssh2";
import Database from "better-sqlite3";
import { WebSocket, WebSocketServer, type RawData } from "ws";

type RouteRow = {
  workspace_id: string;
  upstream_host: string;
  upstream_port: number;
  region: string;
  status: "pending" | "ready" | "failed";
  last_verified_at: number | null;
  updated_at: number;
  route_version: number;
};

type BootstrapBody = {
  workspaceId: string;
  jobId: string;
  provider: "hetzner" | "aws";
  instanceId: string;
  host: string;
  region: string;
  bootstrapUser?: string;
  sshPrivateKey?: string;
  openclawGatewayToken?: string;
  filesBridgeToken?: string;
  filesBridgePort?: number;
  filesBridgeRootPath?: string;
  controlUiAllowedOrigins?: string[];
};

type UpsertRouteBody = {
  workspaceId: string;
  jobId: string;
  upstreamHost: string;
  upstreamPort?: number;
  region: string;
  wsUrl: string;
};

type ManagedProvider = "openai" | "anthropic" | "gemini";

type ApplyProviderBody = {
  workspaceId: string;
  jobId: string;
  host: string;
  bootstrapUser?: string;
  sshPrivateKey?: string;
  provider: ManagedProvider;
  apiKey: string;
  defaultModel: string;
  controlUiAllowedOrigins?: string[];
};

type VerifyProviderBody = {
  workspaceId: string;
  host: string;
  bootstrapUser?: string;
  sshPrivateKey?: string;
  provider: ManagedProvider;
  defaultModel: string;
};

const PORT = Number(process.env.PORT ?? "8788");
const CONTROL_TOKEN = (process.env.MANAGED_GATEWAY_API_TOKEN ?? "").trim();
const WORKSPACE_WS_PATH_PREFIX = (process.env.WORKSPACE_WS_PATH_PREFIX ?? "/ws").trim();
const UPSTREAM_WS_PATH = (process.env.MANAGED_UPSTREAM_WS_PATH ?? "/").trim();
const UPSTREAM_WS_SCHEME = (process.env.MANAGED_UPSTREAM_WS_SCHEME ?? "ws").trim();
const UPSTREAM_WS_PORT_DEFAULT = Number(process.env.MANAGED_UPSTREAM_WS_PORT ?? "18789");
const BOOTSTRAP_TIMEOUT_MS = Number(process.env.MANAGED_BOOTSTRAP_TIMEOUT_MS ?? "120000");
const SSH_READY_TIMEOUT_MS = Number(process.env.MANAGED_BOOTSTRAP_SSH_READY_TIMEOUT_MS ?? "30000");
const SSH_CONNECT_TIMEOUT_MS = Number(process.env.MANAGED_BOOTSTRAP_SSH_CONNECT_TIMEOUT_MS ?? "20000");
const VERIFY_TIMEOUT_MS = Number(process.env.MANAGED_HEALTHCHECK_TIMEOUT_MS ?? "12000");
const PROVIDER_PORT_WAIT_SECONDS = Number(
  process.env.MANAGED_PROVIDER_PORT_WAIT_SECONDS ?? "30",
);
const VERBOSE_LOGS = (process.env.MANAGED_VERBOSE_LOGS ?? "true").trim() !== "false";
const REQUIRE_CUSTOM_BOOTSTRAP_SCRIPT =
  (process.env.MANAGED_REQUIRE_CUSTOM_BOOTSTRAP_SCRIPT ?? "true").trim() === "true";

const dbFile = process.env.MANAGED_GATEWAY_DB_PATH?.trim() || "/var/lib/managed-gateway/routes.db";
mkdirSync(path.dirname(dbFile), { recursive: true });
const db = new Database(dbFile);
db.pragma("journal_mode = WAL");

// Persistent workspace route registry for WS routing.
db.exec(`
CREATE TABLE IF NOT EXISTS workspace_routes (
  workspace_id TEXT PRIMARY KEY,
  upstream_host TEXT NOT NULL,
  upstream_port INTEGER NOT NULL,
  region TEXT NOT NULL,
  status TEXT NOT NULL,
  last_verified_at INTEGER,
  updated_at INTEGER NOT NULL,
  route_version INTEGER NOT NULL DEFAULT 1
);
`);

const app = express();
app.use(express.json({ limit: "2mb" }));

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!CONTROL_TOKEN) {
    res.status(500).json({ error: "MANAGED_GATEWAY_API_TOKEN is not configured." });
    return;
  }
  const auth = req.headers.authorization ?? "";
  if (!auth.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token." });
    return;
  }
  const token = auth.slice("Bearer ".length).trim();
  if (token !== CONTROL_TOKEN) {
    res.status(403).json({ error: "Invalid token." });
    return;
  }
  next();
}

function log(event: string, data: Record<string, unknown>) {
  // Lightweight JSON logs for VM/container observability.
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...data }));
}

function redactSensitive(text: string): string {
  return text
    .replace(
      /(OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|OPENCLAW_GATEWAY_TOKEN|FS_BRIDGE_TOKEN)\s*=\s*[^\s"']+/gi,
      "$1=[REDACTED]",
    )
    .replace(/(--token\s+)([^\s]+)/gi, "$1[REDACTED]");
}

function clipped(text: string, max = 600): string {
  if (text.length <= max) return text;
  return text.slice(-max);
}

function getRoute(workspaceId: string): RouteRow | null {
  const row = db
    .prepare("SELECT * FROM workspace_routes WHERE workspace_id = ?")
    .get(workspaceId) as RouteRow | undefined;
  return row ?? null;
}

function upsertRoute(input: {
  workspaceId: string;
  upstreamHost: string;
  upstreamPort: number;
  region: string;
  status: "pending" | "ready" | "failed";
  lastVerifiedAt: number | null;
}): RouteRow {
  const existing = getRoute(input.workspaceId);
  const routeVersion = existing ? existing.route_version + 1 : 1;
  const now = Date.now();
  db.prepare(
    `INSERT INTO workspace_routes (
      workspace_id, upstream_host, upstream_port, region, status, last_verified_at, updated_at, route_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(workspace_id) DO UPDATE SET
      upstream_host=excluded.upstream_host,
      upstream_port=excluded.upstream_port,
      region=excluded.region,
      status=excluded.status,
      last_verified_at=excluded.last_verified_at,
      updated_at=excluded.updated_at,
      route_version=excluded.route_version`,
  ).run(
    input.workspaceId,
    input.upstreamHost,
    input.upstreamPort,
    input.region,
    input.status,
    input.lastVerifiedAt,
    now,
    routeVersion,
  );

  return getRoute(input.workspaceId)!;
}

function deleteRoute(workspaceId: string) {
  const result = db
    .prepare("DELETE FROM workspace_routes WHERE workspace_id = ?")
    .run(workspaceId);
  return result.changes > 0;
}

async function checkTcpReachable(host: string, port: number, timeoutMs: number) {
  return await new Promise<boolean>((resolve) => {
    const socket = net.connect({ host, port });
    let settled = false;

    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };

    const timer = setTimeout(() => done(false), timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timer);
      done(true);
    });
    socket.once("error", () => {
      clearTimeout(timer);
      done(false);
    });
  });
}

async function waitForTcpReachable(args: {
  host: string;
  port: number;
  timeoutMs: number;
  pollIntervalMs?: number;
}) {
  const startedAt = Date.now();
  const pollIntervalMs = args.pollIntervalMs ?? 2500;
  while (Date.now() - startedAt < args.timeoutMs) {
    const ok = await checkTcpReachable(args.host, args.port, 2500);
    if (ok) return true;
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  return false;
}

async function runSshCommand(
  host: string,
  username: string,
  privateKey: string,
  command: string,
  logContext?: Record<string, unknown>,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return await new Promise((resolve, reject) => {
    const conn = new SshClient();
    let stdout = "";
    let stderr = "";
    let lastProgressLogAt = 0;

    const maybeLogProgress = (stream: "stdout" | "stderr", chunk: string) => {
      if (!VERBOSE_LOGS) return;
      const now = Date.now();
      if (now - lastProgressLogAt < 1000) return;
      lastProgressLogAt = now;
      log("ssh_stream_chunk", {
        ...logContext,
        host,
        stream,
        bytes: chunk.length,
        tail: clipped(redactSensitive(chunk), 240),
      });
    };

    const timeout = setTimeout(() => {
      conn.end();
      reject(new Error(`SSH command timeout after ${BOOTSTRAP_TIMEOUT_MS}ms`));
    }, BOOTSTRAP_TIMEOUT_MS);

    conn
      .on("ready", () => {
        conn.exec(command, (err: Error | undefined, stream: ClientChannel) => {
          if (err) {
            clearTimeout(timeout);
            conn.end();
            reject(err);
            return;
          }
          stream.on("close", (code: number | null) => {
            clearTimeout(timeout);
            conn.end();
            if (VERBOSE_LOGS) {
              log("ssh_command_finished", {
                ...logContext,
                host,
                exitCode: code ?? 1,
                stdoutBytes: stdout.length,
                stderrBytes: stderr.length,
                stdoutTail: clipped(redactSensitive(stdout), 1200),
                stderrTail: clipped(redactSensitive(stderr), 1200),
              });
            }
            resolve({ code: code ?? 1, stdout, stderr });
          });
          stream.on("data", (d: Buffer) => {
            const chunk = d.toString("utf8");
            stdout += chunk;
            maybeLogProgress("stdout", chunk);
          });
          stream.stderr.on("data", (d: Buffer) => {
            const chunk = d.toString("utf8");
            stderr += chunk;
            maybeLogProgress("stderr", chunk);
          });
        });
      })
      .on("error", (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      })
      .connect({
        host,
        username,
        privateKey,
        readyTimeout: SSH_CONNECT_TIMEOUT_MS,
      });
  });
}

function defaultBootstrapScript(port: number) {
  return `set -euo pipefail
if ! command -v curl >/dev/null 2>&1; then
  apt-get update -y && apt-get install -y curl ca-certificates
fi
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
mkdir -p /opt/openclaw-managed
cat > /opt/openclaw-managed/server.js <<'JS'
import http from 'node:http';
const port = ${port};
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, {'content-type': 'application/json'});
    res.end(JSON.stringify({ok:true}));
    return;
  }
  res.writeHead(404); res.end('not found');
});
server.listen(port, '0.0.0.0');
JS
cat > /etc/systemd/system/openclaw-managed.service <<'UNIT'
[Unit]
Description=OpenClaw Managed Placeholder
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/openclaw-managed
ExecStart=/usr/bin/node /opt/openclaw-managed/server.js
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now openclaw-managed.service
systemctl is-active --quiet openclaw-managed.service
`;
}

function renderBootstrapScript(
  template: string,
  values: Record<string, string>,
): string {
  let out = template;
  for (const [key, value] of Object.entries(values)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }
  return out;
}

function providerEnvKey(provider: ManagedProvider): string {
  if (provider === "openai") return "OPENAI_API_KEY";
  if (provider === "anthropic") return "ANTHROPIC_API_KEY";
  return "GEMINI_API_KEY";
}

function boolFromText(value: string | undefined): boolean {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function parseResultJsonFromStdout(stdout: string): Record<string, unknown> | null {
  const marker = "__RESULT__";
  const idx = stdout.lastIndexOf(marker);
  if (idx < 0) return null;
  const raw = stdout.slice(idx + marker.length).trim();
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function buildProviderApplyScript(input: {
  provider: ManagedProvider;
  apiKey: string;
  defaultModel: string;
  targetPort: number;
  controlUiAllowedOrigins: string[];
}) {
  const apiKeyB64 = Buffer.from(input.apiKey, "utf8").toString("base64");
  const providerEnv = providerEnvKey(input.provider);
  const allowedOriginsJson = JSON.stringify(input.controlUiAllowedOrigins);
  const modelRef = input.defaultModel.includes("/")
    ? input.defaultModel
    : `${input.provider}/${input.defaultModel}`;
  return `set -euo pipefail
PROVIDER="${input.provider}"
PROVIDER_ENV_KEY="${providerEnv}"
DEFAULT_MODEL="${input.defaultModel}"
MODEL_REF="${modelRef}"
TARGET_PORT="${input.targetPort}"
API_KEY="$(printf '%s' '${apiKeyB64}' | base64 -d)"
CONFIG_PATH_PRIMARY="/root/.openclaw/openclaw.json"
CONFIG_PATH_FALLBACK="/var/lib/openclaw/openclaw.json"
if [ -f "$CONFIG_PATH_PRIMARY" ]; then
  CONFIG_PATH="$CONFIG_PATH_PRIMARY"
else
  CONFIG_PATH="$CONFIG_PATH_FALLBACK"
fi
PROVIDERS_ENV="/etc/openclaw/providers.env"

mkdir -p /etc/openclaw
touch "$PROVIDERS_ENV"
chmod 0600 "$PROVIDERS_ENV"
grep -vE '^(OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY)=' "$PROVIDERS_ENV" > "$PROVIDERS_ENV.tmp" || true
mv "$PROVIDERS_ENV.tmp" "$PROVIDERS_ENV"
printf '%s=%s\\n' "$PROVIDER_ENV_KEY" "$API_KEY" >> "$PROVIDERS_ENV"
unset API_KEY

# Apply core defaults via CLI when available, keep JSON patch below as fallback.
if command -v openclaw >/dev/null 2>&1; then
  HOME="/root" openclaw config set gateway.mode local || true
  HOME="/root" openclaw config set gateway.port "${input.targetPort}" || true
  HOME="/root" openclaw config set gateway.bind lan || true
  HOME="/root" openclaw config set agents.defaults.model "$MODEL_REF" || true
fi

CONFIG_PATH="$CONFIG_PATH" node <<'NODE'
const fs = require("node:fs");
const path = process.env.CONFIG_PATH || "/root/.openclaw/openclaw.json";
let cfg = {};
try {
  cfg = JSON.parse(fs.readFileSync(path, "utf8"));
} catch {
  cfg = {};
}
cfg.gateway = cfg.gateway || {};
cfg.gateway.mode = cfg.gateway.mode || "local";
cfg.gateway.port = Number("${input.targetPort}");
cfg.gateway.bind = cfg.gateway.bind || "lan";
cfg.gateway.controlUi = cfg.gateway.controlUi || {};
cfg.gateway.controlUi.allowedOrigins = ${allowedOriginsJson};
cfg.agents = cfg.agents || {};
cfg.agents.defaults = cfg.agents.defaults || {};
cfg.agents.defaults.model = "${modelRef}";
fs.writeFileSync(path, JSON.stringify(cfg, null, 2), "utf8");
NODE

systemctl daemon-reload
systemctl restart openclaw-gateway.service
SERVICE_RESTARTED=false
if systemctl is-active --quiet openclaw-gateway.service; then
  SERVICE_RESTARTED=true
fi
PORT_LISTENING=false
for _ in $(seq 1 ${Math.max(5, Math.floor(PROVIDER_PORT_WAIT_SECONDS))}); do
  if ss -ltn | grep -Eq ":${input.targetPort}\\\\b"; then
    PORT_LISTENING=true
    break
  fi
  sleep 2
done
SERVICE_RESTARTED="$SERVICE_RESTARTED" PORT_LISTENING="$PORT_LISTENING" CONFIG_PATH="$CONFIG_PATH" node <<'NODE'
const fs = require("node:fs");
const cfg = JSON.parse(
  fs.readFileSync(process.env.CONFIG_PATH || "/root/.openclaw/openclaw.json", "utf8"),
);
const model = (((cfg || {}).agents || {}).defaults || {}).model || {};
const primary =
  typeof model === "string"
    ? model
    : typeof model.primary === "string"
      ? model.primary
      : "";
const providersEnv = fs.readFileSync("/etc/openclaw/providers.env", "utf8");
const checks = {
  appliedToManagedHost: providersEnv.includes("${providerEnv}="),
  serviceRestarted: process.env.SERVICE_RESTARTED === "true",
  portListening: process.env.PORT_LISTENING === "true",
  modelRuntimeReady: primary === "${modelRef}"
};
process.stdout.write("__RESULT__" + JSON.stringify({checks}));
NODE`;
}

function buildProviderVerifyScript(input: {
  provider: ManagedProvider;
  defaultModel: string;
  targetPort: number;
}) {
  const providerEnv = providerEnvKey(input.provider);
  const modelRef = input.defaultModel.includes("/")
    ? input.defaultModel
    : `${input.provider}/${input.defaultModel}`;
  return `set -euo pipefail
CONFIG_PATH_PRIMARY="/root/.openclaw/openclaw.json"
CONFIG_PATH_FALLBACK="/var/lib/openclaw/openclaw.json"
if [ -f "$CONFIG_PATH_PRIMARY" ]; then
  CONFIG_PATH="$CONFIG_PATH_PRIMARY"
else
  CONFIG_PATH="$CONFIG_PATH_FALLBACK"
fi
SERVICE_RESTARTED=false
if systemctl is-active --quiet openclaw-gateway.service; then
  SERVICE_RESTARTED=true
fi
PORT_LISTENING=false
if ss -ltn | grep -Eq ":${input.targetPort}\\\\b"; then
  PORT_LISTENING=true
fi
SERVICE_RESTARTED="$SERVICE_RESTARTED" PORT_LISTENING="$PORT_LISTENING" CONFIG_PATH="$CONFIG_PATH" node <<'NODE'
const fs = require("node:fs");
let cfg = {};
try {
  cfg = JSON.parse(
    fs.readFileSync(process.env.CONFIG_PATH || "/root/.openclaw/openclaw.json", "utf8"),
  );
} catch {
  cfg = {};
}
let providersEnv = "";
try {
  providersEnv = fs.readFileSync("/etc/openclaw/providers.env", "utf8");
} catch {
  providersEnv = "";
}
const model = (((cfg || {}).agents || {}).defaults || {}).model || {};
const primary =
  typeof model === "string"
    ? model
    : typeof model.primary === "string"
      ? model.primary
      : "";
const checks = {
  appliedToManagedHost: providersEnv.includes("${providerEnv}="),
  serviceRestarted: process.env.SERVICE_RESTARTED === "true",
  portListening: process.env.PORT_LISTENING === "true",
  modelRuntimeReady: primary === "${modelRef}"
};
process.stdout.write("__RESULT__" + JSON.stringify({checks}));
NODE`;
}

app.get("/control/health", (_req, res) => {
  res.json({ ok: true, service: "managed-gateway", wsPathPrefix: WORKSPACE_WS_PATH_PREFIX });
});

app.post("/control/bootstrap", requireAuth, async (req, res) => {
  const body = req.body as BootstrapBody;
  if (!body?.workspaceId || !body?.host || !body?.instanceId) {
    res.status(400).json({ error: "workspaceId, host, instanceId are required." });
    return;
  }

  const username = (body.bootstrapUser || "root").trim();
  const privateKey = (body.sshPrivateKey || "").trim();
  const openclawGatewayToken = (body.openclawGatewayToken || "").trim();
  const filesBridgeToken = (body.filesBridgeToken || "").trim();
  if (!privateKey) {
    res.status(400).json({ error: "sshPrivateKey is required." });
    return;
  }
  if (!openclawGatewayToken) {
    res.status(400).json({ error: "openclawGatewayToken is required." });
    return;
  }
  if (!filesBridgeToken) {
    res.status(400).json({ error: "filesBridgeToken is required." });
    return;
  }

  const targetPort = Number(process.env.MANAGED_UPSTREAM_WS_PORT ?? "18789");
  const filesBridgePort = Number(body.filesBridgePort ?? process.env.MANAGED_FILES_BRIDGE_PORT ?? "8787");
  const filesBridgeRootPath = (body.filesBridgeRootPath || process.env.MANAGED_FILES_BRIDGE_ROOT_PATH || "/root/.openclaw").trim();
  const inlineScript = (process.env.MANAGED_BOOTSTRAP_SCRIPT ?? "").trim();
  const scriptFile = (process.env.MANAGED_BOOTSTRAP_SCRIPT_FILE ?? "").trim();
  let fileScript = "";
  if (scriptFile.length > 0) {
    try {
      fileScript = readFileSync(scriptFile, "utf8").trim();
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          error instanceof Error
            ? `Failed to read MANAGED_BOOTSTRAP_SCRIPT_FILE: ${error.message}`
            : "Failed to read MANAGED_BOOTSTRAP_SCRIPT_FILE",
      });
      return;
    }
  }
  const customScript = inlineScript || fileScript;
  if (!customScript && REQUIRE_CUSTOM_BOOTSTRAP_SCRIPT) {
    res.status(500).json({
      ok: false,
      error:
        "MANAGED_BOOTSTRAP_SCRIPT is required for real OpenClaw mode. Set a hardened install/start script template in gateway env.",
    });
    return;
  }
  const scriptTemplate = customScript || defaultBootstrapScript(targetPort);
  const script = renderBootstrapScript(scriptTemplate, {
    WORKSPACE_ID: body.workspaceId,
    JOB_ID: body.jobId,
    INSTANCE_ID: body.instanceId,
    HOST: body.host,
    REGION: body.region,
    UPSTREAM_PORT: String(targetPort),
    OPENCLAW_GATEWAY_TOKEN: openclawGatewayToken,
    FILES_BRIDGE_TOKEN: filesBridgeToken,
    FILES_BRIDGE_PORT: String(filesBridgePort),
    FILES_BRIDGE_ROOT_PATH: filesBridgeRootPath,
    CONTROL_UI_ALLOWED_ORIGINS_JSON: JSON.stringify(
      Array.isArray(body.controlUiAllowedOrigins)
        ? body.controlUiAllowedOrigins.filter((v) => typeof v === "string" && v.trim().length > 0)
        : [],
    ),
  });

  try {
    log("bootstrap_started", {
      workspaceId: body.workspaceId,
      jobId: body.jobId,
      host: body.host,
      upstreamPort: targetPort,
      filesBridgePort,
      scriptSource: inlineScript ? "env_inline" : scriptFile ? "file" : "default",
    });

    log("bootstrap_waiting_for_ssh", {
      workspaceId: body.workspaceId,
      jobId: body.jobId,
      host: body.host,
      timeoutMs: SSH_READY_TIMEOUT_MS,
    });
    const sshReady = await waitForTcpReachable({
      host: body.host,
      port: 22,
      timeoutMs: SSH_READY_TIMEOUT_MS,
      pollIntervalMs: 3000,
    });
    if (!sshReady) {
      res.status(502).json({
        ok: false,
        error: `SSH is not reachable yet on ${body.host}:22`,
      });
      return;
    }
    log("bootstrap_ssh_ready", {
      workspaceId: body.workspaceId,
      jobId: body.jobId,
      host: body.host,
    });

    log("bootstrap_running_remote_script", {
      workspaceId: body.workspaceId,
      jobId: body.jobId,
      host: body.host,
    });
    const result = await runSshCommand(body.host, username, privateKey, script, {
      operation: "bootstrap",
      workspaceId: body.workspaceId,
      jobId: body.jobId,
    });
    log("bootstrap_remote_script_finished", {
      workspaceId: body.workspaceId,
      jobId: body.jobId,
      host: body.host,
      exitCode: result.code,
      stderrTail: result.stderr.slice(-300),
    });
    if (result.code !== 0) {
      res.status(500).json({
        ok: false,
        error: "Bootstrap script failed.",
        code: result.code,
        stderr: result.stderr.slice(-6000),
      });
      return;
    }

    const reachable = await checkTcpReachable(body.host, targetPort, VERIFY_TIMEOUT_MS);
    if (!reachable) {
      res.status(502).json({
        ok: false,
        error: `Bootstrap completed but upstream port ${targetPort} is unreachable.`,
      });
      return;
    }

    log("bootstrap_completed", {
      workspaceId: body.workspaceId,
      jobId: body.jobId,
      host: body.host,
      upstreamPort: targetPort,
    });

    res.json({
      ok: true,
      status: "ready",
      upstreamHost: body.host,
      upstreamPort: targetPort,
      metadata: {
        stdoutTail: result.stdout.slice(-800),
      },
    });
  } catch (error) {
    log("bootstrap_failed", {
      workspaceId: body.workspaceId,
      jobId: body.jobId,
      host: body.host,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/control/openclaw/provider/apply", requireAuth, async (req, res) => {
  const body = req.body as ApplyProviderBody;
  if (!body?.workspaceId || !body?.host || !body?.provider || !body?.defaultModel) {
    res.status(400).json({
      error: "workspaceId, host, provider, defaultModel are required.",
    });
    return;
  }
  if (!["openai", "anthropic", "gemini"].includes(body.provider)) {
    res.status(400).json({ error: "Unsupported provider." });
    return;
  }
  const privateKey = (body.sshPrivateKey || "").trim();
  if (!privateKey) {
    res.status(400).json({ error: "sshPrivateKey is required." });
    return;
  }
  const apiKey = (body.apiKey || "").trim();
  if (!apiKey) {
    res.status(400).json({ error: "apiKey is required." });
    return;
  }

  const username = (body.bootstrapUser || "root").trim();
  const targetPort = Number(process.env.MANAGED_UPSTREAM_WS_PORT ?? "18789");
  const script = buildProviderApplyScript({
    provider: body.provider,
    apiKey,
    defaultModel: body.defaultModel.trim(),
    targetPort,
    controlUiAllowedOrigins: Array.isArray(body.controlUiAllowedOrigins)
      ? body.controlUiAllowedOrigins.filter((v) => typeof v === "string" && v.trim().length > 0)
      : [],
  });

  try {
    log("provider_apply_waiting_for_ssh", {
      workspaceId: body.workspaceId,
      jobId: body.jobId,
      host: body.host,
      timeoutMs: SSH_READY_TIMEOUT_MS,
    });
    const sshReady = await waitForTcpReachable({
      host: body.host,
      port: 22,
      timeoutMs: SSH_READY_TIMEOUT_MS,
      pollIntervalMs: 3000,
    });
    if (!sshReady) {
      res.status(502).json({
        ok: false,
        error: `SSH is not reachable yet on ${body.host}:22`,
      });
      return;
    }
    log("provider_apply_ssh_ready", {
      workspaceId: body.workspaceId,
      jobId: body.jobId,
      host: body.host,
    });
    const result = await runSshCommand(body.host, username, privateKey, script, {
      operation: "provider_apply",
      workspaceId: body.workspaceId,
      jobId: body.jobId,
    });
    if (result.code !== 0) {
      res.status(500).json({
        ok: false,
        error: "Managed provider apply script failed.",
        code: result.code,
        stderr: result.stderr.slice(-6000),
      });
      return;
    }
    const parsed = parseResultJsonFromStdout(result.stdout);
    const checks = (parsed?.checks as Record<string, unknown> | undefined) ?? {
      appliedToManagedHost: false,
      serviceRestarted: false,
      portListening: false,
      modelRuntimeReady: false,
    };
    const ok =
      boolFromText(String(checks.appliedToManagedHost)) &&
      boolFromText(String(checks.serviceRestarted)) &&
      boolFromText(String(checks.portListening)) &&
      boolFromText(String(checks.modelRuntimeReady));
    if (!ok) {
      res.status(500).json({
        ok: false,
        checks,
        error: "Managed provider apply checks failed.",
      });
      return;
    }
    res.json({ ok: true, checks });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/control/openclaw/provider/verify", requireAuth, async (req, res) => {
  const body = req.body as VerifyProviderBody;
  const workspaceId = String(body.workspaceId ?? "").trim();
  const host = String(body.host ?? "").trim();
  const provider = String(body.provider ?? "").trim() as ManagedProvider;
  const defaultModel = String(body.defaultModel ?? "").trim();
  if (!workspaceId || !host || !provider || !defaultModel) {
    res.status(400).json({
      error: "workspaceId, host, provider, defaultModel are required.",
    });
    return;
  }
  if (!["openai", "anthropic", "gemini"].includes(provider)) {
    res.status(400).json({ error: "Unsupported provider." });
    return;
  }
  const privateKey = (body.sshPrivateKey ?? "").trim();
  if (!privateKey) {
    res.status(400).json({ error: "sshPrivateKey is required." });
    return;
  }
  const username = (body.bootstrapUser || "root").trim();
  const targetPort = Number(process.env.MANAGED_UPSTREAM_WS_PORT ?? "18789");
  const script = buildProviderVerifyScript({
    provider,
    defaultModel,
    targetPort,
  });
  try {
    const result = await runSshCommand(host, username, privateKey, script, {
      operation: "provider_verify",
      workspaceId,
      provider,
    });
    if (result.code !== 0) {
      res.status(500).json({
        ok: false,
        error: "Managed provider verify script failed.",
        code: result.code,
        stderr: result.stderr.slice(-6000),
      });
      return;
    }
    const parsed = parseResultJsonFromStdout(result.stdout);
    const checks = (parsed?.checks as Record<string, unknown> | undefined) ?? {
      appliedToManagedHost: false,
      serviceRestarted: false,
      portListening: false,
      modelRuntimeReady: false,
    };
    const ok =
      boolFromText(String(checks.appliedToManagedHost)) &&
      boolFromText(String(checks.serviceRestarted)) &&
      boolFromText(String(checks.portListening)) &&
      boolFromText(String(checks.modelRuntimeReady));
    res.status(ok ? 200 : 422).json({
      ok,
      checks,
      error: ok ? undefined : "Managed provider runtime checks failed.",
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/control/routes", requireAuth, async (req, res) => {
  const body = req.body as UpsertRouteBody;
  if (!body?.workspaceId || !body?.upstreamHost || !body?.region) {
    res.status(400).json({ error: "workspaceId, upstreamHost, region are required." });
    return;
  }
  const upstreamPort =
    typeof body.upstreamPort === "number" && Number.isFinite(body.upstreamPort)
      ? body.upstreamPort
      : UPSTREAM_WS_PORT_DEFAULT;

  const reachable = await checkTcpReachable(body.upstreamHost, upstreamPort, VERIFY_TIMEOUT_MS);
  const row = upsertRoute({
    workspaceId: body.workspaceId,
    upstreamHost: body.upstreamHost,
    upstreamPort,
    region: body.region,
    status: reachable ? "ready" : "pending",
    lastVerifiedAt: reachable ? Date.now() : null,
  });

  log("route_upsert", {
    workspaceId: body.workspaceId,
    upstreamHost: row.upstream_host,
    upstreamPort: row.upstream_port,
    routeVersion: row.route_version,
    reachable,
  });

  res.json({
    ok: true,
    status: row.status,
    workspaceId: row.workspace_id,
    upstreamHost: row.upstream_host,
    upstreamPort: row.upstream_port,
    routeVersion: row.route_version,
  });
});

app.post("/control/routes/delete", requireAuth, (req, res) => {
  const workspaceId = String(req.body?.workspaceId ?? "").trim();
  if (!workspaceId) {
    res.status(400).json({ error: "workspaceId is required." });
    return;
  }
  const deleted = deleteRoute(workspaceId);
  log("route_delete", { workspaceId, deleted });
  res.json({ ok: true, deleted });
});

app.get("/control/routes/verify", requireAuth, async (req, res) => {
  const workspaceId = String(req.query.workspaceId ?? "").trim();
  if (!workspaceId) {
    res.status(400).json({ error: "workspaceId query param is required." });
    return;
  }

  const row = getRoute(workspaceId);
  if (!row) {
    res.status(404).json({
      ok: false,
      checks: { routeExists: false, upstreamReachable: false },
      error: "Route not found",
    });
    return;
  }

  const reachable = await checkTcpReachable(
    row.upstream_host,
    row.upstream_port,
    VERIFY_TIMEOUT_MS,
  );

  const nextStatus: RouteRow["status"] = reachable ? "ready" : "failed";
  const updated = upsertRoute({
    workspaceId: row.workspace_id,
    upstreamHost: row.upstream_host,
    upstreamPort: row.upstream_port,
    region: row.region,
    status: nextStatus,
    lastVerifiedAt: reachable ? Date.now() : row.last_verified_at,
  });

  res.json({
    ok: reachable,
    checks: {
      routeExists: true,
      upstreamReachable: reachable,
      workspaceId,
      upstreamHost: updated.upstream_host,
      upstreamPort: updated.upstream_port,
      routeVersion: updated.route_version,
    },
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", async (req, socket, head) => {
  try {
    const host = req.headers.host || `127.0.0.1:${PORT}`;
    const url = new URL(req.url || "/", `http://${host}`);
    const prefix = WORKSPACE_WS_PATH_PREFIX.endsWith("/")
      ? WORKSPACE_WS_PATH_PREFIX.slice(0, -1)
      : WORKSPACE_WS_PATH_PREFIX;
    const match = new RegExp(`^${prefix}/([^/]+)$`).exec(url.pathname);
    if (!match) {
      socket.write("HTTP/1.1 404 Not Found\\r\\n\\r\\n");
      socket.destroy();
      return;
    }

    const workspaceId = decodeURIComponent(match[1]!);
    const route = getRoute(workspaceId);
    if (!route || route.status === "failed") {
      socket.write("HTTP/1.1 503 Service Unavailable\\r\\n\\r\\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (clientSocket) => {
      wss.emit("connection", clientSocket, req, route);
    });
  } catch {
    socket.write("HTTP/1.1 500 Internal Server Error\\r\\n\\r\\n");
    socket.destroy();
  }
});

wss.on(
  "connection",
  (clientSocket: WebSocket, _req: IncomingMessage, route: RouteRow) => {
  const upstreamUrl = `${UPSTREAM_WS_SCHEME}://${route.upstream_host}:${route.upstream_port}${UPSTREAM_WS_PATH}`;
  const upstream = new WebSocket(upstreamUrl);

  const closeBoth = (code = 1011, reason = "proxy_error") => {
    if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
      upstream.close(code, reason);
    }
    if (clientSocket.readyState === WebSocket.OPEN || clientSocket.readyState === WebSocket.CONNECTING) {
      clientSocket.close(code, reason);
    }
  };

  upstream.on("open", () => {
    log("ws_proxy_open", {
      workspaceId: route.workspace_id,
      upstream: upstreamUrl,
    });
  });

  upstream.on("message", (data: RawData, isBinary: boolean) => {
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(data, { binary: isBinary });
    }
  });

  clientSocket.on("message", (data: RawData, isBinary: boolean) => {
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.send(data, { binary: isBinary });
    }
  });

  upstream.on("close", (code: number, reason: Buffer) => {
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.close(code, reason.toString());
    }
  });

  clientSocket.on("close", (code: number, reason: Buffer) => {
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.close(code, reason.toString());
    }
  });

  upstream.on("error", () => closeBoth(1011, "upstream_error"));
  clientSocket.on("error", () => closeBoth(1011, "client_error"));
  },
);

server.listen(PORT, () => {
  log("service_started", {
    port: PORT,
    dbFile,
    wsPathPrefix: WORKSPACE_WS_PATH_PREFIX,
  });
});
