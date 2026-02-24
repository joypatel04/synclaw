export const REQUIRED_AGENT_SETUP_FILES = [
  "IDENTITY.md",
  "USER.md",
  "SOUL.md",
  "TOOLS.md",
  "HEARTBEAT.md",
  "AGENTS.md",
  "SYNCLAW_PROTOCOL.md",
] as const;

export type RequiredAgentSetupFile =
  (typeof REQUIRED_AGENT_SETUP_FILES)[number];

export type AgentSetupSource = "template" | "manual" | "chat";

export type AgentSetupRoleModule =
  | "main_orchestrator"
  | "frontend_coding"
  | "specialist_generic";

export type AgentSetupTemplateAgent = {
  id?: string;
  name: string;
  role: string;
  emoji: string;
  sessionKey: string;
  externalAgentId?: string;
  workspaceFolderPath?: string;
};

export type AgentSetupTemplateContext = {
  workspaceId: string;
  workspaceName: string;
  humanName?: string;
  humanTimezone?: string;
  agent: AgentSetupTemplateAgent;
  agents: AgentSetupTemplateAgent[];
  recommendedHeartbeatMinutes: number;
  roleModule: AgentSetupRoleModule;
};

export type AgentSetupTemplateFiles = Record<RequiredAgentSetupFile, string>;
