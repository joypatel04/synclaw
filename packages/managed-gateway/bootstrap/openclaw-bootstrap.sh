#!/usr/bin/env bash
set -euo pipefail

# Managed OpenClaw bootstrap script (idempotent).
# Rendered by managed-gateway /control/bootstrap with placeholders:
# {{WORKSPACE_ID}} {{JOB_ID}} {{INSTANCE_ID}} {{HOST}} {{REGION}}
# {{UPSTREAM_PORT}} {{OPENCLAW_GATEWAY_TOKEN}} {{FILES_BRIDGE_TOKEN}}
# {{FILES_BRIDGE_PORT}} {{FILES_BRIDGE_ROOT_PATH}}

WORKSPACE_ID="{{WORKSPACE_ID}}"
JOB_ID="{{JOB_ID}}"
INSTANCE_ID="{{INSTANCE_ID}}"
REGION="{{REGION}}"
OPENCLAW_PORT="{{UPSTREAM_PORT}}"
OPENCLAW_TOKEN="{{OPENCLAW_GATEWAY_TOKEN}}"
FILES_BRIDGE_TOKEN="{{FILES_BRIDGE_TOKEN}}"
FILES_BRIDGE_PORT="{{FILES_BRIDGE_PORT}}"
FILES_BRIDGE_ROOT_PATH="{{FILES_BRIDGE_ROOT_PATH}}"
CONTROL_UI_ALLOWED_ORIGINS_JSON='{{CONTROL_UI_ALLOWED_ORIGINS_JSON}}'
OPENCLAW_USER="openclaw"
OPENCLAW_GROUP="openclaw"
OPENCLAW_STATE_DIR="/var/lib/openclaw"
OPENCLAW_HOME_DIR="/root"
OPENCLAW_ETC_DIR="/etc/openclaw"
OPENCLAW_ENV_FILE="${OPENCLAW_ETC_DIR}/managed.env"
OPENCLAW_PROVIDERS_ENV_FILE="${OPENCLAW_ETC_DIR}/providers.env"
OPENCLAW_GATEWAY_UNIT="openclaw-gateway.service"
FS_BRIDGE_UNIT="synclaw-fs-bridge.service"
OPENCLAW_CONFIG_DIR="${OPENCLAW_HOME_DIR}/.openclaw"
OPENCLAW_CONFIG_PATH="${OPENCLAW_CONFIG_DIR}/openclaw.json"
FS_BRIDGE_DIR="/opt/synclaw/fs-bridge"
FS_BRIDGE_SCRIPT_PATH="${FS_BRIDGE_DIR}/server.js"

if [[ -z "${OPENCLAW_TOKEN}" ]]; then
  echo "OPENCLAW gateway token is empty; refusing bootstrap." >&2
  exit 1
fi

if [[ -z "${OPENCLAW_PORT}" ]]; then
  echo "OPENCLAW gateway port is empty; refusing bootstrap." >&2
  exit 1
fi

if [[ -z "${FILES_BRIDGE_TOKEN}" ]]; then
  echo "FS bridge token is empty; refusing bootstrap." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y --no-install-recommends ca-certificates curl gnupg lsb-release

# Node 22+ is required by OpenClaw docs.
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/^v//;s/\..*$//')" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

# Install or update OpenClaw CLI.
npm install -g openclaw@latest

# System user/group for least-privilege runtime.
if ! getent group "${OPENCLAW_GROUP}" >/dev/null 2>&1; then
  groupadd --system "${OPENCLAW_GROUP}"
fi
if ! id -u "${OPENCLAW_USER}" >/dev/null 2>&1; then
  useradd --system --gid "${OPENCLAW_GROUP}" --home "${OPENCLAW_STATE_DIR}" --shell /bin/bash "${OPENCLAW_USER}"
fi

install -d -m 0750 -o "${OPENCLAW_USER}" -g "${OPENCLAW_GROUP}" "${OPENCLAW_STATE_DIR}"
install -d -m 0750 -o root -g "${OPENCLAW_GROUP}" "${OPENCLAW_ETC_DIR}"
install -d -m 0700 -o root -g root "${OPENCLAW_CONFIG_DIR}"
install -d -m 0755 -o root -g root /var/tmp/openclaw-compile-cache
install -d -m 0755 -o root -g root "${FS_BRIDGE_DIR}"
install -d -m 0755 -o root -g root "${FILES_BRIDGE_ROOT_PATH}"

cat > "${OPENCLAW_ENV_FILE}" <<EOF
OPENCLAW_GATEWAY_PORT=${OPENCLAW_PORT}
OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_TOKEN}
OPENCLAW_GATEWAY_BIND=lan
OPENCLAW_STATE_DIR=${OPENCLAW_STATE_DIR}
OPENCLAW_WORKSPACE_ID=${WORKSPACE_ID}
OPENCLAW_MANAGED_REGION=${REGION}
OPENCLAW_MANAGED_INSTANCE_ID=${INSTANCE_ID}
FS_BRIDGE_TOKEN=${FILES_BRIDGE_TOKEN}
FS_BRIDGE_PORT=${FILES_BRIDGE_PORT}
FS_BRIDGE_ROOT_PATH=${FILES_BRIDGE_ROOT_PATH}
EOF
chmod 0640 "${OPENCLAW_ENV_FILE}"
chown root:"${OPENCLAW_GROUP}" "${OPENCLAW_ENV_FILE}"
touch "${OPENCLAW_PROVIDERS_ENV_FILE}"
chmod 0600 "${OPENCLAW_PROVIDERS_ENV_FILE}"
chown root:root "${OPENCLAW_PROVIDERS_ENV_FILE}"

OPENCLAW_BIN="$(command -v openclaw)"
if [[ -z "${OPENCLAW_BIN}" ]]; then
  echo "openclaw binary not found after installation." >&2
  exit 1
fi

# Ensure OpenClaw runtime config exists in the default root profile.
HOME="${OPENCLAW_HOME_DIR}" "${OPENCLAW_BIN}" gateway run --help >/dev/null 2>&1

# Pre-create session store dirs so doctor/setup checks don't block on prompts.
install -d -m 0700 -o root -g root "${OPENCLAW_HOME_DIR}/.openclaw/agents/main/sessions"

# Configure core gateway settings via OpenClaw CLI (stable contract).
HOME="${OPENCLAW_HOME_DIR}" "${OPENCLAW_BIN}" config set gateway.mode local
HOME="${OPENCLAW_HOME_DIR}" "${OPENCLAW_BIN}" config set gateway.port "${OPENCLAW_PORT}"
HOME="${OPENCLAW_HOME_DIR}" "${OPENCLAW_BIN}" config set gateway.bind lan
HOME="${OPENCLAW_HOME_DIR}" "${OPENCLAW_BIN}" config set gateway.auth.mode token
HOME="${OPENCLAW_HOME_DIR}" "${OPENCLAW_BIN}" config set gateway.auth.token "${OPENCLAW_TOKEN}"
HOME="${OPENCLAW_HOME_DIR}" "${OPENCLAW_BIN}" config set gateway.auth.rateLimit.maxAttempts 10
HOME="${OPENCLAW_HOME_DIR}" "${OPENCLAW_BIN}" config set gateway.auth.rateLimit.windowMs 60000
HOME="${OPENCLAW_HOME_DIR}" "${OPENCLAW_BIN}" config set gateway.auth.rateLimit.lockoutMs 300000

# Ensure managed defaults and control UI origins are set in config.
HOME="${OPENCLAW_HOME_DIR}" node <<NODE
const fs = require("node:fs");
const path = "${OPENCLAW_CONFIG_PATH}";
let cfg = {};
try {
  cfg = JSON.parse(fs.readFileSync(path, "utf8"));
} catch {
  cfg = {};
}
cfg.gateway = cfg.gateway || {};
cfg.gateway.controlUi = cfg.gateway.controlUi || {};
cfg.gateway.controlUi.allowedOrigins = ${CONTROL_UI_ALLOWED_ORIGINS_JSON};
cfg.agents = cfg.agents || {};
cfg.agents.defaults = cfg.agents.defaults || {};
if (typeof cfg.agents.defaults.model === "object" && cfg.agents.defaults.model !== null) {
  if (typeof cfg.agents.defaults.model.primary === "string") {
    cfg.agents.defaults.model = cfg.agents.defaults.model.primary;
  } else {
    delete cfg.agents.defaults.model;
  }
}
fs.mkdirSync("${OPENCLAW_CONFIG_DIR}", { recursive: true });
fs.writeFileSync(path, JSON.stringify(cfg, null, 2), "utf8");
NODE

cat > "${FS_BRIDGE_SCRIPT_PATH}" <<'JS'
#!/usr/bin/env node
const { createServer } = require("node:http");
const { promises: fs } = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const TOKEN = (process.env.FS_BRIDGE_TOKEN || "").trim();
const ROOT_PATH = (process.env.FS_BRIDGE_ROOT_PATH || "/root/.openclaw").trim();
const PORT = Number(process.env.FS_BRIDGE_PORT || "8787");
const MAX_BYTES = Number(process.env.FS_MAX_FILE_BYTES || "1048576");
const WRITE_EXT = [".md",".txt",".json",".yaml",".yml",".toml",".config",".js",".jsx",".mjs",".ts",".tsx"];
const READ_EXT = [...WRITE_EXT, ".pdf"];

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function bearer(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

function normalizeRel(input) {
  const raw = (input || ".").trim();
  const normalized = raw.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.includes("..")) throw new Error("Path traversal is not allowed");
  return normalized || ".";
}

async function resolvePath(relativePath) {
  const rootReal = await fs.realpath(ROOT_PATH);
  const rel = normalizeRel(relativePath);
  const candidate = path.resolve(rootReal, rel === "." ? "" : rel);
  const candidateReal = await fs.realpath(candidate).catch(() => candidate);
  const relative = path.relative(rootReal, candidateReal);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Resolved path escapes workspace root");
  }
  return { rootReal, candidate };
}

function isAllowed(pathValue, allowlist) {
  const lower = pathValue.toLowerCase();
  return allowlist.some((ext) => lower.endsWith(ext));
}

async function bodyJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function hashUtf8(input) {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function toRel(rootReal, absPath) {
  const rel = path.relative(rootReal, absPath).replace(/\\/g, "/");
  return rel.length === 0 ? "." : rel;
}

if (!TOKEN) {
  console.error("FS_BRIDGE_TOKEN is required");
  process.exit(1);
}

const server = createServer(async (req, res) => {
  try {
    if (req.url === "/health") {
      return json(res, 200, { ok: true, service: "synclaw-fs-bridge", rootPath: ROOT_PATH });
    }
    if (bearer(req) !== TOKEN) {
      return json(res, 401, { error: "Unauthorized" });
    }

    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/v1/tree") {
      const queryPath = url.searchParams.get("path") || ".";
      const { rootReal, candidate } = await resolvePath(queryPath);
      const stat = await fs.stat(candidate).catch(() => null);
      if (!stat) return json(res, 404, { error: "Path not found" });
      if (!stat.isDirectory()) return json(res, 422, { error: "Path is not a directory" });
      const entries = await fs.readdir(candidate, { withFileTypes: true });
      const items = await Promise.all(entries.map(async (entry) => {
        const abs = path.join(candidate, entry.name);
        const st = await fs.stat(abs).catch(() => null);
        return {
          name: entry.name,
          path: toRel(rootReal, abs),
          type: entry.isDirectory() ? "directory" : "file",
          size: st ? st.size : null,
          mtimeMs: st ? st.mtimeMs : null,
        };
      }));
      return json(res, 200, { path: toRel(rootReal, candidate), items });
    }

    if (req.method === "GET" && url.pathname === "/v1/file") {
      const queryPath = url.searchParams.get("path");
      if (!queryPath) return json(res, 400, { error: "Missing path query param" });
      if (!isAllowed(queryPath, READ_EXT)) {
        return json(res, 422, { error: `Unsupported file type. Allowed: ${READ_EXT.join(", ")}` });
      }
      const { rootReal, candidate } = await resolvePath(queryPath);
      const st = await fs.stat(candidate).catch(() => null);
      if (!st) return json(res, 404, { error: "File not found" });
      if (!st.isFile()) return json(res, 422, { error: "Path is not a file" });
      if (st.size > MAX_BYTES) return json(res, 413, { error: `File too large. Max ${MAX_BYTES} bytes` });
      if (queryPath.toLowerCase().endsWith(".pdf")) {
        const content = await fs.readFile(candidate);
        const b64 = content.toString("base64");
        return json(res, 200, {
          path: toRel(rootReal, candidate),
          contentBase64: b64,
          encoding: "base64",
          mime: "application/pdf",
          hash: await hashUtf8(b64),
          size: st.size,
          mtimeMs: st.mtimeMs,
        });
      }
      const content = await fs.readFile(candidate, "utf8");
      return json(res, 200, {
        path: toRel(rootReal, candidate),
        content,
        encoding: "utf8",
        mime: "text/plain",
        hash: await hashUtf8(content),
        size: Buffer.byteLength(content, "utf8"),
        mtimeMs: st.mtimeMs,
      });
    }

    if (req.method === "GET" && url.pathname === "/v1/meta") {
      const queryPath = url.searchParams.get("path");
      if (!queryPath) return json(res, 400, { error: "Missing path query param" });
      const { rootReal, candidate } = await resolvePath(queryPath);
      const st = await fs.stat(candidate).catch(() => null);
      if (!st) return json(res, 404, { error: "File not found" });
      if (!st.isFile()) return json(res, 422, { error: "Path is not a file" });
      const content = await fs.readFile(candidate, "utf8");
      return json(res, 200, {
        path: toRel(rootReal, candidate),
        hash: await hashUtf8(content),
        size: st.size,
        mtimeMs: st.mtimeMs,
      });
    }

    if (req.method === "PUT" && url.pathname === "/v1/file") {
      const body = await bodyJson(req);
      const relativePath = typeof body.path === "string" ? body.path : "";
      const content = typeof body.content === "string" ? body.content : "";
      const expectedHash = typeof body.expectedHash === "string" ? body.expectedHash : undefined;
      if (!relativePath) return json(res, 400, { error: "Missing path in body" });
      if (!isAllowed(relativePath, WRITE_EXT)) {
        return json(res, 422, { error: `Unsupported file type for write. Allowed: ${WRITE_EXT.join(", ")}` });
      }
      if (Buffer.byteLength(content, "utf8") > MAX_BYTES) {
        return json(res, 413, { error: `File too large. Max ${MAX_BYTES} bytes` });
      }
      const { rootReal, candidate } = await resolvePath(relativePath);
      const st = await fs.stat(candidate).catch(() => null);
      if (st && !st.isFile()) return json(res, 422, { error: "Path is not a file" });
      if (st) {
        const previous = await fs.readFile(candidate, "utf8");
        const previousHash = await hashUtf8(previous);
        if (expectedHash && previousHash !== expectedHash) {
          return json(res, 409, { error: "File changed remotely. Refresh and retry.", currentHash: previousHash });
        }
      }
      await fs.mkdir(path.dirname(candidate), { recursive: true });
      await fs.writeFile(candidate, content, "utf8");
      const next = await fs.readFile(candidate, "utf8");
      const nextHash = await hashUtf8(next);
      const nextStat = await fs.stat(candidate);
      return json(res, 200, {
        ok: true,
        path: toRel(rootReal, candidate),
        hash: nextHash,
        size: nextStat.size,
        mtimeMs: nextStat.mtimeMs,
      });
    }

    if (req.method === "DELETE" && url.pathname === "/v1/file") {
      const queryPath = url.searchParams.get("path");
      if (!queryPath) return json(res, 400, { error: "Missing path query param" });
      if (!isAllowed(queryPath, READ_EXT)) {
        return json(res, 422, { error: `Unsupported file type. Allowed: ${READ_EXT.join(", ")}` });
      }
      const { rootReal, candidate } = await resolvePath(queryPath);
      const st = await fs.stat(candidate).catch(() => null);
      if (!st) return json(res, 404, { error: "File not found" });
      if (!st.isFile()) return json(res, 422, { error: "Path is not a file" });
      await fs.unlink(candidate);
      return json(res, 200, { ok: true, path: toRel(rootReal, candidate) });
    }

    return json(res, 404, { error: "Not found" });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(JSON.stringify({ event: "fs_bridge_started", port: PORT, rootPath: ROOT_PATH }));
});
JS
chmod 0755 "${FS_BRIDGE_SCRIPT_PATH}"
echo "Filesystem bridge script installed at ${FS_BRIDGE_SCRIPT_PATH}"

# Create a deterministic systemd service for managed mode.
cat > "/etc/systemd/system/${OPENCLAW_GATEWAY_UNIT}" <<EOF
[Unit]
Description=OpenClaw Gateway (managed)
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=0

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=${OPENCLAW_HOME_DIR}
EnvironmentFile=${OPENCLAW_ENV_FILE}
EnvironmentFile=-${OPENCLAW_PROVIDERS_ENV_FILE}
Environment=NODE_COMPILE_CACHE=/var/tmp/openclaw-compile-cache
Environment=OPENCLAW_NO_RESPAWN=1
ExecStart=${OPENCLAW_BIN} gateway run --allow-unconfigured --port \${OPENCLAW_GATEWAY_PORT} --bind \${OPENCLAW_GATEWAY_BIND} --auth token --token \${OPENCLAW_GATEWAY_TOKEN}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

cat > "/etc/systemd/system/${FS_BRIDGE_UNIT}" <<EOF
[Unit]
Description=Synclaw Filesystem Bridge (managed)
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=0

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=${OPENCLAW_HOME_DIR}
EnvironmentFile=${OPENCLAW_ENV_FILE}
ExecStart=/usr/bin/node ${FS_BRIDGE_SCRIPT_PATH}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "${OPENCLAW_GATEWAY_UNIT}"
systemctl enable --now "${FS_BRIDGE_UNIT}"
echo "Services enabled: ${OPENCLAW_GATEWAY_UNIT}, ${FS_BRIDGE_UNIT}"

# Service verification.
systemctl is-active --quiet "${OPENCLAW_GATEWAY_UNIT}"
systemctl is-active --quiet "${FS_BRIDGE_UNIT}"
# Give gateway process time to initialize and bind.
BOUND=0
for _ in $(seq 1 60); do
  if ss -ltn | grep -q ":${OPENCLAW_PORT}\\b"; then
    BOUND=1
    break
  fi
  sleep 2
done

if [[ "${BOUND}" -ne 1 ]]; then
  echo "OpenClaw service started but port ${OPENCLAW_PORT} is not listening." >&2
  systemctl status "${OPENCLAW_GATEWAY_UNIT}" --no-pager >&2 || true
  journalctl -u "${OPENCLAW_GATEWAY_UNIT}" -n 120 --no-pager >&2 || true
  exit 1
fi

FS_BOUND=0
for _ in $(seq 1 30); do
  if ss -ltn | grep -q ":${FILES_BRIDGE_PORT}\\b"; then
    FS_BOUND=1
    break
  fi
  sleep 1
done

if [[ "${FS_BOUND}" -ne 1 ]]; then
  echo "Filesystem bridge service started but port ${FILES_BRIDGE_PORT} is not listening." >&2
  systemctl status "${FS_BRIDGE_UNIT}" --no-pager >&2 || true
  journalctl -u "${FS_BRIDGE_UNIT}" -n 120 --no-pager >&2 || true
  exit 1
fi
echo "Filesystem bridge is listening on port ${FILES_BRIDGE_PORT} (root: ${FILES_BRIDGE_ROOT_PATH})."

echo "OpenClaw managed bootstrap complete for workspace ${WORKSPACE_ID} on port ${OPENCLAW_PORT}."
