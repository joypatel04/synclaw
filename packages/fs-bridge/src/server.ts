import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { URL } from "node:url";

const PORT = Number(process.env.PORT ?? "8787");
const TOKEN = (process.env.FS_BRIDGE_TOKEN ?? "").trim();
const ROOT_PATH = (process.env.WORKSPACE_ROOT_PATH ?? "").trim();
const MAX_FILE_BYTES = Number(process.env.FS_MAX_FILE_BYTES ?? `${1024 * 1024}`);
const ALLOWED_EXTENSIONS = (process.env.FS_ALLOWED_EXTENSIONS ??
  ".md,.txt,.json,.yaml,.yml,.toml,.config")
  .split(",")
  .map((ext) => ext.trim().toLowerCase())
  .filter(Boolean);
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 240;

type Bucket = { start: number; count: number };
const rateBuckets = new Map<string, Bucket>();

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function getBearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

function rateLimitKey(req: IncomingMessage): string {
  return `${req.socket.remoteAddress ?? "unknown"}:${getBearerToken(req) ?? "missing"}`;
}

function isRateLimited(req: IncomingMessage): boolean {
  const key = rateLimitKey(req);
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || now - current.start > RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(key, { start: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT_MAX;
}

function ensureConfigured() {
  if (!TOKEN) throw new Error("FS_BRIDGE_TOKEN is required");
  if (!ROOT_PATH) throw new Error("WORKSPACE_ROOT_PATH is required");
}

async function resolveSafePath(relativePath: string) {
  const rootReal = await fs.realpath(ROOT_PATH);
  const normalized = path.posix.normalize(relativePath.replace(/\\/g, "/")).replace(/^\/+/, "");
  if (normalized.includes("..")) throw new Error("Path traversal is not allowed");
  const candidate = path.resolve(rootReal, normalized || ".");
  const candidateReal = await fs.realpath(candidate).catch(() => candidate);
  const relative = path.relative(rootReal, candidateReal);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Resolved path escapes workspace root");
  }
  return { rootReal, candidate, candidateReal };
}

function isAllowedExtension(filePath: string) {
  const lower = filePath.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

async function sha256(content: string) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function parseJsonBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function toRelative(rootReal: string, absolutePath: string) {
  const rel = path.relative(rootReal, absolutePath).replace(/\\/g, "/");
  return rel.length === 0 ? "." : rel;
}

async function handleTree(req: IncomingMessage, res: ServerResponse, url: URL) {
  const queryPath = url.searchParams.get("path") ?? ".";
  const { rootReal, candidate } = await resolveSafePath(queryPath);
  const stat = await fs.stat(candidate);
  if (!stat.isDirectory()) {
    return json(res, 422, { error: "Path is not a directory" });
  }

  const entries = await fs.readdir(candidate, { withFileTypes: true });
  const items = await Promise.all(
    entries.map(async (entry) => {
      const abs = path.join(candidate, entry.name);
      const st = await fs.stat(abs).catch(() => null);
      return {
        name: entry.name,
        path: toRelative(rootReal, abs),
        type: entry.isDirectory() ? "directory" : "file",
        size: st?.size ?? null,
        mtimeMs: st?.mtimeMs ?? null,
      };
    }),
  );

  return json(res, 200, {
    path: toRelative(rootReal, candidate),
    items,
  });
}

async function handleReadFile(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
) {
  const queryPath = url.searchParams.get("path");
  if (!queryPath) return json(res, 400, { error: "Missing path query param" });
  if (!isAllowedExtension(queryPath)) {
    return json(res, 422, {
      error: `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
    });
  }

  const { rootReal, candidate } = await resolveSafePath(queryPath);
  const stat = await fs.stat(candidate);
  if (!stat.isFile()) return json(res, 422, { error: "Path is not a file" });
  if (stat.size > MAX_FILE_BYTES) {
    return json(res, 413, { error: `File too large. Max ${MAX_FILE_BYTES} bytes` });
  }

  const content = await fs.readFile(candidate, "utf8");
  return json(res, 200, {
    path: toRelative(rootReal, candidate),
    content,
    hash: await sha256(content),
    size: Buffer.byteLength(content, "utf8"),
    mtimeMs: stat.mtimeMs,
  });
}

async function handleMeta(req: IncomingMessage, res: ServerResponse, url: URL) {
  const queryPath = url.searchParams.get("path");
  if (!queryPath) return json(res, 400, { error: "Missing path query param" });
  const { rootReal, candidate } = await resolveSafePath(queryPath);
  const stat = await fs.stat(candidate);
  if (!stat.isFile()) return json(res, 422, { error: "Path is not a file" });
  if (stat.size > MAX_FILE_BYTES) {
    return json(res, 413, { error: `File too large. Max ${MAX_FILE_BYTES} bytes` });
  }
  const content = await fs.readFile(candidate, "utf8");
  return json(res, 200, {
    path: toRelative(rootReal, candidate),
    hash: await sha256(content),
    size: stat.size,
    mtimeMs: stat.mtimeMs,
  });
}

async function handleWriteFile(req: IncomingMessage, res: ServerResponse) {
  const body = await parseJsonBody(req);
  const relativePath = typeof body.path === "string" ? body.path : "";
  const content = typeof body.content === "string" ? body.content : "";
  const expectedHash =
    typeof body.expectedHash === "string" ? body.expectedHash : undefined;

  if (!relativePath) return json(res, 400, { error: "Missing path in body" });
  if (!isAllowedExtension(relativePath)) {
    return json(res, 422, {
      error: `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
    });
  }
  if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
    return json(res, 413, { error: `File too large. Max ${MAX_FILE_BYTES} bytes` });
  }

  const { rootReal, candidate } = await resolveSafePath(relativePath);
  const stat = await fs.stat(candidate).catch(() => null);
  if (stat && !stat.isFile()) {
    return json(res, 422, { error: "Path is not a file" });
  }

  if (stat) {
    const previous = await fs.readFile(candidate, "utf8");
    const previousHash = await sha256(previous);
    if (expectedHash && expectedHash !== previousHash) {
      return json(res, 409, {
        error: "File changed remotely. Refresh and retry.",
        currentHash: previousHash,
      });
    }
  }

  await fs.mkdir(path.dirname(candidate), { recursive: true });
  await fs.writeFile(candidate, content, "utf8");
  const newStat = await fs.stat(candidate);
  const hash = await sha256(content);
  return json(res, 200, {
    ok: true,
    path: toRelative(rootReal, candidate),
    hash,
    size: Buffer.byteLength(content, "utf8"),
    mtimeMs: newStat.mtimeMs,
  });
}

async function main() {
  ensureConfigured();
  const server = createServer(async (req, res) => {
    try {
      if (!req.url || !req.method) {
        return json(res, 400, { error: "Invalid request" });
      }
      if (isRateLimited(req)) {
        return json(res, 429, { error: "Rate limit exceeded" });
      }
      const auth = getBearerToken(req);
      if (!auth || auth !== TOKEN) {
        return json(res, 401, { error: "Unauthorized" });
      }

      const url = new URL(req.url, "http://localhost");
      if (req.method === "GET" && url.pathname === "/health") {
        return json(res, 200, {
          ok: true,
          rootPath: ROOT_PATH,
          allowedExtensions: ALLOWED_EXTENSIONS,
          maxFileBytes: MAX_FILE_BYTES,
        });
      }
      if (req.method === "GET" && url.pathname === "/v1/tree") {
        return await handleTree(req, res, url);
      }
      if (req.method === "GET" && url.pathname === "/v1/file") {
        return await handleReadFile(req, res, url);
      }
      if (req.method === "GET" && url.pathname === "/v1/meta") {
        return await handleMeta(req, res, url);
      }
      if (req.method === "PUT" && url.pathname === "/v1/file") {
        return await handleWriteFile(req, res);
      }

      return json(res, 404, { error: "Not found" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return json(res, 500, { error: message });
    }
  });

  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(
      `sutraha-fs-bridge listening on :${PORT}, root=${ROOT_PATH}, max=${MAX_FILE_BYTES}`,
    );
  });
}

void main();
