export function buildAgentsMd(args: {
  workspaceName: string;
  workspaceId: string;
  agents: Array<{
    name: string;
    sessionKey: string;
    role: string;
    emoji: string;
    agentId?: string;
  }>;
}) {
  const wsName = args.workspaceName || "Workspace";
  const wsId = args.workspaceId || "<workspaceId>";
  const now = new Date().toISOString().slice(0, 10);

  const rows = args.agents
    .slice()
    .sort((a, b) => a.sessionKey.localeCompare(b.sessionKey))
    .map((a) => {
      const agentId = a.agentId ? `\`${a.agentId}\`` : "(create in Sutraha HQ)";
      return `| ${a.emoji || "🤖"} ${a.name} | \`${a.sessionKey}\` | ${a.role || ""} | ${agentId} | <fill> |`;
    })
    .join("\n");

  return `# AGENTS.md — Sutraha HQ Agent Orchestration

**Workspace:** ${wsName}  
**workspaceId:** \`${wsId}\`  
**Generated:** ${now}

## Agent Identity

| Agent | Session Key | Role | Agent ID (Sutraha HQ) | OpenClaw Workspace Path |
|-------|-------------|------|------------------------|--------------------------|
${rows || "| (none) |  |  |  |  |"}

## Notes
- Each agent is a real agent with its own identity (sessionKey). Never reuse another agent's sessionKey.
- Recommended: each agent has its own OpenClaw workspace directory (separate working directory + memory).
- Keep prompts short: put shared Sutraha HQ operating rules in \`SUTRAHA_PROTOCOL.md\` inside each agent workspace.
- Recommended: one Sutraha HQ workspace contains multiple agents (main + specialists). Create a new workspace only for isolation (different OpenClaw deployment or members).
- For reliability: put a small \`HEARTBEAT.md\` in each agent's OpenClaw workspace and schedule a cron run (15-60 minutes typical depending on role).`;
}
