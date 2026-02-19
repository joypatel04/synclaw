export type AgentManifestAgent = {
  name: string;
  role: string;
  emoji: string;
  sessionKey: string;
  externalAgentId?: string;
};

export type AgentManifestV1 = {
  version: 1;
  generatedAt: string;
  workspaceId?: string;
  agents: AgentManifestAgent[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function buildAgentManifest(args: {
  workspaceId: string;
  agents: AgentManifestAgent[];
}): AgentManifestV1 {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    workspaceId: args.workspaceId,
    agents: args.agents,
  };
}

export function parseAgentManifest(
  raw: unknown,
): { ok: true; value: AgentManifestV1 } | { ok: false; error: string } {
  if (!isRecord(raw)) return { ok: false, error: "Manifest must be an object." };

  const versionRaw = raw.version;
  const version = versionRaw === 1 ? 1 : null;
  if (version !== 1) {
    return { ok: false, error: "Unsupported manifest version. Expected version=1." };
  }

  const generatedAt = asString(raw.generatedAt) ?? new Date().toISOString();
  const workspaceId = asString(raw.workspaceId) ?? undefined;

  const agentsRaw = raw.agents;
  if (!Array.isArray(agentsRaw)) {
    return { ok: false, error: 'Manifest must include "agents": []' };
  }

  const agents: AgentManifestAgent[] = [];
  for (const entry of agentsRaw) {
    if (!isRecord(entry)) continue;
    const name = asString(entry.name);
    const role = asString(entry.role) ?? "";
    const emoji = asString(entry.emoji) ?? "🤖";
    const sessionKey = asString(entry.sessionKey);
    const externalAgentId = asString(entry.externalAgentId) ?? undefined;
    if (!name || !sessionKey) continue;
    agents.push({ name, role, emoji, sessionKey, externalAgentId });
  }

  if (agents.length === 0) {
    return { ok: false, error: "No valid agents found in manifest." };
  }

  return {
    ok: true,
    value: { version: 1, generatedAt, workspaceId, agents },
  };
}

