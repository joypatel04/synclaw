import { buildSynclawProtocolMd } from "../synclawProtocol";
import {
  buildAgentsMd,
  buildIdentityMd,
  buildToolsMd,
  buildUserMd,
  deriveRoleModule,
} from "./common";
import { buildMainAgentHeartbeatMd, buildMainAgentSoulMd } from "./mainAgent";
import {
  buildSpecialistHeartbeatMd,
  buildSpecialistSoulMd,
} from "./specialist";
import type {
  AgentSetupTemplateContext,
  AgentSetupTemplateFiles,
  AgentSetupTemplateAgent,
} from "./types";

function toWorkspaceSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function deriveWorkspaceFolderPath(agent: {
  name: string;
  sessionKey: string;
  workspaceFolderPath?: string;
}): string {
  const explicit = (agent.workspaceFolderPath ?? "").trim();
  if (explicit) return explicit;
  if (agent.sessionKey === "agent:main:main") return "workspace";
  const slug = toWorkspaceSlug(agent.name) || "agent";
  return `workspace-${slug}`;
}

export function buildAgentSetupFiles(
  input: Omit<AgentSetupTemplateContext, "roleModule"> & {
    roleModule?: AgentSetupTemplateContext["roleModule"];
  },
): AgentSetupTemplateFiles {
  const roleModule =
    input.roleModule ??
    deriveRoleModule({
      role: input.agent.role,
      sessionKey: input.agent.sessionKey,
    });

  const context: AgentSetupTemplateContext = {
    ...input,
    roleModule,
    agents: input.agents.map((agent: AgentSetupTemplateAgent) => ({
      ...agent,
      workspaceFolderPath: deriveWorkspaceFolderPath(agent),
    })),
  };

  const soul =
    roleModule === "main_orchestrator"
      ? buildMainAgentSoulMd(context)
      : buildSpecialistSoulMd(context);

  const heartbeat =
    roleModule === "main_orchestrator"
      ? buildMainAgentHeartbeatMd(context)
      : buildSpecialistHeartbeatMd(context);

  return {
    "IDENTITY.md": buildIdentityMd(context.agent),
    "USER.md": buildUserMd(context),
    "SOUL.md": soul,
    "TOOLS.md": buildToolsMd(),
    "HEARTBEAT.md": heartbeat,
    "AGENTS.md": buildAgentsMd({
      workspaceName: context.workspaceName,
      workspaceId: context.workspaceId,
      agents: context.agents,
    }),
    "SYNCLAW_PROTOCOL.md": buildSynclawProtocolMd({
      workspaceName: context.workspaceName,
      workspaceId: context.workspaceId,
    }),
  };
}

export * from "./types";
export { deriveRoleModule } from "./common";
