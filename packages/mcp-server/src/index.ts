#!/usr/bin/env node
/**
 * Synclaw MCP Server
 *
 * Connects AI agents (OpenClaw, etc.) to the Synclaw orchestration dashboard
 * via the Model Context Protocol (MCP).
 *
 * Usage:
 *   CONVEX_URL=... CONVEX_SITE_URL=... SUTRAHA_API_KEY=... SUTRAHA_WORKSPACE_ID=... npx @sutraha/mcp-server
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { api } from "./api.js";
import { createClientFromEnv } from "./convex-client.js";

const MCP_SERVER_VERSION = "0.6.5";
const MCP_PROTOCOL_VERSION = "0.1.0";
const MCP_SESSION_KEY_MODE = "sessionKey_preferred";

const client = createClientFromEnv();

type TaskRow = {
  _id: string;
};

async function resolveAgentId(input: {
  agentId?: string;
  sessionKey?: string;
}): Promise<string> {
  const { agentId, sessionKey } = input;

  if (sessionKey) {
    const agent = await client.query(api.agents.getBySessionKey, {
      sessionKey,
    });
    if (!agent?._id) {
      throw new Error(
        `Agent not found for sessionKey=${sessionKey}. Register the agent in Synclaw first.`,
      );
    }
    return agent._id as string;
  }

  if (agentId) {
    const agent = await client.query(api.agents.getById, { id: agentId });
    if (!agent?._id) {
      throw new Error(
        `Agent not found for agentId=${agentId}. This usually means you're using a stale ID or pointing at the wrong Convex deployment.`,
      );
    }
    return agent._id as string;
  }

  throw new Error("Missing agent identity. Provide sessionKey (preferred).");
}

const server = new McpServer({
  name: "sutraha-hq",
  version: MCP_SERVER_VERSION,
});

// ═══════════════════════════════════════════════════════════
//  Agent Tools
// ═══════════════════════════════════════════════════════════

server.tool(
  "sutraha_get_server_info",
  "Get Sutraha MCP server compatibility info (version, protocol, and feature flags). Call this once at startup to detect mismatches.",
  {},
  async () => {
    const info = {
      serverName: "sutraha-hq",
      mcpServerVersion: MCP_SERVER_VERSION,
      protocolVersion: MCP_PROTOCOL_VERSION,
      identityMode: MCP_SESSION_KEY_MODE,
      deprecatedInputFields: ["agentId"],
      capabilities: {
        supportsSessionKey: true,
        supportsAgentPulse: true,
        supportsHeartbeat: true,
        supportsStartEndTaskSession: true,
      },
      recommendations: {
        pinNpxVersion: true,
        preferSessionKey: true,
        keepLocalFiles: ["SYNCLAW_PROTOCOL.md", "HEARTBEAT.md"],
      },
    };
    return {
      content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
    };
  },
);

server.tool(
  "sutraha_list_agents",
  "List all active agents in the workspace",
  {},
  async () => {
    const agents = await client.query(api.agents.list);
    return {
      content: [{ type: "text", text: JSON.stringify(agents, null, 2) }],
    };
  },
);

server.tool(
  "sutraha_get_agent",
  "Get an agent by ID",
  { agentId: z.string().describe("Agent ID") },
  async ({ agentId }) => {
    const agent = await client.query(api.agents.getById, { id: agentId });
    return {
      content: [{ type: "text", text: JSON.stringify(agent, null, 2) }],
    };
  },
);

server.tool(
  "sutraha_get_agent_by_session_key",
  "Find an agent by its session key",
  { sessionKey: z.string().describe("Agent session key") },
  async ({ sessionKey }) => {
    const agent = await client.query(api.agents.getBySessionKey, {
      sessionKey,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(agent, null, 2) }],
    };
  },
);

server.tool(
  "sutraha_create_agent",
  "Create/register a new agent. By default this is registration-only (no setup task). Set createSetupTask=true to also generate the setup checklist task. Requires workspace admin or owner.",
  {
    workspaceId: z
      .string()
      .optional()
      .describe(
        "Target workspace ID. Defaults to SUTRAHA_WORKSPACE_ID from MCP server env.",
      ),
    name: z.string().describe("Display name for the agent"),
    role: z
      .string()
      .describe(
        "Short role description (e.g. 'Backend engineer', 'Code reviewer')",
      ),
    emoji: z.string().optional().describe("Emoji for the agent (default: 🤖)"),
    sessionKey: z
      .string()
      .optional()
      .describe(
        "Unique session key (e.g. agent:main:main). Defaults to agent:<slug(name)>:main",
      ),
    externalAgentId: z
      .string()
      .optional()
      .describe("External system agent ID for linking"),
    createSetupTask: z
      .boolean()
      .optional()
      .describe(
        "When true, creates the setup checklist task in Sutraha. Defaults to false.",
      ),
  },
  async ({
    workspaceId,
    name,
    role,
    emoji,
    sessionKey,
    externalAgentId,
    createSetupTask,
  }) => {
    const trimmedName = name.trim();
    const trimmedRole = role.trim();
    if (!trimmedName) {
      throw new Error("Invalid input: name cannot be empty.");
    }
    if (!trimmedRole) {
      throw new Error("Invalid input: role cannot be empty.");
    }

    const trimmedWorkspaceId = workspaceId?.trim();
    if (workspaceId !== undefined && !trimmedWorkspaceId) {
      throw new Error(
        "Invalid input: workspaceId was provided but empty. Omit it to use SUTRAHA_WORKSPACE_ID.",
      );
    }

    const defaultSessionKey = `agent:${trimmedName.toLowerCase().replace(/\s+/g, "-")}:main`;
    const resolvedSessionKey = sessionKey?.trim() || defaultSessionKey;
    const resolvedExternalAgentId = externalAgentId?.trim();
    const createArgs = {
      ...(trimmedWorkspaceId ? { workspaceId: trimmedWorkspaceId } : {}),
      name: trimmedName,
      role: trimmedRole,
      emoji: emoji ?? "🤖",
      sessionKey: resolvedSessionKey,
      ...(resolvedExternalAgentId
        ? { externalAgentId: resolvedExternalAgentId }
        : {}),
    };
    let id: string;
    try {
      id = createSetupTask
        ? await client.mutation(api.agents.create, createArgs)
        : await client.mutation(api.agents.createManual, createArgs);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`sutraha_create_agent failed: ${message}`);
    }
    return {
      content: [
        {
          type: "text",
          text: `Agent created with ID: ${id}. Use sessionKey "${resolvedSessionKey}" to identify this agent in other tools.`,
        },
      ],
    };
  },
);

server.tool(
  "sutraha_update_agent_status",
  "Update an agent's status",
  {
    agentId: z.string().optional().describe("Deprecated: prefer sessionKey"),
    sessionKey: z
      .string()
      .optional()
      .describe("Preferred: agent session key (e.g. agent:main:main)"),
    status: z
      .enum(["active", "idle", "error", "offline"])
      .describe("New status"),
  },
  async ({ agentId, sessionKey, status }) => {
    const id = await resolveAgentId({ agentId, sessionKey });
    await client.mutation(api.agents.updateStatus, { id, status });
    return {
      content: [{ type: "text", text: `Agent status updated to ${status}` }],
    };
  },
);

server.tool(
  "sutraha_agent_heartbeat",
  "Send a heartbeat for an agent to indicate it's alive",
  {
    agentId: z.string().optional().describe("Deprecated: prefer sessionKey"),
    sessionKey: z
      .string()
      .optional()
      .describe("Preferred: agent session key (e.g. agent:main:main)"),
  },
  async ({ agentId, sessionKey }) => {
    const id = await resolveAgentId({ agentId, sessionKey });
    await client.rawMutation(api.agents.updateHeartbeat, { id });
    return { content: [{ type: "text", text: "Heartbeat sent" }] };
  },
);

server.tool(
  "sutraha_agent_pulse",
  "Send a pulse with status and optional telemetry. Use this at startup or during work to indicate you're alive and update your status. This is the 'dead man's switch' — if you don't pulse for 15 minutes, you'll appear offline.",
  {
    agentId: z.string().optional().describe("Deprecated: prefer sessionKey"),
    sessionKey: z
      .string()
      .optional()
      .describe("Preferred: agent session key (e.g. agent:main:main)"),
    status: z
      .enum(["idle", "active", "error", "offline"])
      .describe("Current status"),
    // Back-compat: some agents/tools call with flat fields instead of `telemetry`.
    // If provided, we map these into `telemetry` below.
    currentModel: z
      .string()
      .optional()
      .describe("Deprecated: use telemetry.currentModel"),
    openclawVersion: z
      .string()
      .optional()
      .describe("Deprecated: use telemetry.openclawVersion"),
    totalTokensUsed: z
      .number()
      .optional()
      .describe("Cumulative tokens used by this agent"),
    lastRunDurationMs: z
      .number()
      .optional()
      .describe("Duration of last run in milliseconds"),
    lastRunCost: z.number().optional().describe("Cost of last run in USD"),
    telemetry: z
      .object({
        currentModel: z
          .string()
          .optional()
          .describe("Model name (e.g., 'nvidia-kimi')"),
        openclawVersion: z
          .string()
          .optional()
          .describe("OpenClaw version (e.g., '2026.2.9')"),
        totalTokensUsed: z
          .number()
          .optional()
          .describe("Cumulative tokens used by this agent"),
        lastRunDurationMs: z
          .number()
          .optional()
          .describe("Duration of last run in milliseconds"),
        lastRunCost: z.number().optional().describe("Cost of last run in USD"),
      })
      .optional()
      .describe("Optional telemetry data"),
  },
  async ({
    agentId,
    sessionKey,
    status,
    telemetry,
    currentModel,
    openclawVersion,
    totalTokensUsed,
    lastRunDurationMs,
    lastRunCost,
  }) => {
    const mergedTelemetry =
      telemetry ||
      currentModel ||
      openclawVersion ||
      totalTokensUsed ||
      lastRunDurationMs ||
      lastRunCost
        ? {
            ...(telemetry ?? {}),
            ...(currentModel ? { currentModel } : {}),
            ...(openclawVersion ? { openclawVersion } : {}),
            ...(totalTokensUsed ? { totalTokensUsed } : {}),
            ...(lastRunDurationMs ? { lastRunDurationMs } : {}),
            ...(lastRunCost ? { lastRunCost } : {}),
          }
        : undefined;

    const id = await resolveAgentId({ agentId, sessionKey });
    await client.rawMutation(api.agents.agentPulse, {
      id,
      status,
      telemetry: mergedTelemetry,
    });
    return {
      content: [
        {
          type: "text",
          text: `Pulse sent: status=${status}${mergedTelemetry ? `, telemetry updated` : ""}`,
        },
      ],
    };
  },
);

server.tool(
  "sutraha_start_task_session",
  "Mark that you've started actively working on a task. This links you to the task and logs an activity. Call this when you pick up a task.",
  {
    agentId: z.string().optional().describe("Deprecated: prefer sessionKey"),
    sessionKey: z
      .string()
      .optional()
      .describe("Preferred: agent session key (e.g. agent:main:main)"),
    taskId: z.string().describe("Task ID you're starting work on"),
  },
  async ({ agentId, sessionKey, taskId }) => {
    const resolvedAgentId = await resolveAgentId({ agentId, sessionKey });
    await client.rawMutation(api.agents.startTaskSession, {
      agentId: resolvedAgentId,
      taskId,
    });
    return {
      content: [
        {
          type: "text",
          text: `Task session started: you are now actively working on task ${taskId}`,
        },
      ],
    };
  },
);

server.tool(
  "sutraha_end_task_session",
  "Mark that you've finished your current task session. Clears your currentTaskId and updates status. Call this at the end of every run (success or error).",
  {
    agentId: z.string().optional().describe("Deprecated: prefer sessionKey"),
    sessionKey: z
      .string()
      .optional()
      .describe("Preferred: agent session key (e.g. agent:main:main)"),
    status: z
      .enum(["idle", "error"])
      .describe("Final status (idle = success, error = failed)"),
    telemetry: z
      .object({
        currentModel: z.string().optional().describe("Model name"),
        openclawVersion: z.string().optional().describe("OpenClaw version"),
        totalTokensUsed: z
          .number()
          .optional()
          .describe("Cumulative tokens used"),
        lastRunDurationMs: z
          .number()
          .optional()
          .describe("Duration of this run in milliseconds"),
        lastRunCost: z.number().optional().describe("Cost of this run in USD"),
      })
      .optional()
      .describe("Telemetry from this run"),
    runSummary: z
      .string()
      .optional()
      .describe("Short human-readable summary of what was done"),
  },
  async ({ agentId, sessionKey, status, telemetry, runSummary }) => {
    const resolvedAgentId = await resolveAgentId({ agentId, sessionKey });
    await client.rawMutation(api.agents.endTaskSession, {
      agentId: resolvedAgentId,
      status,
      telemetry,
      runSummary,
    });
    return {
      content: [
        {
          type: "text",
          text: `Task session ended: status=${status}${runSummary ? `, summary: ${runSummary}` : ""}`,
        },
      ],
    };
  },
);

// ═══════════════════════════════════════════════════════════
//  Workspace / Members (human users you can @mention)
// ═══════════════════════════════════════════════════════════

server.tool(
  "sutraha_list_members",
  "List workspace members (human users). Use this to find the owner and others you can @mention when you need human intervention. Use atMention in message content, e.g. include '@Joy' to tag that member.",
  {},
  async () => {
    const members = await client.query(api.workspaces.getMembers);
    const withHandle = members.map(
      (m: { name?: string; email?: string; role: string }) => {
        const displayName = m.name || m.email || "User";
        const firstWord = displayName.trim().split(/\s+/)[0] || displayName;
        const atMention = `@${firstWord}`;
        return { ...m, displayName, atMention, role: m.role };
      },
    );
    return {
      content: [{ type: "text", text: JSON.stringify(withHandle, null, 2) }],
    };
  },
);

// ═══════════════════════════════════════════════════════════
//  Task Tools
// ═══════════════════════════════════════════════════════════

server.tool(
  "sutraha_list_tasks",
  "List tasks in the workspace (use filters to keep context small).",
  {
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Max number of tasks to return (recommended: 20-50)"),
    status: z
      .enum(["inbox", "assigned", "in_progress", "review", "done", "blocked"])
      .optional()
      .describe("Filter by a single status"),
    statuses: z
      .array(
        z.enum([
          "inbox",
          "assigned",
          "in_progress",
          "review",
          "done",
          "blocked",
        ]),
      )
      .optional()
      .describe("Filter by multiple statuses"),
    assigneeId: z
      .string()
      .optional()
      .describe("Filter tasks assigned to this Convex agentId"),
    assigneeSessionKey: z
      .string()
      .optional()
      .describe("Preferred: filter tasks assigned to this agent sessionKey"),
    includeDone: z
      .boolean()
      .optional()
      .describe("If false, exclude done tasks (default: true)"),
    since: z
      .number()
      .optional()
      .describe("Only include tasks updated after this unix ms timestamp"),
  },
  async ({
    limit,
    status,
    statuses,
    assigneeId,
    assigneeSessionKey,
    includeDone,
    since,
  }) => {
    const resolvedAssigneeId = assigneeSessionKey
      ? await resolveAgentId({ sessionKey: assigneeSessionKey })
      : assigneeId;
    const tasks = await client.query(api.tasks.list, {
      limit,
      status,
      statuses,
      assigneeId: resolvedAssigneeId,
      includeDone,
      since,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }],
    };
  },
);

server.tool(
  "sutraha_get_task",
  "Get a task by ID with full details",
  { taskId: z.string().describe("Task ID") },
  async ({ taskId }) => {
    const task = await client.query(api.tasks.getById, { id: taskId });
    return { content: [{ type: "text", text: JSON.stringify(task, null, 2) }] };
  },
);

server.tool(
  "sutraha_get_my_tasks",
  "Get tasks assigned to a specific agent. By default, this returns only tasks updated since you last checked and then marks returned tasks as seen.",
  {
    agentId: z.string().optional().describe("Deprecated: prefer sessionKey"),
    sessionKey: z
      .string()
      .optional()
      .describe("Preferred: agent session key (e.g. agent:main:main)"),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Max tasks to return"),
    status: z
      .enum(["inbox", "assigned", "in_progress", "review", "done", "blocked"])
      .optional(),
    statuses: z
      .array(
        z.enum([
          "inbox",
          "assigned",
          "in_progress",
          "review",
          "done",
          "blocked",
        ]),
      )
      .optional(),
    includeDone: z.boolean().optional(),
    since: z.number().optional(),
  },
  async ({
    agentId,
    sessionKey,
    limit,
    status,
    statuses,
    includeDone,
    since,
  }) => {
    const resolvedAgentId = await resolveAgentId({ agentId, sessionKey });
    const tasks = await client.query(api.tasks.getByAssignee, {
      agentId: resolvedAgentId,
      limit,
      status,
      statuses,
      includeDone,
      since,
      onlyUpdatedSinceLastSeen: true,
    });
    const seenTaskIds = Array.isArray(tasks)
      ? tasks
          .map((row) =>
            row &&
            typeof row === "object" &&
            "_id" in row &&
            typeof (row as TaskRow)._id === "string"
              ? (row as TaskRow)._id
              : null,
          )
          .filter((id): id is string => Boolean(id))
      : [];
    if (seenTaskIds.length > 0) {
      await client.mutation(api.tasks.markSeenByAssignee, {
        agentId: resolvedAgentId,
        taskIds: seenTaskIds,
      });
    }
    return {
      content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }],
    };
  },
);

server.tool(
  "sutraha_create_task",
  "Create a new task in the workspace. Pass your agentId so the activity is attributed to you.",
  {
    title: z.string().describe("Task title"),
    description: z.string().optional().describe("Task description"),
    status: z
      .enum(["inbox", "assigned", "in_progress", "review", "done", "blocked"])
      .optional()
      .describe("Task status (default: inbox)"),
    priority: z
      .enum(["high", "medium", "low", "none"])
      .optional()
      .describe("Priority level (default: medium)"),
    assigneeIds: z.array(z.string()).optional().describe("Agent IDs to assign"),
    agentId: z.string().optional().describe("Deprecated: prefer sessionKey"),
    sessionKey: z
      .string()
      .optional()
      .describe("Preferred: agent session key (for attribution)"),
  },
  async ({
    title,
    description,
    status,
    priority,
    assigneeIds,
    agentId,
    sessionKey,
  }) => {
    const actingAgentId = await resolveAgentId({ agentId, sessionKey });
    const normalizedAssigneeIds = assigneeIds ?? [];
    const normalizedStatus =
      normalizedAssigneeIds.length > 0 &&
      (status === undefined || status === "inbox")
        ? "assigned"
        : (status ?? "inbox");

    const id = await client.mutation(api.tasks.create, {
      title,
      description: description ?? "",
      status: normalizedStatus,
      priority: priority ?? "medium",
      assigneeIds: normalizedAssigneeIds,
      dueAt: null,
      actingAgentId,
    });
    return { content: [{ type: "text", text: `Task created with ID: ${id}` }] };
  },
);

server.tool(
  "sutraha_update_task",
  "Update a task's fields. Pass your agentId so the activity is attributed to you.",
  {
    taskId: z.string().describe("Task ID"),
    title: z.string().optional().describe("New title"),
    description: z.string().optional().describe("New description"),
    priority: z
      .enum(["high", "medium", "low", "none"])
      .optional()
      .describe("New priority"),
    assigneeIds: z.array(z.string()).optional().describe("New assignee IDs"),
    agentId: z.string().optional().describe("Deprecated: prefer sessionKey"),
    sessionKey: z
      .string()
      .optional()
      .describe("Preferred: agent session key (for attribution)"),
  },
  async ({ taskId, agentId, sessionKey, ...updates }) => {
    const actingAgentId = await resolveAgentId({ agentId, sessionKey });
    await client.mutation(api.tasks.update, {
      id: taskId,
      ...updates,
      actingAgentId,
    });
    return { content: [{ type: "text", text: `Task ${taskId} updated` }] };
  },
);

server.tool(
  "sutraha_update_task_status",
  "Change a task's status. Pass your agentId so the activity is attributed to you.",
  {
    taskId: z.string().describe("Task ID"),
    status: z
      .enum(["inbox", "assigned", "in_progress", "review", "done", "blocked"])
      .describe("New status"),
    blockedReason: z
      .string()
      .optional()
      .describe("Optional blocker reason. Used when status is blocked."),
    agentId: z.string().optional().describe("Deprecated: prefer sessionKey"),
    sessionKey: z
      .string()
      .optional()
      .describe("Preferred: agent session key (for attribution)"),
  },
  async ({ taskId, status, blockedReason, agentId, sessionKey }) => {
    const actingAgentId = await resolveAgentId({ agentId, sessionKey });
    await client.mutation(api.tasks.updateStatus, {
      id: taskId,
      status,
      blockedReason,
      actingAgentId,
    });
    return {
      content: [{ type: "text", text: `Task status updated to ${status}` }],
    };
  },
);

// ═══════════════════════════════════════════════════════════
//  Communication Tools
// ═══════════════════════════════════════════════════════════

server.tool(
  "sutraha_list_messages",
  "List comments/messages on a task",
  { taskId: z.string().describe("Task ID") },
  async ({ taskId }) => {
    const messages = await client.query(api.messages.list, { taskId });
    return {
      content: [{ type: "text", text: JSON.stringify(messages, null, 2) }],
    };
  },
);

server.tool(
  "sutraha_send_message",
  "Post a comment on a task (supports @mentions like @Joy or @Jarvis).",
  {
    content: z
      .string()
      .describe("Message content (use @FirstName or @AgentName for mentions)"),
    taskId: z.string().describe("Task ID to comment on"),
    agentId: z.string().optional().describe("Deprecated: prefer sessionKey"),
    sessionKey: z
      .string()
      .optional()
      .describe("Preferred: agent session key (for attribution)"),
  },
  async ({ content, taskId, agentId, sessionKey }) => {
    const resolvedAgentId = await resolveAgentId({ agentId, sessionKey });
    await client.mutation(api.messages.create, {
      content,
      taskId,
      agentId: resolvedAgentId,
    });
    return { content: [{ type: "text", text: "Message sent" }] };
  },
);

server.tool(
  "sutraha_send_chat",
  "DEPRECATED: Synclaw chat is now OpenClaw WS-only. Use OpenClaw chat APIs instead.",
  {
    sessionId: z.string().describe("Unused. Kept for compatibility."),
    content: z.string().describe("Unused. Kept for compatibility."),
  },
  async () => {
    return {
      content: [
        {
          type: "text",
          text: "sutraha_send_chat is deprecated (chat is OpenClaw WS-only).",
        },
      ],
    };
  },
);

// ═══════════════════════════════════════════════════════════
//  Broadcast Tools
// ═══════════════════════════════════════════════════════════

server.tool(
  "sutraha_list_broadcasts",
  "List workspace broadcasts",
  {},
  async () => {
    const broadcasts = await client.query(api.broadcasts.list);
    return {
      content: [{ type: "text", text: JSON.stringify(broadcasts, null, 2) }],
    };
  },
);

server.tool(
  "sutraha_respond_to_broadcast",
  "Respond to a workspace broadcast. Creates a message and links it as a broadcast response.",
  {
    broadcastId: z.string().describe("Broadcast ID"),
    agentId: z.string().optional().describe("Deprecated: prefer sessionKey"),
    sessionKey: z
      .string()
      .optional()
      .describe("Preferred: agent session key (for attribution)"),
    content: z.string().describe("Response content"),
  },
  async ({ broadcastId, agentId, sessionKey, content }) => {
    const resolvedAgentId = await resolveAgentId({ agentId, sessionKey });
    // First create a message attributed to the agent
    const messageId = await client.mutation(api.messages.create, {
      taskId: null,
      agentId: resolvedAgentId,
      content,
    });
    // Then link it to the broadcast
    await client.mutation(api.broadcasts.addResponse, {
      broadcastId,
      messageId,
    });
    return { content: [{ type: "text", text: "Broadcast response sent" }] };
  },
);

// ═══════════════════════════════════════════════════════════
//  Document Tools
// ═══════════════════════════════════════════════════════════

server.tool(
  "sutraha_list_documents",
  "List documents in the workspace",
  {
    taskId: z.string().optional().describe("Filter by task ID"),
    globalOnly: z
      .boolean()
      .optional()
      .describe("If true, only global-context docs are returned"),
    draftsOnly: z
      .boolean()
      .optional()
      .describe("If true, only draft docs are returned"),
  },
  async ({ taskId, globalOnly, draftsOnly }) => {
    const docs = taskId
      ? await client.query(api.documents.getByTask, { taskId })
      : await client.query(api.documents.list, {
          ...(globalOnly ? { isGlobalContext: true } : {}),
          ...(draftsOnly ? { onlyDrafts: true } : {}),
        });
    return { content: [{ type: "text", text: JSON.stringify(docs, null, 2) }] };
  },
);

server.tool(
  "sutraha_upsert_document",
  "Create or update a document in the workspace",
  {
    documentId: z
      .string()
      .optional()
      .describe("Existing document ID to update; omit to create"),
    title: z.string().describe("Document title"),
    content: z.string().describe("Document content (markdown)"),
    type: z
      .enum(["deliverable", "research", "protocol", "note", "journal"])
      .optional()
      .describe("Document type (default: note)"),
    status: z
      .enum(["draft", "final", "archived"])
      .optional()
      .describe("Document status (default: draft)"),
    taskId: z.string().optional().describe("Link to a task"),
    folderId: z.string().optional().describe("Folder ID"),
    agentId: z.string().optional().describe("Deprecated: prefer sessionKey"),
    sessionKey: z
      .string()
      .optional()
      .describe("Preferred: agent session key (for attribution)"),
    isGlobalContext: z
      .boolean()
      .optional()
      .describe("Whether this doc should be injected for all runs"),
  },
  async ({
    documentId,
    title,
    content,
    type,
    status,
    taskId,
    folderId,
    agentId,
    sessionKey,
    isGlobalContext,
  }) => {
    const resolvedAgentId = await resolveAgentId({ agentId, sessionKey });
    const id = await client.mutation(api.documents.upsertDocument, {
      ...(documentId ? { id: documentId } : {}),
      title,
      content,
      type: type ?? "note",
      status: status ?? "draft",
      taskId: taskId ?? null,
      folderId,
      agentId: resolvedAgentId,
      isGlobalContext,
    });
    return {
      content: [
        {
          type: "text",
          text: `${documentId ? "Document updated" : "Document created"} with ID: ${id}`,
        },
      ],
    };
  },
);

// ═══════════════════════════════════════════════════════════
//  Activity Tools
// ═══════════════════════════════════════════════════════════

server.tool(
  "sutraha_get_activities",
  "Get recent activity feed for the workspace",
  {},
  async () => {
    const activities = await client.query(api.activities.recent);
    return {
      content: [{ type: "text", text: JSON.stringify(activities, null, 2) }],
    };
  },
);

server.tool(
  "sutraha_get_activities_by_agent",
  "Get activities with optional filters (agent, type, task, since timestamp)",
  {
    agentId: z
      .string()
      .optional()
      .describe("Filter to activities generated by this agent"),
    types: z
      .array(
        z.enum([
          "task_created",
          "task_updated",
          "message_sent",
          "agent_status",
          "broadcast_sent",
          "mention_alert",
        ]),
      )
      .optional()
      .describe("Filter to specific activity types"),
    taskId: z.string().optional().describe("Filter to one task"),
    since: z
      .number()
      .optional()
      .describe("Only include activities at or after this timestamp (ms)"),
    limit: z.number().optional().describe("Max results (default 50)"),
  },
  async ({ agentId, types, taskId, since, limit }) => {
    const activities = await client.query(api.activities.getByAgent, {
      ...(agentId ? { agentId } : {}),
      ...(types ? { types } : {}),
      ...(taskId ? { taskId } : {}),
      ...(since !== undefined ? { since } : {}),
      ...(limit !== undefined ? { limit } : {}),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(activities, null, 2) }],
    };
  },
);

server.tool(
  "sutraha_get_activities_with_mention",
  "Get activities where the provided agent was @mentioned in message activity metadata",
  {
    agentId: z.string().optional().describe("Deprecated: prefer sessionKey"),
    sessionKey: z
      .string()
      .optional()
      .describe("Preferred: agent session key (e.g. agent:main:main)"),
    since: z
      .number()
      .optional()
      .describe("Only include activities at or after this timestamp (ms)"),
    limit: z.number().optional().describe("Max results (default 50)"),
  },
  async ({ agentId, sessionKey, since, limit }) => {
    const resolvedAgentId = await resolveAgentId({ agentId, sessionKey });
    const activities = await client.query(api.activities.getWithMention, {
      agentId: resolvedAgentId,
      ...(since !== undefined ? { since } : {}),
      ...(limit !== undefined ? { limit } : {}),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(activities, null, 2) }],
    };
  },
);

server.tool(
  "sutraha_get_unseen_activities",
  "Get activities that happened since this agent last acknowledged. Use at startup to catch up on what happened while offline.",
  {
    agentId: z.string().optional().describe("Deprecated: prefer sessionKey"),
    sessionKey: z
      .string()
      .optional()
      .describe("Preferred: agent session key (e.g. agent:main:main)"),
  },
  async ({ agentId, sessionKey }) => {
    const resolvedAgentId = await resolveAgentId({ agentId, sessionKey });
    const activities = await client.query(api.activities.getUnseen, {
      agentId: resolvedAgentId,
    });
    return {
      content: [
        {
          type: "text",
          text:
            activities.length === 0
              ? "No new activities since last acknowledgment."
              : `${activities.length} unseen activities:\n${JSON.stringify(activities, null, 2)}`,
        },
      ],
    };
  },
);

server.tool(
  "sutraha_ack_activities",
  "Acknowledge activities as seen. Call this after processing unseen activities so you don't see them again next time.",
  {
    agentId: z.string().optional().describe("Deprecated: prefer sessionKey"),
    sessionKey: z
      .string()
      .optional()
      .describe("Preferred: agent session key (e.g. agent:main:main)"),
  },
  async ({ agentId, sessionKey }) => {
    const resolvedAgentId = await resolveAgentId({ agentId, sessionKey });
    await client.mutation(api.agents.ackActivities, {
      agentId: resolvedAgentId,
    });
    return {
      content: [
        { type: "text", text: "Activities acknowledged. Watermark updated." },
      ],
    };
  },
);

server.tool(
  "sutraha_ack_specific_activity",
  "Acknowledge only specific activity IDs as seen. Use this when you handled some items but intentionally want to keep others unseen.",
  {
    activityIds: z
      .array(z.string())
      .min(1)
      .describe("Activity IDs to mark seen"),
    agentId: z.string().optional().describe("Deprecated: prefer sessionKey"),
    sessionKey: z
      .string()
      .optional()
      .describe("Preferred: agent session key (e.g. agent:main:main)"),
  },
  async ({ activityIds, agentId, sessionKey }) => {
    const resolvedAgentId = await resolveAgentId({ agentId, sessionKey });
    await client.mutation(api.activities.ackSpecific, {
      agentId: resolvedAgentId,
      activityIds,
    });
    return {
      content: [
        {
          type: "text",
          text: `Acknowledged ${activityIds.length} specific activities.`,
        },
      ],
    };
  },
);

// ═══════════════════════════════════════════════════════════
//  Notification Tools
// ═══════════════════════════════════════════════════════════

server.tool(
  "sutraha_get_notifications",
  "Get undelivered @mention notifications for this agent.",
  {
    agentId: z.string().optional().describe("Deprecated: prefer sessionKey"),
    sessionKey: z
      .string()
      .optional()
      .describe("Preferred: agent session key (e.g. agent:main:main)"),
  },
  async ({ agentId, sessionKey }) => {
    const resolvedAgentId = await resolveAgentId({ agentId, sessionKey });
    const notifications = await client.query(api.notifications.getUndelivered, {
      agentId: resolvedAgentId,
    });
    return {
      content: [
        {
          type: "text",
          text:
            notifications.length === 0
              ? "No pending notifications."
              : `${notifications.length} notifications:\n${JSON.stringify(notifications, null, 2)}`,
        },
      ],
    };
  },
);

server.tool(
  "sutraha_ack_notifications",
  "Mark all @mention notifications as delivered for this agent.",
  {
    agentId: z.string().optional().describe("Deprecated: prefer sessionKey"),
    sessionKey: z
      .string()
      .optional()
      .describe("Preferred: agent session key (e.g. agent:main:main)"),
  },
  async ({ agentId, sessionKey }) => {
    const resolvedAgentId = await resolveAgentId({ agentId, sessionKey });
    await client.mutation(api.notifications.markAllDelivered, {
      agentId: resolvedAgentId,
    });
    return {
      content: [
        { type: "text", text: "All notifications marked as delivered." },
      ],
    };
  },
);

server.tool(
  "sutraha_ack_specific_notification",
  "Mark only specific notification IDs as delivered. Use this when you handled some mentions but want to keep others pending.",
  {
    notificationIds: z
      .array(z.string())
      .min(1)
      .describe("Notification IDs to mark delivered"),
    agentId: z.string().optional().describe("Deprecated: prefer sessionKey"),
    sessionKey: z
      .string()
      .optional()
      .describe("Preferred: agent session key (e.g. agent:main:main)"),
  },
  async ({ notificationIds, agentId, sessionKey }) => {
    const resolvedAgentId = await resolveAgentId({ agentId, sessionKey });
    await client.mutation(api.notifications.markDeliveredMany, {
      agentId: resolvedAgentId,
      notificationIds,
    });
    return {
      content: [
        {
          type: "text",
          text: `Marked ${notificationIds.length} specific notifications as delivered.`,
        },
      ],
    };
  },
);

// ═══════════════════════════════════════════════════════════
//  Start Server
// ═══════════════════════════════════════════════════════════

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Synclaw MCP server running (stdio)");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
