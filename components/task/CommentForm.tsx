"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers/workspace-provider";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { OpenClawBrowserGatewayClient } from "@/lib/openclaw-gateway-client";
import { buildTaskSpawnPrompt } from "@/lib/taskSpawnPrompt";

interface CommentFormProps {
  taskId: Id<"tasks">;
}

type SpawnPayload = {
  runSessionKey: string;
  canonicalSessionKey: string;
  prompt: string;
  agentName: string;
};

function createRunSessionKey(canonicalSessionKey: string) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${canonicalSessionKey}:run:${suffix}`;
}

export function CommentForm({ taskId }: CommentFormProps) {
  const { workspaceId, canEdit, canManage, membershipId } = useWorkspace();
  const createMessage = useMutation(api.messages.create);
  const task = useQuery(api.tasks.getById, { workspaceId, id: taskId });
  const agents = useQuery(api.agents.list, { workspaceId }) ?? [];
  const members = useQuery(api.workspaces.getMembers, { workspaceId }) ?? [];
  const openclawConfig = useQuery(
    api.openclaw.getClientConfig,
    canEdit ? { workspaceId } : "skip",
  );
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSpawnSubmitting, setIsSpawnSubmitting] = useState(false);
  const [spawnAgentId, setSpawnAgentId] = useState<string>("");
  const [spawnError, setSpawnError] = useState<string | null>(null);
  const [spawnSuccess, setSpawnSuccess] = useState<string | null>(null);
  const [failedSpawn, setFailedSpawn] = useState<SpawnPayload | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!canEdit) return null;

  const me = members.find((m) => m._id === membershipId);
  const actorDisplayName =
    me?.name?.trim() || me?.email?.trim() || "Workspace Operator";

  const eligibleAgents = useMemo(() => {
    const active = agents.filter(
      (a) => a.status === "active" || a.status === "idle",
    );
    if (!task) return active;

    const assignedIds = new Set(task.assigneeIds.map((id) => String(id)));
    const assigned = active.filter((a) => assignedIds.has(String(a._id)));
    const others = active.filter((a) => !assignedIds.has(String(a._id)));
    return [...assigned, ...others];
  }, [agents, task]);

  useEffect(() => {
    if (eligibleAgents.length === 0) {
      setSpawnAgentId("");
      return;
    }
    if (!spawnAgentId || !eligibleAgents.some((a) => a._id === spawnAgentId)) {
      setSpawnAgentId(String(eligibleAgents[0]._id));
    }
  }, [eligibleAgents, spawnAgentId]);

  const postComment = async (commentText: string) => {
    await createMessage({
      workspaceId,
      taskId,
      agentId: null,
      content: commentText,
    });
  };

  const sendSpawn = async (payload: SpawnPayload) => {
    if (!openclawConfig) {
      throw new Error(
        "OpenClaw is not configured. Comment posted, but spawn could not be sent.",
      );
    }
    const client = new OpenClawBrowserGatewayClient(
      {
        wsUrl: openclawConfig.wsUrl,
        protocol: openclawConfig.protocol,
        authToken: openclawConfig.authToken,
        password: openclawConfig.password,
        clientId: openclawConfig.clientId,
        clientMode: openclawConfig.clientMode,
        clientPlatform: openclawConfig.clientPlatform,
        role: openclawConfig.role,
        scopes: openclawConfig.scopes,
        subscribeOnConnect: openclawConfig.subscribeOnConnect,
        subscribeMethod: openclawConfig.subscribeMethod,
      },
      async () => {},
    );
    try {
      await client.connect();
      await client.sendChat({
        sessionKey: payload.runSessionKey,
        content: payload.prompt,
        clientMessageId: `spawn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      });
    } finally {
      await client.disconnect().catch(() => {});
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setIsSubmitting(true);
    try {
      await postComment(content.trim());
      setContent("");
    } catch (error) {
      console.error("Failed to post comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitAndSpawn = async () => {
    if (!canManage) return;
    const commentText = content.trim();
    if (!commentText) return;

    setIsSpawnSubmitting(true);
    setSpawnError(null);
    setSpawnSuccess(null);
    setFailedSpawn(null);

    try {
      await postComment(commentText);
      setContent("");

      if (!task) {
        setSpawnError("Comment posted. Task details are still loading; retry spawn.");
        return;
      }
      const selectedAgent = eligibleAgents.find((a) => a._id === spawnAgentId);
      if (!selectedAgent) {
        setSpawnError(
          "Comment posted. No eligible agent selected for immediate spawn.",
        );
        return;
      }

      const canonicalSessionKey = selectedAgent.sessionKey;
      const runSessionKey = createRunSessionKey(canonicalSessionKey);
      const assigneeNames = agents
        .filter((a) => task.assigneeIds.includes(a._id as Id<"agents">))
        .map((a) => `${a.emoji} ${a.name}`);
      const prompt = buildTaskSpawnPrompt({
        task: {
          _id: task._id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          description: task.description,
          blockedReason: (task as Doc<"tasks"> & { blockedReason?: string })
            .blockedReason,
        },
        selectedAgent,
        taskAssignees: assigneeNames,
        commentContent: commentText,
        actorDisplayName,
        canonicalSessionKey,
        runSessionKey,
      });

      const payload: SpawnPayload = {
        runSessionKey,
        canonicalSessionKey,
        prompt,
        agentName: selectedAgent.name,
      };

      await sendSpawn(payload);
      setSpawnSuccess(`Spawned ${selectedAgent.name} in isolated run session.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSpawnError(`Comment posted. Spawn failed: ${message}`);
      const selectedAgent = eligibleAgents.find((a) => a._id === spawnAgentId);
      if (task && selectedAgent) {
        const canonicalSessionKey = selectedAgent.sessionKey;
        const runSessionKey = createRunSessionKey(canonicalSessionKey);
        const assigneeNames = agents
          .filter((a) => task.assigneeIds.includes(a._id as Id<"agents">))
          .map((a) => `${a.emoji} ${a.name}`);
        const prompt = buildTaskSpawnPrompt({
          task: {
            _id: task._id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            description: task.description,
            blockedReason: (task as Doc<"tasks"> & { blockedReason?: string })
              .blockedReason,
          },
          selectedAgent,
          taskAssignees: assigneeNames,
          commentContent: commentText,
          actorDisplayName,
          canonicalSessionKey,
          runSessionKey,
        });
        setFailedSpawn({
          runSessionKey,
          canonicalSessionKey,
          prompt,
          agentName: selectedAgent.name,
        });
      }
    } finally {
      setIsSpawnSubmitting(false);
    }
  };

  const handleRetrySpawn = async () => {
    if (!failedSpawn) return;
    setIsSpawnSubmitting(true);
    setSpawnError(null);
    setSpawnSuccess(null);
    try {
      await sendSpawn(failedSpawn);
      setSpawnSuccess(`Spawned ${failedSpawn.agentName} in isolated run session.`);
      setFailedSpawn(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSpawnError(`Spawn retry failed: ${message}`);
    } finally {
      setIsSpawnSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);
    const lastAtIndex = value.lastIndexOf("@");
    if (lastAtIndex !== -1 && lastAtIndex === value.length - 1) {
      setShowMentions(true); setMentionFilter("");
    } else if (lastAtIndex !== -1) {
      const afterAt = value.substring(lastAtIndex + 1);
      if (!afterAt.includes(" ")) { setShowMentions(true); setMentionFilter(afterAt.toLowerCase()); }
      else setShowMentions(false);
    } else setShowMentions(false);
  };

  const insertMention = (name: string) => {
    const lastAtIndex = content.lastIndexOf("@");
    setContent(`${content.substring(0, lastAtIndex)}@${name} `);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const filteredAgents = agents.filter((a) =>
    a.name.toLowerCase().includes(mentionFilter),
  );

  return (
    <form onSubmit={handleSubmit} className="relative">
      {showMentions && filteredAgents.length > 0 && (
        <div className="absolute bottom-full mb-1 left-0 w-full rounded-lg border border-border-default bg-bg-tertiary p-1 shadow-lg z-10">
          {filteredAgents.map((agent) => (
            <button key={agent._id} type="button" onClick={() => insertMention(agent.name)}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-text-primary hover:bg-bg-hover transition-smooth">
              <span>{agent.emoji}</span><span className="font-medium">{agent.name}</span><span className="text-text-muted text-xs">{agent.role}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          placeholder="Add a comment... (type @ to mention)"
          rows={2}
          className="flex-1 bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim focus-visible:ring-accent-orange resize-none text-sm"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!content.trim() || isSubmitting || isSpawnSubmitting}
          className="shrink-0 bg-accent-orange hover:bg-accent-orange/90 text-white h-auto"
          title="Send comment"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {canManage ? (
        <div className="mt-2 space-y-2 rounded-lg border border-border-default bg-bg-tertiary p-2.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={spawnAgentId}
              onChange={(e) => setSpawnAgentId(e.target.value)}
              className="h-8 rounded-md border border-border-default bg-bg-primary px-2 text-xs text-text-primary"
              disabled={eligibleAgents.length === 0 || isSpawnSubmitting}
            >
              {eligibleAgents.length === 0 ? (
                <option value="">No active/idle agents available</option>
              ) : (
                eligibleAgents.map((agent) => (
                  <option key={agent._id} value={agent._id}>
                    {agent.emoji} {agent.name} ({agent.status})
                  </option>
                ))
              )}
            </select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={
                !content.trim() ||
                isSubmitting ||
                isSpawnSubmitting ||
                eligibleAgents.length === 0 ||
                !spawnAgentId
              }
              onClick={() => void handleSubmitAndSpawn()}
            >
              {isSpawnSubmitting ? "Posting + Spawning..." : "Comment + Spawn"}
            </Button>
          </div>
          {eligibleAgents.length === 0 ? (
            <p className="text-[11px] text-text-dim">
              No eligible active/idle agents to spawn right now.
            </p>
          ) : (
            <p className="text-[11px] text-text-dim">
              Uses isolated run session (`:run:`). Comment posts first, then
              spawn is triggered.
            </p>
          )}
          {spawnSuccess ? (
            <p className="text-[11px] text-status-active">{spawnSuccess}</p>
          ) : null}
          {spawnError ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] text-status-blocked">{spawnError}</p>
              {failedSpawn ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[11px]"
                  disabled={isSpawnSubmitting}
                  onClick={() => void handleRetrySpawn()}
                >
                  Retry spawn
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
