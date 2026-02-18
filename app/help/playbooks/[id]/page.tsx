"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/EmptyState";
import { Check, Copy, LifeBuoy, Sparkles } from "lucide-react";
import { getPlaybook } from "@/lib/playbooks";
import {
  AGENT_RECIPES,
  buildAgentRecipePrompt,
  type AgentRecipe,
} from "@/lib/agentRecipes";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function CopyBlock({
  id,
  title,
  value,
  copiedId,
  onCopy,
}: {
  id: string;
  title: string;
  value: string;
  copiedId: string | null;
  onCopy: (id: string, value: string) => Promise<void>;
}) {
  const copied = copiedId === id;
  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">
          {title}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void onCopy(id, value)}
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
      <pre className="mt-3 max-h-[360px] overflow-auto rounded-lg bg-bg-primary border border-border-default p-3 font-mono text-[11px] text-text-primary whitespace-pre-wrap">
        {value}
      </pre>
    </div>
  );
}

function PlaybookPageInner() {
  const params = useParams<{ id?: string }>();
  const { workspaceId, workspace } = useWorkspace();
  const playbook = getPlaybook(params?.id);

  const recipe: AgentRecipe | null = useMemo(() => {
    if (!playbook?.recipeId) return null;
    return AGENT_RECIPES.find((r) => r.id === playbook.recipeId) ?? null;
  }, [playbook?.recipeId]);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copy = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const [agentName, setAgentName] = useState<string>(
    recipe?.title ?? playbook?.title ?? "New Agent",
  );
  const [sessionKey, setSessionKey] = useState<string>(() => {
    const base = slugify(recipe?.title ?? playbook?.title ?? "agent");
    return `agent:${base}:main`;
  });
  const [spec, setSpec] = useState("");

  const prompt = useMemo(() => {
    if (!recipe) return "";
    return buildAgentRecipePrompt({
      workspaceName: workspace.name,
      workspaceId: String(workspaceId),
      agentName: agentName.trim() || recipe.title,
      sessionKey: sessionKey.trim() || `agent:${slugify(agentName || recipe.title)}:main`,
      recipe,
      spec,
    });
  }, [recipe, workspace.name, workspaceId, agentName, sessionKey, spec]);

  if (!playbook) {
    return (
      <EmptyState
        icon={LifeBuoy}
        title="Playbook not found"
        description="This playbook id does not exist."
      >
        <Button asChild variant="outline">
          <Link href="/help">Back to resources</Link>
        </Button>
      </EmptyState>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-3 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-orange/15 glow-orange">
              <Sparkles className="h-5 w-5 text-accent-orange" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-text-primary">
                {playbook.title}
              </h1>
              <p className="mt-1 text-xs text-text-muted">
                {playbook.description}
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="h-8">
            <Link href="/help">Back</Link>
          </Button>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
            <h2 className="text-sm font-semibold text-text-primary">
              Step-by-step
            </h2>
            <ol className="mt-3 list-decimal pl-5 space-y-2 text-sm text-text-secondary">
              {playbook.stepByStep.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              {playbook.recipeId ? (
                <Button
                  asChild
                  className="bg-accent-orange hover:bg-accent-orange/90 text-white"
                >
                  <Link href={`/agents/new?recipe=${playbook.recipeId}`}>
                    Create agent (recipe)
                  </Link>
                </Button>
              ) : (
                <Button asChild className="bg-accent-orange hover:bg-accent-orange/90 text-white">
                  <Link href="/settings/openclaw">Open multi-agent guide</Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link href="/agents/health">Check agent health</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
            <h2 className="text-sm font-semibold text-text-primary">
              What good looks like
            </h2>
            <ul className="mt-3 list-disc pl-5 space-y-1 text-sm text-text-secondary">
              {playbook.goodLooksLike.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>

          {recipe ? (
            <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
              <h2 className="text-sm font-semibold text-text-primary">
                SPEC-block prompt generator
              </h2>
              <p className="mt-2 text-xs text-text-muted">
                Fill your requirements in the spec field, then copy the generated prompt into OpenClaw (or send as the agent&apos;s first chat message).
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-text-secondary">Agent name</Label>
                  <Input
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    className="bg-bg-primary border-border-default text-text-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-text-secondary">Session key</Label>
                  <Input
                    value={sessionKey}
                    onChange={(e) => setSessionKey(e.target.value)}
                    className="bg-bg-primary border-border-default text-text-primary font-mono text-xs"
                  />
                  <p className="text-[11px] text-text-dim">
                    Must match the OpenClaw sessionKey for this agent.
                  </p>
                </div>
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

              <div className="mt-4">
                <CopyBlock
                  id="prompt"
                  title="Generated prompt"
                  value={prompt}
                  copiedId={copiedId}
                  onCopy={copy}
                />
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CopyBlock
              id="task"
              title="Starter Task template"
              value={playbook.starterTaskTemplate}
              copiedId={copiedId}
              onCopy={copy}
            />
            <CopyBlock
              id="doc"
              title="Starter Document template"
              value={playbook.starterDocTemplate}
              copiedId={copiedId}
              onCopy={copy}
            />
          </div>
        </div>
      </div>
  );
}

export const dynamic = 'force-dynamic';

export default function PlaybookPage() {
  return (
    <AppLayout>
      <PlaybookPageInner />
    </AppLayout>
  );
}

