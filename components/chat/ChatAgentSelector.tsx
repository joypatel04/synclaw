"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { AgentAvatar } from "@/components/shared/AgentAvatar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquare, Settings2 } from "lucide-react";
import Link from "next/link";
import { OpenClawSessionsList } from "./OpenClawSessionsList";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildMainAgentBootstrapMessage } from "@/lib/onboardingTemplates";
import { setChatDraft } from "@/lib/chatDraft";

export function ChatAgentSelector() {
  const { workspaceId, workspace, canEdit, canAdmin } = useWorkspace();
  const router = useRouter();
  const agents = useQuery(api.agents.list, { workspaceId }) ?? [];
  const openclawSummary = useQuery(api.openclaw.getConfigSummary, { workspaceId });
  const createAgent = useMutation(api.agents.create);

  const [showCreateMain, setShowCreateMain] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [mainName, setMainName] = useState("Jarvis");
  const [mainRole, setMainRole] = useState("Squad Lead");
  const [mainEmoji, setMainEmoji] = useState("🦊");

  const hasOpenClaw = Boolean(openclawSummary && openclawSummary.wsUrl);

  const existingMain = useMemo(
    () => agents.find((a) => a.sessionKey === "agent:main:main") ?? null,
    [agents],
  );

  const mainBootstrapPrompt = useMemo(() => {
    return buildMainAgentBootstrapMessage({
      workspaceName: workspace.name,
      workspaceId: String(workspaceId),
    });
  }, [workspace.name, workspaceId]);

  const CreateMainAgentDialog = () => (
    <Dialog
      open={showCreateMain}
      onOpenChange={(open) => {
        setCreateError(null);
        setShowCreateMain(open);
      }}
    >
      <DialogContent className="bg-bg-secondary border-border-default">
        <DialogHeader>
          <DialogTitle>Create main agent</DialogTitle>
          <DialogDescription>
            This will create an agent in Convex and map it to OpenClaw session{" "}
            <span className="font-mono">agent:main:main</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Agent name</Label>
              <Input
                value={mainName}
                onChange={(e) => setMainName(e.target.value)}
                placeholder="Jarvis"
                className="bg-bg-primary border-border-default text-text-primary"
              />
            </div>
            <div className="space-y-2">
              <Label>Emoji</Label>
              <Input
                value={mainEmoji}
                onChange={(e) => setMainEmoji(e.target.value)}
                placeholder="🦊"
                className="bg-bg-primary border-border-default text-text-primary"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Input
              value={mainRole}
              onChange={(e) => setMainRole(e.target.value)}
              placeholder="Squad Lead"
              className="bg-bg-primary border-border-default text-text-primary"
            />
          </div>

          <div className="space-y-2">
            <Label>Session key</Label>
            <Input
              value="agent:main:main"
              readOnly
              className="bg-bg-primary border-border-default text-text-muted font-mono text-xs"
            />
          </div>

          {createError && (
            <p className="text-xs text-status-blocked">{createError}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowCreateMain(false)}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button
            className="bg-accent-orange hover:bg-accent-orange/90 text-white"
            disabled={creating || !mainName.trim()}
            onClick={async () => {
              if (!canAdmin) return;
              setCreating(true);
              setCreateError(null);
              try {
                const id = await createAgent({
                  workspaceId,
                  name: mainName.trim(),
                  role: mainRole.trim() || "Squad Lead",
                  emoji: mainEmoji.trim() || "🦊",
                  sessionKey: "agent:main:main",
                  externalAgentId: "agent:main:main",
                });
                setShowCreateMain(false);
                setChatDraft({
                  workspaceId: String(workspaceId),
                  sessionKey: "agent:main:main",
                  content: mainBootstrapPrompt,
                });
                router.push(`/chat/${id}`);
              } catch (e) {
                setCreateError(e instanceof Error ? e.message : String(e));
              } finally {
                setCreating(false);
              }
            }}
          >
            {creating ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (!canEdit) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="Chat requires member access"
        description="Ask the workspace owner to upgrade your role."
      />
    );
  }

  if (openclawSummary === undefined) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-orange border-t-transparent" />
      </div>
    );
  }

  if (!hasOpenClaw) {
    return (
      <EmptyState
        icon={Settings2}
        title="Connect OpenClaw to start chatting"
        description="Configure your OpenClaw gateway URL and token in Settings."
      >
        <Button
          asChild
          className="bg-accent-orange hover:bg-accent-orange/90 text-white"
        >
          <Link href="/settings/openclaw">Open Settings</Link>
        </Button>
      </EmptyState>
    );
  }

  if (agents.length === 0) {
    return (
      <>
        <EmptyState
          icon={MessageSquare}
          title="Create your first agent"
          description="We’ll create a default main agent mapped to OpenClaw sessionKey: agent:main:main."
        >
          {canAdmin ? (
            <Button
              className="bg-accent-orange hover:bg-accent-orange/90 text-white"
              onClick={() => {
                setCreateError(null);
                setShowCreateMain(true);
              }}
            >
              Create main agent
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href="/settings">Ask owner to create an agent</Link>
            </Button>
          )}
        </EmptyState>

        <CreateMainAgentDialog />
      </>
    );
  }

  // If agents exist but the canonical main agent is missing, provide a small CTA.
  const showCreateMainInline = canAdmin && !existingMain;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-dim">
          Agents
        </p>
        {showCreateMainInline && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-border-default bg-bg-secondary p-3">
            <p className="text-xs text-text-muted">
              Tip: Create a default main agent mapped to{" "}
              <span className="font-mono">agent:main:main</span>.
            </p>
            <Button
              size="sm"
              className="h-8 bg-accent-orange hover:bg-accent-orange/90 text-white"
              onClick={() => {
                setCreateError(null);
                setShowCreateMain(true);
              }}
            >
              Create main
            </Button>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {agents.map((agent) => {
            return (
              <Link key={agent._id} href={`/chat/${agent._id}`} className="block">
                <div className="group flex items-center gap-4 rounded-xl border border-border-default bg-bg-secondary p-4 transition-smooth hover:border-border-hover hover:bg-bg-tertiary">
                  <AgentAvatar emoji={agent.emoji} name={agent.name} size="lg" status={agent.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><h3 className="text-sm font-semibold text-text-primary">{agent.name}</h3><StatusBadge status={agent.status} /></div>
                    <p className="text-xs text-text-muted">{agent.role}</p>
                  </div>
                  <div className="text-text-muted group-hover:text-accent-orange transition-smooth"><MessageSquare className="h-5 w-5" /></div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <OpenClawSessionsList agents={agents} />

      <CreateMainAgentDialog />
    </div>
  );
}
