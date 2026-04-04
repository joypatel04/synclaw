"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { AGENT_RECIPES, type AgentRecipe } from "@/lib/agentRecipes";
import { AGENT_SETUP_ADVANCED_ENABLED } from "@/lib/features";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function mapOneClickSetupError(code: string | undefined, message: string) {
  switch (code) {
    case "BRIDGE_UNAVAILABLE":
      return "OpenClaw file bridge is unavailable. Verify OpenClaw connection first.";
    case "BRIDGE_WRITE_FAILED":
      return "Could not write required setup files. Check bridge connectivity and retry.";
    case "TEMPLATE_VALIDATION_FAILED":
      return "Template validation failed after setup. Please retry.";
    case "ROLLBACK_FAILED":
      return "Setup failed and rollback was incomplete. Please contact support with this error.";
    case "DUPLICATE_SESSION_KEY":
      return "This session key already exists in this workspace. Pick a unique one.";
    case "AGENT_LIMIT_REACHED":
      return "Agent limit reached for this workspace.";
    default:
      return message;
  }
}

export function AgentRecipeWizard() {
  const { workspaceId, canAdmin } = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const recipeParam = searchParams.get("recipe");
  const agents =
    useQuery(
      api.agents.list,
      canAdmin ? { workspaceId, includeArchived: true } : "skip",
    ) ?? [];
  const createAgentOneClick = useAction(api.agentSetup.createAgentOneClick);
  const createAgentManual = useMutation(api.agents.createManual);

  const [selectedId, setSelectedId] = useState<AgentRecipe["id"]>("research");
  const recipe = useMemo(() => {
    return AGENT_RECIPES.find((r) => r.id === selectedId) ?? AGENT_RECIPES[0];
  }, [selectedId]);

  const [agentName, setAgentName] = useState(recipe.title);
  const [agentEmoji, setAgentEmoji] = useState(recipe.defaultEmoji);
  const [agentRole, setAgentRole] = useState(recipe.defaultRole);

  const applyRecipe = useCallback((r: AgentRecipe) => {
    setSelectedId(r.id);
    setAgentName(r.title);
    setAgentEmoji(r.defaultEmoji);
    setAgentRole(r.defaultRole);
    setSessionKeyTouched(false);
  }, []);

  const appliedQueryRef = useRef(false);
  useEffect(() => {
    if (appliedQueryRef.current) return;
    if (!recipeParam) return;
    const found = AGENT_RECIPES.find((r) => r.id === recipeParam);
    if (!found) return;
    appliedQueryRef.current = true;
    applyRecipe(found);
  }, [recipeParam, applyRecipe]);

  const existingSessionKeys = useMemo(() => {
    return new Set(agents.map((a) => a.sessionKey));
  }, [agents]);

  const defaultSessionKey = useMemo(() => {
    const base = slugify(agentName || recipe.title || "agent");
    return `agent:${base}:main`;
  }, [agentName, recipe.title]);
  const [sessionKey, setSessionKey] = useState(defaultSessionKey);

  const [sessionKeyTouched, setSessionKeyTouched] = useState(false);
  useEffect(() => {
    if (sessionKeyTouched) return;
    setSessionKey((prev) =>
      prev !== defaultSessionKey ? defaultSessionKey : prev,
    );
  }, [defaultSessionKey, sessionKeyTouched]);

  const collision =
    sessionKey.trim().length > 0 && existingSessionKeys.has(sessionKey.trim());

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [manualCreateOk, setManualCreateOk] = useState(false);

  const onCreate = async () => {
    if (!canAdmin) return;
    if (creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const nextSessionKey = sessionKey.trim() || defaultSessionKey;
      const result = (await createAgentOneClick({
        workspaceId,
        name: agentName.trim() || recipe.title,
        role: agentRole.trim() || recipe.defaultRole,
        emoji: agentEmoji.trim() || recipe.defaultEmoji,
        sessionKey: nextSessionKey,
        externalAgentId: nextSessionKey,
        templateId: selectedId,
        source: "recipe",
      })) as
        | { ok: true; agentId: string }
        | { ok: false; code?: string; message: string };
      if (!result.ok) {
        setCreateError(mapOneClickSetupError(result.code, result.message));
        return;
      }
      router.push(`/chat/${result.agentId}`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  const onCreateManual = async () => {
    if (!canAdmin) return;
    if (creating) return;
    setCreating(true);
    setCreateError(null);
    setManualCreateOk(false);
    try {
      const nextSessionKey = sessionKey.trim() || defaultSessionKey;
      await createAgentManual({
        workspaceId,
        name: agentName.trim() || recipe.title,
        role: agentRole.trim() || recipe.defaultRole,
        emoji: agentEmoji.trim() || recipe.defaultEmoji,
        sessionKey: nextSessionKey,
        externalAgentId: nextSessionKey,
      });
      setManualCreateOk(true);
      setTimeout(() => setManualCreateOk(false), 2200);
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
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-text-primary">
            New agent (recipe)
          </h1>
          <p className="mt-1 text-xs text-text-muted">
            Pick a recipe and create a fully configured agent in one click.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {AGENT_SETUP_ADVANCED_ENABLED ? (
            <Button asChild variant="outline" size="sm" className="h-8">
              <Link href="/help/agent-setup">Open Setup Guide</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm" className="h-8">
            <Link href="/agents">Back</Link>
          </Button>
        </div>
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
                  onClick={() => applyRecipe(r)}
                  className={`text-left rounded-xl border p-4 transition-smooth ${
                    active
                      ? "border-accent-orange bg-bg-tertiary"
                      : "border-border-default bg-bg-tertiary hover:border-border-hover"
                  }`}
                >
                  <p className="text-sm font-semibold text-text-primary">
                    {r.title}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    {r.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-3">
            2) Configure agent
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
                This session key already exists in this workspace. Pick a unique
                one.
              </p>
            ) : (
              <p className="text-[11px] text-text-dim">
                Must match the sessionKey used by OpenClaw for this agent.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">
              3) Create and launch
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Synclaw will create the agent, apply canonical setup files, and
              open chat.
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => void onCreate()}
                disabled={
                  creating ||
                  !agentName.trim() ||
                  !sessionKey.trim() ||
                  collision
                }
                title={
                  collision
                    ? "Session key must be unique"
                    : "Create and configure agent"
                }
              >
                {creating ? "Creating..." : "Create & Configure Agent"}
              </Button>
              {AGENT_SETUP_ADVANCED_ENABLED ? (
                <Button
                  variant="outline"
                  onClick={() => void onCreateManual()}
                  disabled={
                    creating ||
                    !agentName.trim() ||
                    !sessionKey.trim() ||
                    collision
                  }
                  title={
                    collision
                      ? "Session key must be unique"
                      : "Create on Convex only (internal debug path)"
                  }
                >
                  {creating ? "Creating..." : "Create on Convex only"}
                </Button>
              ) : null}
            </div>
            {createError ? (
              <p className="text-xs text-status-blocked">{createError}</p>
            ) : manualCreateOk ? (
              <p className="text-xs text-status-active">
                Agent registered. You can start using it immediately from
                OpenClaw.
              </p>
            ) : (
              <p className="text-[11px] text-text-dim">
                One-click writes the canonical setup pack, opens chat, and you
                can customize agent files anytime from Filesystem.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
