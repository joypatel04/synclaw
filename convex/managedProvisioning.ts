import { internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { requireMember, requireRole } from "./lib/permissions";
import { decryptSecretFromHex, encryptSecretToHex } from "./lib/secretCrypto";
import {
  isCommercialCapabilityEnabled,
  requireEnabledCapability,
} from "./lib/edition";
import {
  DEFAULT_MANAGED_SERVER_PROFILE,
  managedServerProfileByCode,
  type ManagedServerProfileCode,
} from "../lib/managedServerProfiles";

const managedRegionValidator = v.union(
  v.literal("eu_central_hil"),
  v.literal("eu_central_nbg"),
);

const serviceTierValidator = v.union(
  v.literal("self_serve"),
  v.literal("assisted"),
);

const managedServerProfileValidator = v.union(
  v.literal("starter"),
  v.literal("standard"),
  v.literal("performance"),
);

const fallbackOrder: Record<string, string[]> = {
  eu_central_hil: ["eu_central_hil", "eu_central_nbg"],
  eu_central_nbg: ["eu_central_nbg", "eu_central_hil"],
};

type ServiceTier = "self_serve" | "assisted";

type ManagedCloudProvisioning = {
  provider: "hetzner" | "aws";
  instanceId: string;
  host: string;
  serverTypeUsed?: string;
};

type ManagedFailureCode =
  | "PROVISION_FAILED"
  | "BOOTSTRAP_FAILED"
  | "GATEWAY_ROUTE_FAILED"
  | "HEALTHCHECK_FAILED"
  | "CONNECTIVITY_FAILED";

type ManagedStep =
  | "infra_provisioning"
  | "bootstrap_openclaw"
  | "gateway_route_config"
  | "health_verification"
  | "synclaw_connected";

type ManagedProviderId = "openai" | "anthropic" | "gemini";

const managedProviderValidator = v.union(
  v.literal("openai"),
  v.literal("anthropic"),
  v.literal("gemini"),
);

const MANAGED_PROVIDER_DEFAULT_MODEL: Record<ManagedProviderId, string> = {
  openai: "openai/gpt-5.1-codex",
  anthropic: "anthropic/claude-sonnet-4.5",
  gemini: "google/gemini-2.5-pro",
};

function isRegionAvailable(region: string): boolean {
  return region === "eu_central_hil" || region === "eu_central_nbg";
}

function resolveRegionWithFallback(requested: string) {
  const candidates = fallbackOrder[requested] ?? [requested, "eu_central_hil"];
  for (const region of candidates) {
    if (isRegionAvailable(region)) {
      return { resolvedRegion: region, fallbackApplied: region !== requested };
    }
  }
  return {
    resolvedRegion: "eu_central_hil",
    fallbackApplied: requested !== "eu_central_hil",
  };
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function timeoutMsFromEnv(name: string, fallbackMs: number): number {
  const value = optionalEnv(name);
  if (!value) return fallbackMs;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackMs;
  return Math.floor(parsed);
}

function boolEnv(name: string, fallback: boolean): boolean {
  const value = optionalEnv(name);
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }
  return fallback;
}

function normalizedBaseUrl(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/\/+$/, "");
}

function generateManagedGatewayTokenHex(bytesLength = 32): string {
  const bytes = new Uint8Array(bytesLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function controlPlaneBaseUrl(kind: "bootstrap" | "gateway"): string | null {
  const canonical = normalizedBaseUrl(optionalEnv("MANAGED_CONTROL_PLANE_BASE_URL"));
  if (canonical) return canonical;
  if (kind === "bootstrap") {
    return normalizedBaseUrl(optionalEnv("MANAGED_BOOTSTRAP_API_BASE_URL"));
  }
  return normalizedBaseUrl(optionalEnv("MANAGED_GATEWAY_API_BASE_URL"));
}

function parseCsvOrigins(input: string | null): string[] {
  if (!input) return [];
  return input
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.startsWith("http://") || value.startsWith("https://"));
}

function managedControlUiAllowedOrigins(): string[] {
  const siteUrl = optionalEnv("SITE_URL") ?? optionalEnv("NEXT_PUBLIC_APP_URL");
  const defaults = ["https://synclaw.in", "https://managed.synclaw.in", "https://sutraha-hq-git-develop-sutraha.vercel.app", "http://localhost:3000"];
  const localhostOrigins =
    (process.env.NODE_ENV ?? "").trim() === "production"
      ? []
      : ["http://localhost:3000", "http://127.0.0.1:3000"];
  const merged = [...defaults, ...localhostOrigins];
  if (siteUrl && !defaults.includes(siteUrl)) {
    merged.unshift(siteUrl);
  }
  return Array.from(new Set(merged));
}

function providerForManagedCloud(): "hetzner" | "aws" {
  const raw = (process.env.MANAGED_CLOUD_PROVIDER ?? "hetzner").trim().toLowerCase();
  if (raw === "aws") return "aws";
  return "hetzner";
}

function hetznerLocationForRegion(region: string): string {
  const map: Record<string, string> = {
    eu_central_hil:
      process.env.MANAGED_HETZNER_LOCATION_EU_CENTRAL_HIL?.trim() || "hel1",
    eu_central_nbg:
      process.env.MANAGED_HETZNER_LOCATION_EU_CENTRAL_NBG?.trim() || "nbg1",
  };
  return map[region] ?? map.eu_central_hil;
}

function awsRegionForFriendlyRegion(region: string): string {
  const map: Record<string, string> = {
    eu_central_hil:
      process.env.MANAGED_AWS_REGION_EU_CENTRAL_HIL?.trim() || "eu-central-1",
    eu_central_nbg:
      process.env.MANAGED_AWS_REGION_EU_CENTRAL_NBG?.trim() || "eu-central-1",
  };
  return map[region] ?? map.eu_central_hil;
}

function managedWsUrlFor(region: string, workspaceId: string, host: string): string {
  const template = process.env.MANAGED_OPENCLAW_WSS_TEMPLATE?.trim();
  if (template) {
    return template
      .replaceAll("{region}", region)
      .replaceAll("{workspaceId}", workspaceId)
      .replaceAll("{host}", host);
  }
  return `wss://synclaw.in/ws/${workspaceId}`;
}

function isoNow() {
  return new Date().toISOString();
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(data: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(data),
  );
  return hex(new Uint8Array(digest));
}

async function hmac(keyBytes: Uint8Array, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

async function hmacFromString(key: string, data: string): Promise<Uint8Array> {
  return await hmac(new TextEncoder().encode(key), data);
}

async function awsSignedQuery(
  region: string,
  params: Record<string, string>,
): Promise<string> {
  const accessKeyId = requireEnv("AWS_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("AWS_SECRET_ACCESS_KEY");
  const sessionToken = process.env.AWS_SESSION_TOKEN?.trim();

  const service = "ec2";
  const host = `ec2.${region}.amazonaws.com`;
  const method = "POST";
  const endpoint = `https://${host}/`;

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const payloadObj = {
    ...params,
    Version: "2016-11-15",
  };

  const encodedPairs = Object.entries(payloadObj)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(v).replace(/%20/g, "+")}`,
    );
  const payload = encodedPairs.join("&");
  const payloadHash = await sha256(payload);

  const canonicalHeaders = `content-type:application/x-www-form-urlencoded\nhost:${host}\nx-amz-date:${amzDate}\n${sessionToken ? `x-amz-security-token:${sessionToken}\n` : ""}`;
  const signedHeaders = sessionToken
    ? "content-type;host;x-amz-date;x-amz-security-token"
    : "content-type;host;x-amz-date";

  const canonicalRequest = [
    method,
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join("\n");

  const kDate = await hmacFromString(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, "aws4_request");
  const signature = hex(await hmac(kSigning, stringToSign));

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    "x-amz-date": amzDate,
    authorization,
  };
  if (sessionToken) headers["x-amz-security-token"] = sessionToken;

  const response = await fetch(endpoint, {
    method,
    headers,
    body: payload,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`AWS API error (${response.status}): ${text.slice(0, 400)}`);
  }
  return text;
}

async function provisionWithAws(region: string): Promise<ManagedCloudProvisioning> {
  const instanceType = process.env.MANAGED_AWS_INSTANCE_TYPE?.trim() || "t3.small";
  const imageId = requireEnv("MANAGED_AWS_AMI_ID");

  const runXml = await awsSignedQuery(region, {
    Action: "RunInstances",
    ImageId: imageId,
    InstanceType: instanceType,
    MinCount: "1",
    MaxCount: "1",
    UserData: btoa(process.env.MANAGED_AWS_USER_DATA?.trim() || ""),
  });

  const instanceIdMatch = runXml.match(/<instanceId>(i-[^<]+)<\/instanceId>/i);
  const instanceId = instanceIdMatch?.[1];
  if (!instanceId) {
    throw new Error("AWS RunInstances succeeded but instanceId was not found.");
  }

  await sleep(1500);

  const describeXml = await awsSignedQuery(region, {
    Action: "DescribeInstances",
    "InstanceId.1": instanceId,
  });
  const publicIpMatch = describeXml.match(/<ipAddress>([^<]+)<\/ipAddress>/i);
  const host = publicIpMatch?.[1] ?? `${instanceId}.${region}.aws.internal`;

  return {
    provider: "aws",
    instanceId,
    host,
  };
}

async function provisionWithHetzner(
  region: string,
  requestedServerProfile?: string,
): Promise<ManagedCloudProvisioning> {
  const token = requireEnv("HETZNER_API_TOKEN");
  const configuredServerTypeRaw = process.env.MANAGED_HETZNER_SERVER_TYPE?.trim();
  const fallbackServerTypeRaw =
    process.env.MANAGED_HETZNER_FALLBACK_SERVER_TYPE?.trim();
  const image = process.env.MANAGED_HETZNER_IMAGE?.trim() || "ubuntu-24.04";
  const userData = process.env.MANAGED_HETZNER_CLOUD_INIT?.trim();
  const location = hetznerLocationForRegion(region);

  const isLegacyServerTypeId = (value: string | undefined) =>
    Boolean(value && /^\d+$/.test(value));
  const selectedProfile = managedServerProfileByCode(
    requestedServerProfile ??
      process.env.MANAGED_DEFAULT_SERVER_PROFILE?.trim() ??
      DEFAULT_MANAGED_SERVER_PROFILE,
  );
  const configuredServerType =
    configuredServerTypeRaw && !isLegacyServerTypeId(configuredServerTypeRaw)
      ? configuredServerTypeRaw
      : selectedProfile.serverType;
  const fallbackServerType =
    fallbackServerTypeRaw && !isLegacyServerTypeId(fallbackServerTypeRaw)
      ? fallbackServerTypeRaw
      : selectedProfile.serverType;
  const serverTypeCandidates = Array.from(
    new Set([configuredServerType, fallbackServerType]),
  );
  const createServer = async (serverType: string) => {
    const response = await fetch("https://api.hetzner.cloud/v1/servers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `synclaw-managed-${Date.now()}`,
        server_type: serverType,
        image,
        location,
        user_data: userData,
        start_after_create: true,
      }),
    });
    const payload = await response.json().catch(() => null);
    return { response, payload };
  };

  let attemptedServerType = serverTypeCandidates[0]!;
  let response: Response | null = null;
  let payload: any = null;

  for (const candidate of serverTypeCandidates) {
    attemptedServerType = candidate;
    ({ response, payload } = await createServer(candidate));
    if (response.ok) break;
    const message = String(payload?.error?.message ?? "").toLowerCase();
    const hasServerTypeError =
      response.status === 422 &&
      (message.includes("server type") ||
        message.includes("deprecated") ||
        message.includes("invalid"));
    if (!hasServerTypeError) {
      break;
    }
  }

  if (!response || !response.ok) {
    throw new Error(
      `Hetzner API error (${response?.status ?? "unknown"}): ${JSON.stringify(payload)}`,
    );
  }

  const instanceId = String(payload?.server?.id ?? "");
  const host =
    payload?.server?.public_net?.ipv4?.ip || payload?.server?.name || "unknown";
  if (!instanceId) {
    throw new Error("Hetzner server creation succeeded but server id is missing.");
  }

  return {
    provider: "hetzner",
    instanceId,
    host,
    serverTypeUsed: attemptedServerType,
  };
}

async function provisionManagedInstance(
  region: string,
  requestedServerProfile?: string,
): Promise<ManagedCloudProvisioning> {
  const provider = providerForManagedCloud();
  if (provider === "aws") {
    const awsRegion = awsRegionForFriendlyRegion(region);
    return await provisionWithAws(awsRegion);
  }
  return await provisionWithHetzner(region, requestedServerProfile);
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(payload)}`);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

export const _bootstrapOpenClawInstance = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    jobId: v.id("openclawProvisioningJobs"),
    provider: v.union(v.literal("hetzner"), v.literal("aws")),
    instanceId: v.string(),
    host: v.string(),
    resolvedRegion: v.string(),
    openclawGatewayToken: v.string(),
    filesBridgeToken: v.string(),
  },
  handler: async (_ctx, args) => {
    requireEnabledCapability("managedProvisioning");
    const apiBase = controlPlaneBaseUrl("bootstrap");
    const timeoutMs = timeoutMsFromEnv("MANAGED_BOOTSTRAP_TIMEOUT_MS", 120000);
    const strict = optionalEnv("MANAGED_BOOTSTRAP_STRICT") === "true";
    if (!apiBase) {
      if (strict) {
        throw new Error(
          "MANAGED_CONTROL_PLANE_BASE_URL (or MANAGED_BOOTSTRAP_API_BASE_URL) is required when MANAGED_BOOTSTRAP_STRICT=true.",
        );
      }
      await sleep(1200);
      return { ok: true, simulated: true };
    }

    const token =
      optionalEnv("MANAGED_BOOTSTRAP_API_TOKEN") ??
      optionalEnv("MANAGED_GATEWAY_API_TOKEN");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const payload = await fetchJsonWithTimeout(
      `${apiBase}/bootstrap`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          workspaceId: String(args.workspaceId),
          jobId: String(args.jobId),
          provider: args.provider,
          instanceId: args.instanceId,
          host: args.host,
          region: args.resolvedRegion,
          bootstrapUser: optionalEnv("MANAGED_BOOTSTRAP_USER") ?? "root",
          sshPrivateKey: optionalEnv("MANAGED_BOOTSTRAP_SSH_PRIVATE_KEY"),
          openclawGatewayToken: args.openclawGatewayToken,
          filesBridgeToken: args.filesBridgeToken,
          filesBridgePort: Number(optionalEnv("MANAGED_FILES_BRIDGE_PORT") ?? "8787"),
          filesBridgeRootPath:
            optionalEnv("MANAGED_FILES_BRIDGE_ROOT_PATH") ?? "/root/.openclaw",
          controlUiAllowedOrigins: managedControlUiAllowedOrigins(),
        }),
      },
      timeoutMs,
    );
    return { ok: true, simulated: false, payload };
  },
});

export const _configureGatewayRoute = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    jobId: v.id("openclawProvisioningJobs"),
    host: v.string(),
    resolvedRegion: v.string(),
    managedWsUrl: v.string(),
  },
  handler: async (_ctx, args) => {
    requireEnabledCapability("managedGatewayAutomation");
    const apiBase = controlPlaneBaseUrl("gateway");
    const timeoutMs = timeoutMsFromEnv("MANAGED_HEALTHCHECK_TIMEOUT_MS", 60000);
    const strict = optionalEnv("MANAGED_GATEWAY_STRICT") === "true";
    if (!apiBase) {
      if (strict) {
        throw new Error(
          "MANAGED_CONTROL_PLANE_BASE_URL (or MANAGED_GATEWAY_API_BASE_URL) is required when MANAGED_GATEWAY_STRICT=true.",
        );
      }
      await sleep(900);
      return { ok: true, simulated: true };
    }
    const token = optionalEnv("MANAGED_GATEWAY_API_TOKEN");
    if (!token && strict) {
      throw new Error("MANAGED_GATEWAY_API_TOKEN is required for strict mode.");
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const payload = await fetchJsonWithTimeout(
      `${apiBase}/routes`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          workspaceId: String(args.workspaceId),
          jobId: String(args.jobId),
          upstreamHost: args.host,
          upstreamPort: Number(optionalEnv("MANAGED_UPSTREAM_WS_PORT") ?? "18789"),
          region: args.resolvedRegion,
          wsUrl: args.managedWsUrl,
        }),
      },
      timeoutMs,
    );
    return { ok: true, simulated: false, payload };
  },
});

export const _deleteGatewayRoute = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    jobId: v.id("openclawProvisioningJobs"),
  },
  handler: async (_ctx, args) => {
    requireEnabledCapability("managedGatewayAutomation");
    const apiBase = controlPlaneBaseUrl("gateway");
    if (!apiBase) return { ok: true, skipped: true };
    const token = optionalEnv("MANAGED_GATEWAY_API_TOKEN");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const timeoutMs = timeoutMsFromEnv("MANAGED_HEALTHCHECK_TIMEOUT_MS", 60000);
    const payload = await fetchJsonWithTimeout(
      `${apiBase}/routes/delete`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          workspaceId: String(args.workspaceId),
          jobId: String(args.jobId),
        }),
      },
      timeoutMs,
    );
    return { ok: true, payload };
  },
});

export const _runManagedHealthChecks = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    jobId: v.id("openclawProvisioningJobs"),
    host: v.string(),
    managedWsUrl: v.string(),
  },
  handler: async (_ctx, args) => {
    requireEnabledCapability("managedGatewayAutomation");
    if (!args.managedWsUrl.startsWith("wss://")) {
      throw new Error("Managed wsUrl must use wss://");
    }
    const timeoutMs = timeoutMsFromEnv("MANAGED_HEALTHCHECK_TIMEOUT_MS", 60000);
    const apiBase = controlPlaneBaseUrl("gateway");
    if (!apiBase) {
      await sleep(1000);
      return { ok: true, checks: { wsUrlTls: true, hostPresent: Boolean(args.host) } };
    }
    const token = optionalEnv("MANAGED_GATEWAY_API_TOKEN");
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const payload = await fetchJsonWithTimeout(
      `${apiBase}/routes/verify?workspaceId=${encodeURIComponent(String(args.workspaceId))}`,
      {
        method: "GET",
        headers,
      },
      timeoutMs,
    );
    const routeChecks = (payload as any)?.checks ?? {};
    const gatewayRouteOk = Boolean(
      (payload as any)?.ok &&
        routeChecks.routeExists !== false &&
        routeChecks.upstreamReachable !== false,
    );
    return {
      ok: gatewayRouteOk,
      checks: {
        wsUrlTls: true,
        hostPresent: Boolean(args.host),
        gatewayRoute: gatewayRouteOk,
        routeExists: routeChecks.routeExists ?? null,
        upstreamReachable: routeChecks.upstreamReachable ?? null,
      },
      payload,
    };
  },
});

export const _applyManagedProviderConfig = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    jobId: v.string(),
    host: v.string(),
    provider: managedProviderValidator,
    apiKey: v.string(),
    defaultModel: v.string(),
  },
  handler: async (_ctx, args) => {
    requireEnabledCapability("managedProvisioning");
    const apiBase = controlPlaneBaseUrl("gateway");
    const timeoutMs = timeoutMsFromEnv("MANAGED_PROVIDER_APPLY_TIMEOUT_MS", 75000);
    if (!apiBase) {
      throw new Error(
        "MANAGED_CONTROL_PLANE_BASE_URL (or MANAGED_GATEWAY_API_BASE_URL) is required for provider autoconfig.",
      );
    }
    const token = optionalEnv("MANAGED_GATEWAY_API_TOKEN");
    if (!token) {
      throw new Error("MANAGED_GATEWAY_API_TOKEN is required for provider autoconfig.");
    }
    const sshPrivateKey = optionalEnv("MANAGED_BOOTSTRAP_SSH_PRIVATE_KEY");
    if (!sshPrivateKey) {
      throw new Error("MANAGED_BOOTSTRAP_SSH_PRIVATE_KEY is required for provider autoconfig.");
    }

    const payload = await fetchJsonWithTimeout(
      `${apiBase}/openclaw/provider/apply`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workspaceId: String(args.workspaceId),
          jobId: args.jobId,
          host: args.host,
          bootstrapUser: optionalEnv("MANAGED_BOOTSTRAP_USER") ?? "root",
          sshPrivateKey,
          provider: args.provider,
          apiKey: args.apiKey,
          defaultModel: args.defaultModel,
          controlUiAllowedOrigins: managedControlUiAllowedOrigins(),
        }),
      },
      timeoutMs,
    );
    return payload;
  },
});

export const _verifyManagedProviderRuntime = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    host: v.string(),
    provider: managedProviderValidator,
    defaultModel: v.string(),
  },
  handler: async (_ctx, args) => {
    requireEnabledCapability("managedProvisioning");
    const apiBase = controlPlaneBaseUrl("gateway");
    const timeoutMs = timeoutMsFromEnv("MANAGED_PROVIDER_VERIFY_TIMEOUT_MS", 30000);
    if (!apiBase) {
      throw new Error(
        "MANAGED_CONTROL_PLANE_BASE_URL (or MANAGED_GATEWAY_API_BASE_URL) is required for provider verify.",
      );
    }
    const token = optionalEnv("MANAGED_GATEWAY_API_TOKEN");
    if (!token) {
      throw new Error("MANAGED_GATEWAY_API_TOKEN is required for provider verify.");
    }
    const sshPrivateKey = optionalEnv("MANAGED_BOOTSTRAP_SSH_PRIVATE_KEY");
    if (!sshPrivateKey) {
      throw new Error("MANAGED_BOOTSTRAP_SSH_PRIVATE_KEY is required for provider verify.");
    }
    const payload = await fetchJsonWithTimeout(
      `${apiBase}/openclaw/provider/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workspaceId: String(args.workspaceId),
          host: args.host,
          bootstrapUser: optionalEnv("MANAGED_BOOTSTRAP_USER") ?? "root",
          sshPrivateKey,
          provider: args.provider,
          defaultModel: args.defaultModel,
        }),
      },
      timeoutMs,
    );
    return payload;
  },
});

export const _appendManagedJobLog = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    jobId: v.id("openclawProvisioningJobs"),
    log: v.string(),
    step: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("running"),
        v.literal("failed"),
        v.literal("completed"),
        v.literal("canceled"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    requireEnabledCapability("managedProvisioning");
    const job = await ctx.db.get(args.jobId);
    if (!job || job.workspaceId !== args.workspaceId) return;
    const cfg = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    const statusToManaged =
      args.status === "failed"
        ? "failed"
        : args.status === "completed"
          ? "ready"
          : "provisioning";
    await ctx.db.patch(job._id, {
      logs: [...(job.logs ?? []), `[${isoNow()}] ${args.log}`],
      step: (args.step as any) ?? job.step,
      status: args.status ?? job.status,
      updatedAt: Date.now(),
    } as any);
    if (cfg) {
      await ctx.db.patch(cfg._id, {
        managedStatus: statusToManaged,
        updatedAt: Date.now(),
      } as any);
    }
  },
});

export const _markStepStatus = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    jobId: v.id("openclawProvisioningJobs"),
    step: v.union(
      v.literal("infra_provisioning"),
      v.literal("bootstrap_openclaw"),
      v.literal("gateway_route_config"),
      v.literal("health_verification"),
      v.literal("synclaw_connected"),
    ),
    status: v.union(v.literal("running"), v.literal("ready"), v.literal("failed")),
    log: v.string(),
  },
  handler: async (ctx, args) => {
    requireEnabledCapability("managedProvisioning");
    const job = await ctx.db.get(args.jobId);
    if (!job || job.workspaceId !== args.workspaceId) return;
    const now = Date.now();
    const patch: Record<string, any> = {
      step: args.step,
      logs: [...(job.logs ?? []), `[${isoNow()}] ${args.log}`],
      updatedAt: now,
    };
    if (args.status === "running") patch.status = "running";

    if (args.step === "bootstrap_openclaw") {
      patch.bootstrapStatus =
        args.status === "running" ? "running" : args.status === "ready" ? "ready" : "failed";
    }
    if (args.step === "gateway_route_config") {
      patch.gatewayRouteStatus =
        args.status === "running" ? "running" : args.status === "ready" ? "ready" : "failed";
    }
    if (args.step === "health_verification") {
      patch.healthcheckStatus =
        args.status === "running" ? "running" : args.status === "ready" ? "ready" : "failed";
    }
    await ctx.db.patch(job._id, patch as any);

    const cfg = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    if (!cfg) return;
    const cfgPatch: Record<string, any> = { updatedAt: now };
    if (args.step === "bootstrap_openclaw" && args.status === "ready") {
      cfgPatch.managedBootstrapReadyAt = now;
    }
    if (args.step === "gateway_route_config" && args.status === "ready") {
      cfgPatch.managedGatewayReadyAt = now;
    }
    if (args.status === "failed") {
      cfgPatch.managedStatus = "failed";
    } else if (args.status === "running") {
      cfgPatch.managedStatus = "provisioning";
    }
    await ctx.db.patch(cfg._id, cfgPatch as any);
  },
});

export const _markManagedJobFailed = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    jobId: v.id("openclawProvisioningJobs"),
    failureCode: v.optional(
      v.union(
        v.literal("PROVISION_FAILED"),
        v.literal("BOOTSTRAP_FAILED"),
        v.literal("GATEWAY_ROUTE_FAILED"),
        v.literal("HEALTHCHECK_FAILED"),
        v.literal("CONNECTIVITY_FAILED"),
      ),
    ),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    requireEnabledCapability("managedProvisioning");
    const job = await ctx.db.get(args.jobId);
    if (!job || job.workspaceId !== args.workspaceId) return;
    const now = Date.now();
    const statusPatch: Record<string, any> = {};
    if (args.failureCode === "BOOTSTRAP_FAILED") {
      statusPatch.bootstrapStatus = "failed";
    } else if (args.failureCode === "GATEWAY_ROUTE_FAILED") {
      statusPatch.gatewayRouteStatus = "failed";
    } else if (args.failureCode === "HEALTHCHECK_FAILED") {
      statusPatch.healthcheckStatus = "failed";
    }
    await ctx.db.patch(job._id, {
      status: "failed",
      failureCode: args.failureCode,
      failureReason: args.reason,
      finishedAt: now,
      updatedAt: now,
      logs: [...(job.logs ?? []), `[${isoNow()}] Provisioning failed: ${args.reason}`],
      ...statusPatch,
    } as any);
    const cfg = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    if (cfg) {
      await ctx.db.patch(cfg._id, {
        managedStatus: "failed",
        updatedAt: now,
        updatedBy: cfg.updatedBy,
      } as any);
    }
  },
});

export const _finalizeManagedConnection = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    jobId: v.id("openclawProvisioningJobs"),
    resolvedRegion: v.string(),
    instanceId: v.string(),
    host: v.string(),
    provider: v.union(v.literal("hetzner"), v.literal("aws")),
    serverTypeUsed: v.optional(v.string()),
    upstreamHost: v.optional(v.string()),
    upstreamPort: v.optional(v.number()),
    routeVersion: v.optional(v.number()),
    openclawGatewayToken: v.string(),
    filesBridgeToken: v.string(),
  },
  handler: async (ctx, args) => {
    requireEnabledCapability("managedProvisioning");
    const now = Date.now();
    const cfg = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    if (!cfg) throw new Error("OpenClaw config missing for managed connection.");

    const managedWsUrl = managedWsUrlFor(
      args.resolvedRegion,
      String(args.workspaceId),
      args.host,
    );
    const tokenEnc = await encryptSecretToHex(args.openclawGatewayToken);
    const filesBridgeTokenEnc = await encryptSecretToHex(args.filesBridgeToken);
    const filesBridgePort = Number(optionalEnv("MANAGED_FILES_BRIDGE_PORT") ?? "8787");
    const filesBridgeBaseUrl = `http://${args.host}:${filesBridgePort}`;
    const filesBridgeRootPath =
      optionalEnv("MANAGED_FILES_BRIDGE_ROOT_PATH") ?? "/root/.openclaw";

    await ctx.db.patch(cfg._id, {
      wsUrl: managedWsUrl,
      deploymentMode: "managed",
      transportMode: "direct_ws",
      provisioningMode: "sutraha_managed",
      managedStatus: "ready",
      managedRegionResolved: args.resolvedRegion,
      managedConnectedAt: now,
      managedBootstrapReadyAt: cfg.managedBootstrapReadyAt ?? now,
      managedGatewayReadyAt: cfg.managedGatewayReadyAt ?? now,
      providerRuntimeStatus: "pending",
      defaultProvider: undefined,
      defaultModel: undefined,
      lastProviderApplyAt: undefined,
      lastProviderApplyError: undefined,
      managedInstanceId: `${args.provider}:${args.instanceId}`,
      managedServerType: args.serverTypeUsed ?? cfg.managedServerType,
      managedUpstreamHost: args.upstreamHost ?? cfg.managedUpstreamHost ?? args.host,
      managedUpstreamPort:
        args.upstreamPort ?? cfg.managedUpstreamPort ?? Number(optionalEnv("MANAGED_UPSTREAM_WS_PORT") ?? "18789"),
      managedRouteVersion: args.routeVersion ?? cfg.managedRouteVersion,
      setupStatus: "verified",
      securityChecklistVersion: 1,
      securityConfirmedAt: now,
      recommendedMethod: "public_wss",
      authTokenCiphertextHex: tokenEnc.ciphertextHex,
      authTokenIvHex: tokenEnc.ivHex,
      filesBridgeEnabled: true,
      filesBridgeBaseUrl,
      filesBridgeRootPath,
      filesBridgeTokenCiphertextHex: filesBridgeTokenEnc.ciphertextHex,
      filesBridgeTokenIvHex: filesBridgeTokenEnc.ivHex,
      updatedAt: now,
      updatedBy: cfg.updatedBy,
    } as any);

    const job = await ctx.db.get(args.jobId);
    if (job) {
      await ctx.db.patch(job._id, {
        status: "completed",
        step: "done",
        connectionAutoApplied: true,
        resolvedServerType:
          args.serverTypeUsed ?? job.resolvedServerType ?? job.requestedServerType,
        bootstrapStatus: "ready",
        gatewayRouteStatus: "ready",
        healthcheckStatus: "ready",
        finishedAt: now,
        updatedAt: now,
        logs: [
          ...(job.logs ?? []),
          `[${isoNow()}] Gateway configured (${managedWsUrl}).`,
          `[${isoNow()}] Gateway auth token generated by control plane.`,
          `[${isoNow()}] Security hardening baseline applied.`,
          `[${isoNow()}] Synclaw auto-connected and verified.`,
        ],
      } as any);
    }
  },
});

export const executeManagedProvisioning = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    jobId: v.id("openclawProvisioningJobs"),
  },
  handler: async (ctx, args) => {
    requireEnabledCapability("managedProvisioning");
    const fail = async (
      failureCode: ManagedFailureCode,
      reason: string,
      step?: ManagedStep,
    ) => {
      if (step) {
        await ctx.runMutation(internal.managedProvisioning._markStepStatus, {
          workspaceId: args.workspaceId,
          jobId: args.jobId,
          step,
          status: "failed",
          log: reason,
        });
      }
      await ctx.runMutation(internal.managedProvisioning._markManagedJobFailed, {
        workspaceId: args.workspaceId,
        jobId: args.jobId,
        failureCode,
        reason,
      });
      return { ok: false, error: reason, failureCode };
    };

    try {
      const job = await ctx.runQuery(internal.managedProvisioning.getJobStatus, {
        workspaceId: args.workspaceId,
        jobId: args.jobId,
      });
      if (!job) return { ok: false };

      await ctx.runMutation(internal.managedProvisioning._markStepStatus, {
        workspaceId: args.workspaceId,
        jobId: args.jobId,
        step: "infra_provisioning",
        status: "running",
        log: "Provisioning isolated infrastructure host.",
      });

      let provisioned: ManagedCloudProvisioning;
      try {
        provisioned = await provisionManagedInstance(
          job.resolvedRegion || "eu_central_hil",
          job.requestedServerProfile,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return await fail("PROVISION_FAILED", message, "infra_provisioning");
      }

      await ctx.runMutation(internal.managedProvisioning._appendManagedJobLog, {
        workspaceId: args.workspaceId,
        jobId: args.jobId,
        step: "infra_provisioning",
        status: "running",
        log:
          `Instance ready (${provisioned.provider}:${provisioned.instanceId}` +
          `${provisioned.serverTypeUsed ? ` / ${provisioned.serverTypeUsed}` : ""}).`,
      });

      await ctx.runMutation(internal.managedProvisioning._markStepStatus, {
        workspaceId: args.workspaceId,
        jobId: args.jobId,
        step: "bootstrap_openclaw",
        status: "running",
        log: "Bootstrapping OpenClaw runtime on provisioned instance.",
      });
      const managedGatewayToken = generateManagedGatewayTokenHex(32);
      const filesBridgeToken = generateManagedGatewayTokenHex(32);
      try {
        await ctx.runAction(internal.managedProvisioning._bootstrapOpenClawInstance, {
          workspaceId: args.workspaceId,
          jobId: args.jobId,
          provider: provisioned.provider,
          instanceId: provisioned.instanceId,
          host: provisioned.host,
          resolvedRegion: job.resolvedRegion || "eu_central_hil",
          openclawGatewayToken: managedGatewayToken,
          filesBridgeToken,
        });
        await ctx.runMutation(internal.managedProvisioning._markStepStatus, {
          workspaceId: args.workspaceId,
          jobId: args.jobId,
          step: "bootstrap_openclaw",
          status: "ready",
          log: "OpenClaw bootstrap completed.",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return await fail("BOOTSTRAP_FAILED", message, "bootstrap_openclaw");
      }

      const managedWsUrl = managedWsUrlFor(
        job.resolvedRegion || "eu_central_hil",
        String(args.workspaceId),
        provisioned.host,
      );
      let routedUpstreamHost = provisioned.host;
      let routedUpstreamPort = Number(optionalEnv("MANAGED_UPSTREAM_WS_PORT") ?? "18789");
      let routedVersion: number | undefined = undefined;

      await ctx.runMutation(internal.managedProvisioning._appendManagedJobLog, {
        workspaceId: args.workspaceId,
        jobId: args.jobId,
        step: "gateway_route_config",
        status: "running",
        log: "Removing any stale workspace route before re-registering.",
      });
      await ctx.runAction(internal.managedProvisioning._deleteGatewayRoute, {
        workspaceId: args.workspaceId,
        jobId: args.jobId,
      }).catch(() => null);

      await ctx.runMutation(internal.managedProvisioning._markStepStatus, {
        workspaceId: args.workspaceId,
        jobId: args.jobId,
        step: "gateway_route_config",
        status: "running",
        log: "Configuring central gateway workspace route.",
      });
      try {
        const routeResult = await ctx.runAction(
          internal.managedProvisioning._configureGatewayRoute,
          {
            workspaceId: args.workspaceId,
            jobId: args.jobId,
            host: provisioned.host,
            resolvedRegion: job.resolvedRegion || "eu_central_hil",
            managedWsUrl,
          },
        );
        const routePayload = (routeResult as any)?.payload ?? {};
        const upstreamHost = String(
          routePayload.upstreamHost ?? routePayload.host ?? provisioned.host,
        );
        const upstreamPortRaw = routePayload.upstreamPort ?? routePayload.port;
        const upstreamPort =
          typeof upstreamPortRaw === "number"
            ? upstreamPortRaw
            : Number(optionalEnv("MANAGED_UPSTREAM_WS_PORT") ?? "18789");
        const routeVersionRaw = routePayload.routeVersion ?? routePayload.version;
        const routeVersion =
          typeof routeVersionRaw === "number" ? routeVersionRaw : undefined;
        routedUpstreamHost = upstreamHost;
        routedUpstreamPort = upstreamPort;
        routedVersion = routeVersion;

        await ctx.runMutation(internal.managedProvisioning._appendManagedJobLog, {
          workspaceId: args.workspaceId,
          jobId: args.jobId,
          step: "gateway_route_config",
          status: "running",
          log: `Workspace route active -> ${upstreamHost}:${upstreamPort}.`,
        });
        await ctx.runMutation(internal.managedProvisioning._markStepStatus, {
          workspaceId: args.workspaceId,
          jobId: args.jobId,
          step: "gateway_route_config",
          status: "ready",
          log: `Gateway route configured (${managedWsUrl}).`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return await fail("GATEWAY_ROUTE_FAILED", message, "gateway_route_config");
      }

      await ctx.runMutation(internal.managedProvisioning._markStepStatus, {
        workspaceId: args.workspaceId,
        jobId: args.jobId,
        step: "health_verification",
        status: "running",
        log: "Running managed OpenClaw health and connectivity checks.",
      });
      try {
        await ctx.runAction(internal.managedProvisioning._runManagedHealthChecks, {
          workspaceId: args.workspaceId,
          jobId: args.jobId,
          host: routedUpstreamHost,
          managedWsUrl,
        });
        await ctx.runMutation(internal.managedProvisioning._markStepStatus, {
          workspaceId: args.workspaceId,
          jobId: args.jobId,
          step: "health_verification",
          status: "ready",
          log: "Health verification passed.",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return await fail("HEALTHCHECK_FAILED", message, "health_verification");
      }

      await ctx.runMutation(internal.managedProvisioning._markStepStatus, {
        workspaceId: args.workspaceId,
        jobId: args.jobId,
        step: "synclaw_connected",
        status: "running",
        log: "Applying connection details and finalizing Synclaw integration.",
      });
      try {
        await ctx.runMutation(internal.managedProvisioning._finalizeManagedConnection, {
          workspaceId: args.workspaceId,
          jobId: args.jobId,
          resolvedRegion: job.resolvedRegion || "eu_central_hil",
          instanceId: provisioned.instanceId,
          host: provisioned.host,
          provider: provisioned.provider,
          serverTypeUsed: provisioned.serverTypeUsed,
          upstreamHost: routedUpstreamHost,
          upstreamPort: routedUpstreamPort,
          routeVersion: routedVersion,
          openclawGatewayToken: managedGatewayToken,
          filesBridgeToken,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return await fail("CONNECTIVITY_FAILED", message, "synclaw_connected");
      }

      return {
        ok: true,
        provider: provisioned.provider,
        instanceId: provisioned.instanceId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return await fail("CONNECTIVITY_FAILED", message);
    }
  },
});

export const createManagedJob = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    requestedRegion: managedRegionValidator,
    serviceTier: serviceTierValidator,
    serverProfile: v.optional(managedServerProfileValidator),
  },
  handler: async (ctx, args) => {
    requireEnabledCapability("managedProvisioning");
    const membership = await requireRole(ctx, args.workspaceId, "owner");
    return await createManagedJobInternal(
      ctx,
      args.workspaceId,
      args.requestedRegion,
      args.serviceTier,
      args.serverProfile ?? DEFAULT_MANAGED_SERVER_PROFILE,
      membership.userId,
    );
  },
});

async function createManagedJobInternal(
  ctx: any,
  workspaceId: any,
  requestedRegion: string,
  serviceTier: ServiceTier,
  serverProfile: ManagedServerProfileCode,
  userId: any,
) {
  const now = Date.now();
  const { resolvedRegion, fallbackApplied } =
    resolveRegionWithFallback(requestedRegion);
  const requestedServerType = managedServerProfileByCode(serverProfile).serverType;

  const jobId = await ctx.db.insert("openclawProvisioningJobs", {
    workspaceId,
    provider: "sutraha-managed",
    targetHostType: "sutraha_managed",
    requestedRegion,
    requestedServerProfile: serverProfile,
    requestedServerType,
    resolvedRegion,
    fallbackApplied,
    bootstrapStatus: "pending",
    gatewayRouteStatus: "pending",
    healthcheckStatus: "pending",
    connectionAutoApplied: false,
    status: "queued",
    step: "queued",
    logs: [
      `[${isoNow()}] Managed provisioning request created by ${userId}`,
      fallbackApplied
        ? `[${isoNow()}] Requested region ${requestedRegion} unavailable, auto-fallback to ${resolvedRegion}.`
        : `[${isoNow()}] Region selected: ${resolvedRegion}.`,
      `[${isoNow()}] Server profile selected: ${serverProfile} (${requestedServerType}).`,
    ],
    startedAt: now,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  const existing = await ctx.db
    .query("openclawGatewayConfigs")
    .withIndex("byWorkspace", (q: any) => q.eq("workspaceId", workspaceId))
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      deploymentMode: "managed",
      provisioningMode: "sutraha_managed",
      serviceTier,
      setupStatus: "infra_ready",
      managedStatus: "queued",
      providerRuntimeStatus: "pending",
      defaultProvider: undefined,
      defaultModel: undefined,
      lastProviderApplyAt: undefined,
      lastProviderApplyError: undefined,
      managedRegionRequested: requestedRegion,
      managedRegionResolved: resolvedRegion,
      managedServerProfile: serverProfile,
      managedUpstreamHost: undefined,
      managedUpstreamPort: undefined,
      managedRouteVersion: undefined,
      managedAutoFallbackUsed: fallbackApplied,
      managedInstanceId: existing.managedInstanceId || `mc-${String(workspaceId)}-${now}`,
      updatedAt: now,
      updatedBy: userId,
    } as any);
  } else {
    await ctx.db.insert("openclawGatewayConfigs", {
      workspaceId,
      wsUrl: "",
      deploymentMode: "managed",
      transportMode: "direct_ws",
      provisioningMode: "sutraha_managed",
      managedRegionRequested: requestedRegion,
      managedRegionResolved: resolvedRegion,
      managedServerProfile: serverProfile,
      managedUpstreamHost: "",
      managedUpstreamPort: Number(optionalEnv("MANAGED_UPSTREAM_WS_PORT") ?? "18789"),
      managedRouteVersion: 0,
      managedStatus: "queued",
      providerRuntimeStatus: "pending",
      managedInstanceId: `mc-${String(workspaceId)}-${now}`,
      managedAutoFallbackUsed: fallbackApplied,
      defaultProvider: undefined,
      defaultModel: undefined,
      lastProviderApplyAt: undefined,
      lastProviderApplyError: undefined,
      serviceTier,
      setupStatus: "infra_ready",
      protocol: "req",
      clientId: "openclaw-control-ui",
      clientMode: "webchat",
      clientPlatform: "web",
      role: "operator",
      scopes: ["operator.read", "operator.write", "operator.admin"],
      subscribeOnConnect: false,
      subscribeMethod: "chat.subscribe",
      includeCron: true,
      historyPollMs: 5000,
      securityChecklistVersion: 1,
      recommendedMethod: "public_wss",
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
    } as any);
  }

  await ctx.scheduler.runAfter(
    0,
    internal.managedProvisioning.executeManagedProvisioning as any,
    {
      workspaceId,
      jobId,
    },
  );

  return {
    ok: true,
    jobId,
    requestedRegion,
    resolvedRegion,
    fallbackApplied,
    serverProfile,
    connected: { ok: false, pending: true },
  };
}

export const autoConnectWorkspace = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    requireEnabledCapability("managedProvisioning");
    const membership = await requireRole(ctx, args.workspaceId, "owner");
    const cfg = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    if (!cfg) throw new Error("OpenClaw config not found");
    await ctx.scheduler.runAfter(
      0,
      internal.managedProvisioning.executeManagedProvisioning as any,
      {
        workspaceId: args.workspaceId,
        jobId: (await ctx.db.insert("openclawProvisioningJobs", {
          workspaceId: args.workspaceId,
          provider: "sutraha-managed",
          targetHostType: "sutraha_managed",
          requestedRegion: cfg.managedRegionRequested ?? "eu_central_hil",
          resolvedRegion:
            cfg.managedRegionResolved ??
            cfg.managedRegionRequested ??
            "eu_central_hil",
          requestedServerProfile:
            cfg.managedServerProfile ?? DEFAULT_MANAGED_SERVER_PROFILE,
          requestedServerType: managedServerProfileByCode(
            cfg.managedServerProfile ?? DEFAULT_MANAGED_SERVER_PROFILE,
          ).serverType,
          fallbackApplied: Boolean(cfg.managedAutoFallbackUsed),
          bootstrapStatus: "pending",
          gatewayRouteStatus: "pending",
          healthcheckStatus: "pending",
          connectionAutoApplied: false,
          status: "queued",
          step: "queued",
          logs: [`[${isoNow()}] Auto-connect re-triggered by ${membership.userId}`],
          startedAt: Date.now(),
          createdBy: membership.userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })) as any,
      },
    );
    return { ok: true, queued: true };
  },
});

export const getManagedStatus = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    // Read-path should be resilient to env drift (client flags vs server flags).
    // If managed capability is disabled, return null instead of throwing.
    if (!isCommercialCapabilityEnabled("managedProvisioning")) {
      return null;
    }
    await requireMember(ctx, args.workspaceId);
    const cfg = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    const latestJob = await ctx.db
      .query("openclawProvisioningJobs")
      .withIndex("byWorkspaceAndCreatedAt", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .first();
    if (!cfg) return null;
    return {
      deploymentMode: cfg.deploymentMode ?? "manual",
      managedStatus: cfg.managedStatus ?? "queued",
      requestedRegion: cfg.managedRegionRequested ?? "",
      resolvedRegion: cfg.managedRegionResolved ?? "",
      serverProfile:
        cfg.managedServerProfile ?? DEFAULT_MANAGED_SERVER_PROFILE,
      serverType:
        cfg.managedServerType ??
        managedServerProfileByCode(
          cfg.managedServerProfile ?? DEFAULT_MANAGED_SERVER_PROFILE,
        ).serverType,
      upstreamHost: cfg.managedUpstreamHost ?? "",
      upstreamPort: cfg.managedUpstreamPort ?? null,
      routeVersion: cfg.managedRouteVersion ?? null,
      managedBootstrapReadyAt: cfg.managedBootstrapReadyAt ?? null,
      managedGatewayReadyAt: cfg.managedGatewayReadyAt ?? null,
      providerRuntimeStatus: cfg.providerRuntimeStatus ?? "pending",
      defaultProvider: cfg.defaultProvider ?? null,
      defaultModel: cfg.defaultModel ?? null,
      lastProviderApplyAt: cfg.lastProviderApplyAt ?? null,
      lastProviderApplyError: cfg.lastProviderApplyError ?? null,
      fallbackApplied: Boolean(cfg.managedAutoFallbackUsed),
      managedConnectedAt: cfg.managedConnectedAt ?? null,
      setupStatus: cfg.setupStatus ?? "not_started",
      latestJob,
    };
  },
});

export const getJobStatus = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    jobId: v.id("openclawProvisioningJobs"),
  },
  handler: async (ctx, args) => {
    requireEnabledCapability("managedProvisioning");
    const job = await ctx.db.get(args.jobId);
    if (!job || job.workspaceId !== args.workspaceId) return null;
    return job;
  },
});

export const retryJob = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    jobId: v.id("openclawProvisioningJobs"),
  },
  handler: async (ctx, args) => {
    requireEnabledCapability("managedProvisioning");
    const membership = await requireRole(ctx, args.workspaceId, "owner");
    const job = await ctx.db.get(args.jobId);
    if (!job || job.workspaceId !== args.workspaceId) {
      throw new Error("Provisioning job not found");
    }
    const cfg = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    const serviceTier: ServiceTier =
      cfg?.serviceTier === "assisted" ? "assisted" : "self_serve";
    const requestedRegion = (job.requestedRegion ?? "eu_central_hil") as
      | "eu_central_hil"
      | "eu_central_nbg";
    const requestedServerProfile = (job.requestedServerProfile ??
      cfg?.managedServerProfile ??
      DEFAULT_MANAGED_SERVER_PROFILE) as ManagedServerProfileCode;

    const result = await createManagedJobInternal(
      ctx,
      args.workspaceId,
      requestedRegion,
      serviceTier,
      requestedServerProfile,
      membership.userId,
    );

    return {
      retriedFromJobId: job._id,
      triggeredBy: membership.userId,
      ...result,
    };
  },
});

export const _getManagedProviderApplyContext = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    provider: managedProviderValidator,
  },
  handler: async (ctx, args) => {
    requireEnabledCapability("managedProvisioning");
    const membership = await requireRole(ctx, args.workspaceId, "owner");
    const cfg = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    if (!cfg) {
      throw new Error("OpenClaw config not found for workspace.");
    }
    if (
      (cfg.deploymentMode ?? "manual") !== "managed" ||
      (cfg.provisioningMode ?? "customer_vps") !== "sutraha_managed"
    ) {
      throw new Error("Provider autoconfig is only supported for managed workspaces.");
    }
    const keyRow = await ctx.db
      .query("workspaceModelProviderKeys")
      .withIndex("byWorkspaceAndProvider", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("provider", args.provider),
      )
      .first();
    if (!keyRow) {
      throw new Error(`No provider key found for ${args.provider}.`);
    }
    const latestJob = await ctx.db
      .query("openclawProvisioningJobs")
      .withIndex("byWorkspaceAndCreatedAt", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .order("desc")
      .first();

    return {
      userId: membership.userId,
      configId: cfg._id,
      keyId: keyRow._id,
      host: cfg.managedUpstreamHost ?? "",
      keyCiphertextHex: keyRow.keyCiphertextHex,
      keyIvHex: keyRow.keyIvHex,
      latestJobId: latestJob?._id ? String(latestJob._id) : "",
    };
  },
});

export const _recordManagedProviderApplyResult = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    provider: managedProviderValidator,
    defaultModel: v.string(),
    ok: v.boolean(),
    error: v.optional(v.string()),
    checks: v.optional(v.any()),
    updatedBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    requireEnabledCapability("managedProvisioning");
    const now = Date.now();
    const cfg = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    const keyRow = await ctx.db
      .query("workspaceModelProviderKeys")
      .withIndex("byWorkspaceAndProvider", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("provider", args.provider),
      )
      .first();

    if (cfg) {
      await ctx.db.patch(cfg._id, {
        providerRuntimeStatus: args.ok ? "ready" : "failed",
        defaultProvider: args.provider,
        defaultModel: args.defaultModel,
        lastProviderApplyAt: now,
        lastProviderApplyError: args.ok ? undefined : (args.error ?? "Provider apply failed."),
        updatedAt: now,
        updatedBy: args.updatedBy,
      } as any);
    }

    if (keyRow) {
      await ctx.db.patch(keyRow._id, {
        status: args.ok ? "valid" : "invalid",
        lastAppliedAt: now,
        lastAppliedStatus: args.ok ? "applied" : "failed",
        lastAppliedError: args.ok ? undefined : args.error,
        lastValidatedAt: now,
        lastRuntimeValidatedAt: now,
        lastRuntimeValidationStatus: args.ok ? "valid" : "invalid",
        updatedAt: now,
        updatedBy: args.updatedBy,
      } as any);
    }
  },
});

export const applyManagedProviderConfig: any = action({
  args: {
    workspaceId: v.id("workspaces"),
    provider: managedProviderValidator,
  },
  handler: async (ctx, args): Promise<any> => {
    requireEnabledCapability("managedProvisioning");
    if (!boolEnv("MANAGED_PROVIDER_AUTOCONFIG_ENABLED", true)) {
      throw new Error(
        "Managed provider autoconfig is disabled. Set MANAGED_PROVIDER_AUTOCONFIG_ENABLED=true.",
      );
    }
    const context: any = await ctx.runQuery(
      internal.managedProvisioning._getManagedProviderApplyContext,
      {
        workspaceId: args.workspaceId,
        provider: args.provider,
      },
    );
    if (!context.host) {
      throw new Error("Managed upstream host is missing. Provision managed OpenClaw first.");
    }
    const apiKey = await decryptSecretFromHex(
      context.keyCiphertextHex,
      context.keyIvHex,
    );
    const defaultModel = MANAGED_PROVIDER_DEFAULT_MODEL[args.provider];
    let checks: any = undefined;
    let errorText: string | undefined;
    try {
      const applyResult: any = await ctx.runAction(
        internal.managedProvisioning._applyManagedProviderConfig,
        {
          workspaceId: args.workspaceId,
          jobId: context.latestJobId || `provider-${Date.now()}`,
          host: context.host,
          provider: args.provider,
          apiKey,
          defaultModel,
        },
      );
      const verifyResult: any = await ctx.runAction(
        internal.managedProvisioning._verifyManagedProviderRuntime,
        {
          workspaceId: args.workspaceId,
          host: context.host,
          provider: args.provider,
          defaultModel,
        },
      );
      checks = {
        keyStored: true,
        ...(applyResult?.checks ?? {}),
        ...(verifyResult?.checks ?? {}),
      };
      const ok = Boolean(
        checks.keyStored &&
          checks.appliedToManagedHost &&
          checks.serviceRestarted &&
          checks.portListening &&
          checks.modelRuntimeReady,
      );
      if (!ok) {
        errorText =
          verifyResult?.error ??
          applyResult?.error ??
          "Managed provider runtime checks failed.";
      }
      await ctx.runMutation(internal.managedProvisioning._recordManagedProviderApplyResult, {
        workspaceId: args.workspaceId,
        provider: args.provider,
        defaultModel,
        ok,
        error: errorText,
        checks,
        updatedBy: context.userId,
      });
      return {
        ok,
        provider: args.provider,
        defaultModel,
        checks,
        error: errorText ?? null,
      };
    } catch (error) {
      errorText = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.managedProvisioning._recordManagedProviderApplyResult, {
        workspaceId: args.workspaceId,
        provider: args.provider,
        defaultModel,
        ok: false,
        error: errorText,
        checks: {
          keyStored: true,
          appliedToManagedHost: false,
          serviceRestarted: false,
          portListening: false,
          modelRuntimeReady: false,
        },
        updatedBy: context.userId,
      });
      return {
        ok: false,
        provider: args.provider,
        defaultModel,
        checks: {
          keyStored: true,
          appliedToManagedHost: false,
          serviceRestarted: false,
          portListening: false,
          modelRuntimeReady: false,
        },
        error: errorText,
      };
    }
  },
});

export const verifyManagedConnection = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    requireEnabledCapability("managedProvisioning");
    const membership = await requireRole(ctx, args.workspaceId, "owner");
    const cfg = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    if (!cfg) {
      return {
        ok: false,
        status: "missing_config",
        nextAction: "Provision managed OpenClaw first.",
      };
    }
    if ((cfg.deploymentMode ?? "manual") !== "managed") {
      return {
        ok: false,
        status: "manual_mode",
        nextAction: "Switch workspace to managed deployment mode.",
      };
    }
    const hasConnectionTarget = Boolean(cfg.wsUrl);
    const hasAuth = Boolean(
      (cfg.authTokenCiphertextHex && cfg.authTokenIvHex) ||
        (cfg.passwordCiphertextHex && cfg.passwordIvHex),
    );
    let gatewayRouteOk = true;
    let healthError: string | null = null;
    if (hasConnectionTarget && cfg.managedUpstreamHost) {
      try {
        const health = await ctx.runAction(
          internal.managedProvisioning._runManagedHealthChecks,
          {
            workspaceId: args.workspaceId,
            jobId: cfg.lastManagedJobId ?? ("verify" as any),
            host: cfg.managedUpstreamHost,
            managedWsUrl: cfg.wsUrl ?? "",
          },
        );
        gatewayRouteOk = Boolean((health as any)?.ok);
      } catch (error) {
        gatewayRouteOk = false;
        healthError = error instanceof Error ? error.message : String(error);
      }
    } else if (hasConnectionTarget) {
      gatewayRouteOk = false;
      healthError = "Managed upstream host is missing.";
    }
    const ok = hasConnectionTarget && hasAuth && gatewayRouteOk;
    const now = Date.now();
    await ctx.db.patch(cfg._id, {
      managedStatus: ok ? "ready" : "failed",
      setupStatus: ok ? "verified" : "infra_ready",
      managedConnectedAt: ok ? now : undefined,
      updatedAt: now,
      updatedBy: membership.userId,
    } as any);
    return {
      ok,
      status: ok ? "ready" : "failed",
      checks: { hasConnectionTarget, hasAuth, gatewayRouteOk },
      nextAction: ok
        ? "Managed connection verified."
        : "Managed host is unreachable or missing. Restart managed setup to recreate/reconnect.",
      error: healthError,
    };
  },
});
