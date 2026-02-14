"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/EmptyState";
import { Check, Copy, Sparkles } from "lucide-react";
import {
  AGENT_RECIPES,
  buildAgentRecipePrompt,
  type AgentRecipe,
} from "@/lib/agentRecipes";
import { setChatDraft } from "@/lib/chatDraft";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function AgentRecipeWizard() {
  const { workspaceId, workspace, canAdmin } = useWorkspace();
  const router = useRouter();
  const agents =
    useQuery(api.agents.list, canAdmin ? { workspaceId, includeArchived: true } : "skip") ??
    [];
  const createAgent = useMutation(api.agents.create);

  const [selectedId, setSelectedId] = useState<AgentRecipe["id"]>("research");
  const recipe = useMemo(() => {
    return AGENT_RECIPES.find((r) => r.id === selectedId) ?? AGENT_RECIPES[0];
  }, [selectedId]);

  const [agentName, setAgentName] = useState(recipe.title);
  const [agentEmoji, setAgentEmoji] = useState(recipe.defaultEmoji);
  const [agentRole, setAgentRole] = useState(recipe.defaultRole);
  const [spec, setSpec] = useState("");

  const existingSessionKeys = useMemo(() => {
    return new Set(agents.map((a: any) => a.sessionKey));
  }, [agents]);

  const defaultSessionKey = useMemo(() => {
    const base = slugify(agentName || recipe.title || "agent");
    return `agent:${base}:main`;
  }, [agentName, recipe.title]);
  const [sessionKey, setSessionKey] = useState(defaultSessionKey);

  // Keep sessionKey in sync when user hasn't edited it manually.
  const [sessionKeyTouched, setSessionKeyTouched] = useState(false);
  useEffect(() => {
    if (sessionKeyTouched) return;
    setSessionKey((prev) => (prev !== defaultSessionKey ? defaultSessionKey : prev));
  }, [defaultSessionKey, sessionKeyTouched]);

  const prompt = useMemo(() => {
    return buildAgentRecipePrompt({
      workspaceName: workspace.name,
      workspaceId: String(workspaceId),
      agentName: agentName.trim() || recipe.title,
      sessionKey: sessionKey.trim() || defaultSessionKey,
      recipe,
      spec,
    });
  }, [
    workspace.name,
    workspaceId,
    agentName,
    sessionKey,
    defaultSessionKey,
    recipe,
    spec,
  ]);

  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const collision = sessionKey.trim().length > 0 && existingSessionKeys.has(sessionKey.trim());

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const onCreate = async () => {
    if (!canAdmin) return;
    if (creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const id = await createAgent({
        workspaceId,
        name: agentName.trim() || recipe.title,
        role: agentRole.trim() || recipe.defaultRole,
        emoji: agentEmoji.trim() || recipe.defaultEmoji,
        sessionKey: sessionKey.trim() || defaultSessionKey,
        externalAgentId: sessionKey.trim() || defaultSessionKey,
      });

      // Prefill the chat input so users can send this as the first message if
      // they want, or use it as a copy buffer.
      setChatDraft({
        workspaceId: String(workspaceId),
        sessionKey: sessionKey.trim() || defaultSessionKey,
        content: prompt,
      });
      router.push(`/chat/${id}`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  if (!canAdmin) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Agent creation requires owner access"
        description="Ask the workspace owner to create agents."
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-3 sm:p-6">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-text-primary">
            New agent (recipe)
          </h1>
          <p className="mt-1 text-xs text-text-muted">
            Pick a template, fill your spec, then copy the prompt into OpenClaw.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="h-8">
          <Link href="/agents">Back</Link>
        </Button>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-3">
            1) Choose a recipe
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {AGENT_RECIPES.map((r) => {
              const active = r.id === selectedId;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(r.id);
                    setAgentName(r.title);
                    setAgentEmoji(r.defaultEmoji);
                    setAgentRole(r.defaultRole);
                    setSpec("");
                    setSessionKeyTouched(false);
                  }}
                  className={`text-left rounded-xl border p-4 transition-smooth ${
                    active
                      ? "border-accent-orange bg-bg-tertiary"
                      : "border-border-default bg-bg-tertiary hover:border-border-hover"
                  }`}
                >
                  <p className="text-sm font-semibold text-text-primary">
                    {r.title}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">{r.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-3">
            2) Configure agent + spec
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-text-secondary">Name</Label>
              <Input
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="bg-bg-primary border-border-default text-text-primary"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-text-secondary">Emoji</Label>
              <Input
                value={agentEmoji}
                onChange={(e) => setAgentEmoji(e.target.value)}
                className="bg-bg-primary border-border-default text-text-primary"
              />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Label className="text-text-secondary">Role</Label>
            <Input
              value={agentRole}
              onChange={(e) => setAgentRole(e.target.value)}
              className="bg-bg-primary border-border-default text-text-primary"
            />
          </div>

          <div className="mt-4 space-y-2">
            <Label className="text-text-secondary">Session key</Label>
            <Input
              value={sessionKey}
              onChange={(e) => {
                setSessionKeyTouched(true);
                setSessionKey(e.target.value);
              }}
              className="bg-bg-primary border-border-default text-text-primary font-mono text-xs"
            />
            {collision ? (
              <p className="text-xs text-status-blocked">
                This session key already exists in this workspace. Pick a unique one.
              </p>
            ) : (
              <p className="text-[11px] text-text-dim">
                Must match the sessionKey used by OpenClaw for this agent.
              </p>
            )}
          </div>

          <div className="mt-4 space-y-2">
            <Label className="text-text-secondary">Your spec</Label>
            <Textarea
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              rows={6}
              placeholder={recipe.specHint}
              className="bg-bg-primary border-border-default text-text-primary"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                3) Prompt template (copy into OpenClaw)
              </p>
              <p className="mt-1 text-xs text-text-muted">
                Keep your requirements inside <span className="font-mono">SPEC_START</span> /{" "}
                <span className="font-mono">SPEC_END</span>.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void copy()}
              className="h-8 w-8 p-0 text-text-muted hover:text-text-primary hover:bg-bg-hover"
              title={copied ? "Copied" : "Copy"}
            >
              {copied ? (
                <Check className="h-4 w-4 text-status-active" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <pre className="mt-3 max-h-[420px] overflow-auto rounded-lg bg-bg-primary border border-border-default p-3 font-mono text-[11px] text-text-primary whitespace-pre-wrap">
            {prompt}
          </pre>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              className="bg-accent-orange hover:bg-accent-orange/90 text-white"
              onClick={() => void onCreate()}
              disabled={creating || !agentName.trim() || !sessionKey.trim() || collision}
              title={collision ? "Session key must be unique" : "Create agent in Sutraha HQ"}
            >
              {creating ? "Creating..." : "Create agent and open chat"}
            </Button>
            {createError ? (
              <p className="text-xs text-status-blocked">{createError}</p>
            ) : (
              <p className="text-[11px] text-text-dim">
                Tip: One workspace should usually contain multiple agents. Use a new workspace only for isolation (different OpenClaw deployment or members).
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
