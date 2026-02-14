"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import { OpenClawBrowserGatewayClient } from "@/lib/openclaw-gateway-client";
import {
  buildMainAgentBootstrapMessage,
  buildMcpServerConfigTemplate,
  MODEL_STRATEGY_PRESETS,
} from "@/lib/onboardingTemplates";
import { setChatDraft } from "@/lib/chatDraft";
import { Check, Copy, Settings2, Zap } from "lucide-react";

type Protocol = "req" | "jsonrpc";

function parseScopesCsv(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isSafeNextPath(next: string | null): next is string {
  if (!next) return false;
  if (!next.startsWith("/")) return false;
  if (next.startsWith("//")) return false;
  // Root isn't a great post-onboarding destination; default to main chat.
  if (next === "/") return false;
  // Avoid redirect loops or confusing "complete -> onboarding" bounce.
  if (next === "/onboarding" || next.startsWith("/onboarding?")) return false;
  return true;
}

function StepHeader({
  step,
  title,
  done,
  subtitle,
}: {
  step: number;
  title: string;
  subtitle?: string;
  done: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${
            done
              ? "border-status-active/40 bg-status-active/10 text-status-active"
              : "border-border-default bg-bg-tertiary text-text-muted"
          }`}
        >
          {done ? <Check className="h-4 w-4" /> : step}
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary">{title}</p>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {done ? (
        <span className="inline-flex items-center rounded-md bg-status-active/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-status-active">
          Complete
        </span>
      ) : (
        <span className="inline-flex items-center rounded-md bg-text-dim/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-dim">
          Required
        </span>
      )}
    </div>
  );
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
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">
            {title}
          </p>
        </div>
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
      <pre className="mt-3 max-h-[260px] overflow-auto rounded-lg bg-bg-primary border border-border-default p-3 font-mono text-[11px] text-text-primary whitespace-pre-wrap">
        {value}
      </pre>
    </div>
  );
}

export function OnboardingWizard() {
  const { workspaceId, workspace, canAdmin } = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const status = useQuery(api.onboarding.getStatus, { workspaceId });
  const summary = useQuery(api.openclaw.getConfigSummary, { workspaceId });
  const upsertOpenClaw = useMutation(api.openclaw.upsertConfig);
  const createAgent = useMutation(api.agents.create);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copy = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  // Step 1: OpenClaw

  const [wsUrl, setWsUrl] = useState("");
  const [tokenDraft, setTokenDraft] = useState("");
  const [passwordDraft, setPasswordDraft] = useState("");
  const [protocol, setProtocol] = useState<Protocol>("req");
  const [clientId, setClientId] = useState("cli");
  const [clientMode, setClientMode] = useState("webchat");
  const [clientPlatform, setClientPlatform] = useState("web");
  const [role, setRole] = useState("operator");
  const [scopesCsv, setScopesCsv] = useState(
    "operator.read,operator.write,operator.admin",
  );
  const [subscribeOnConnect, setSubscribeOnConnect] = useState(true);
  const [subscribeMethod, setSubscribeMethod] = useState("chat.subscribe");
  const [includeCron, setIncludeCron] = useState(true);
  const [historyPollMs, setHistoryPollMs] = useState("10000");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    | { status: "idle" }
    | { status: "ok"; message: string }
    | { status: "error"; message: string }
  >({ status: "idle" });

  useEffect(() => {
    if (!summary) return;
    setWsUrl(summary.wsUrl ?? "");
    setProtocol((summary.protocol as Protocol) ?? "req");
    setClientId(summary.clientId ?? "cli");
    setClientMode(summary.clientMode ?? "webchat");
    setClientPlatform(summary.clientPlatform ?? "web");
    setRole(summary.role ?? "operator");
    setScopesCsv((summary.scopes ?? []).join(",") || scopesCsv);
    setSubscribeOnConnect(Boolean(summary.subscribeOnConnect));
    setSubscribeMethod(summary.subscribeMethod ?? "chat.subscribe");
    setIncludeCron(Boolean(summary.includeCron));
    setHistoryPollMs(String(summary.historyPollMs ?? 0));
    setTokenDraft("");
    setPasswordDraft("");
    setTestResult({ status: "idle" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary?.updatedAt]);

  const scopes = useMemo(() => parseScopesCsv(scopesCsv), [scopesCsv]);

  const step1Done = Boolean(status?.openclawConfigured);
  const step2Done = Boolean(status?.mainAgentId);

  const onTestAndSave = async () => {
    setTesting(true);
    setTestResult({ status: "idle" });
    try {
      if (!wsUrl.trim()) throw new Error("WebSocket URL is required.");

      const client = new OpenClawBrowserGatewayClient(
        {
          wsUrl: wsUrl.trim(),
          protocol,
          authToken: tokenDraft.trim() ? tokenDraft.trim() : undefined,
          password: passwordDraft.trim() ? passwordDraft.trim() : undefined,
          clientId,
          clientMode,
          clientPlatform,
          role,
          scopes,
          subscribeOnConnect,
          subscribeMethod,
        },
        async () => {},
      );

      try {
        await client.connect();

        // Best-effort health request (different gateways use different method names).
        const candidates = ["health.get", "health", "gateway.health"];
        for (const method of candidates) {
          try {
            await client.request(method, {});
            break;
          } catch {
            // try next
          }
        }
      } finally {
        await client.disconnect().catch(() => {});
      }

      await upsertOpenClaw({
        workspaceId,
        wsUrl: wsUrl.trim(),
        protocol,
        clientId,
        clientMode,
        clientPlatform,
        role,
        scopes,
        subscribeOnConnect,
        subscribeMethod,
        includeCron,
        historyPollMs: Number(historyPollMs || "0"),
        authToken: tokenDraft.trim() ? tokenDraft.trim() : undefined,
        password: passwordDraft.trim() ? passwordDraft.trim() : undefined,
      });

      setTokenDraft("");
      setPasswordDraft("");
      setTestResult({ status: "ok", message: "Connected and saved." });
    } catch (e) {
      setTestResult({
        status: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setTesting(false);
    }
  };

  // Step 2: Main Agent

  const [mainName, setMainName] = useState("Jarvis");
  const [mainEmoji, setMainEmoji] = useState("🦊");
  const [mainRole, setMainRole] = useState("Squad Lead");
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const bootstrapPrompt = useMemo(() => {
    return buildMainAgentBootstrapMessage({
      workspaceName: workspace.name,
      workspaceId: String(workspaceId),
    });
  }, [workspace.name, workspaceId]);

  const mcpConfigTemplate = useMemo(() => {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
    return buildMcpServerConfigTemplate({
      workspaceId: String(workspaceId),
      convexUrl,
      convexSiteUrl,
    });
  }, [workspaceId]);

  const redirectAfterComplete = (mainAgentId: string) => {
    const dest = isSafeNextPath(next) ? next : `/chat/${mainAgentId}`;
    router.replace(dest);
  };

  // Auto-redirect as soon as onboarding becomes complete.
  useEffect(() => {
    if (!canAdmin) return;
    if (!status || !status.isComplete || !status.mainAgentId) return;
    setChatDraft({
      workspaceId: String(workspaceId),
      sessionKey: "agent:main:main",
      content: bootstrapPrompt,
    });
    redirectAfterComplete(String(status.mainAgentId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAdmin, status?.isComplete, status?.mainAgentId, bootstrapPrompt, workspaceId]);

  if (!canAdmin) {
    return (
      <EmptyState
        icon={Settings2}
        title="Workspace setup requires owner access"
        description="Ask the workspace owner to finish onboarding."
      />
    );
  }

  if (status === undefined || summary === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent-orange border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-3 sm:p-6">
      <div className="flex items-start gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-orange/15 glow-orange">
          <Zap className="h-5 w-5 text-accent-orange" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-text-primary">
            Workspace setup
          </h1>
          <p className="mt-0.5 text-xs text-text-muted">
            Connect OpenClaw, create your main agent, then start chatting.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Step 1 */}
        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
            <StepHeader
              step={1}
              title="Connect OpenClaw"
              subtitle="We'll test the gateway connection, then save it to this workspace."
              done={step1Done}
            />

          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label className="text-text-secondary">WebSocket URL</Label>
              <Input
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
                placeholder="wss://your-openclaw.example.com"
                className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
              />
              <p className="text-[11px] text-text-dim">
                Make sure this origin is allowed in OpenClaw:
                <span className="ml-1 font-mono text-text-muted">{origin}</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-text-secondary">Auth token</Label>
              <Input
                value={tokenDraft}
                onChange={(e) => setTokenDraft(e.target.value)}
                placeholder="Paste your OpenClaw token..."
                className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim font-mono text-xs"
              />
              <p className="text-[11px] text-text-dim">
                This will be stored encrypted at rest in Convex, but is visible to
                the browser at runtime for direct WebSocket chat.
              </p>
            </div>

            <button
              type="button"
              className="text-xs font-medium text-text-muted hover:text-text-secondary transition-smooth"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? "Hide advanced settings" : "Show advanced settings"}
            </button>

            {showAdvanced ? (
              <div className="rounded-xl border border-border-default bg-bg-tertiary p-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-text-secondary">Protocol</Label>
                    <Select
                      value={protocol}
                      onValueChange={(v) => setProtocol(v as Protocol)}
                    >
                      <SelectTrigger className="bg-bg-primary border-border-default text-text-primary">
                        <SelectValue placeholder="Select protocol" />
                      </SelectTrigger>
                      <SelectContent className="bg-bg-tertiary border-border-default">
                        <SelectItem value="req">req</SelectItem>
                        <SelectItem value="jsonrpc">jsonrpc</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-text-secondary">Role</Label>
                    <Input
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="operator"
                      className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-text-secondary">Scopes (comma-separated)</Label>
                  <Input
                    value={scopesCsv}
                    onChange={(e) => setScopesCsv(e.target.value)}
                    placeholder="operator.read,operator.write"
                    className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim font-mono text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="text-text-secondary">Client ID</Label>
                    <Input
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="cli"
                      className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-text-secondary">Mode</Label>
                    <Input
                      value={clientMode}
                      onChange={(e) => setClientMode(e.target.value)}
                      placeholder="webchat"
                      className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-text-secondary">Platform</Label>
                    <Input
                      value={clientPlatform}
                      onChange={(e) => setClientPlatform(e.target.value)}
                      placeholder="web"
                      className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-text-secondary">Password (optional)</Label>
                  <Input
                    value={passwordDraft}
                    onChange={(e) => setPasswordDraft(e.target.value)}
                    placeholder="Optional password mode..."
                    className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim font-mono text-xs"
                  />
                </div>

                <div className="space-y-4">
                  <label className="flex items-center gap-2 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={subscribeOnConnect}
                      onChange={(e) => setSubscribeOnConnect(e.target.checked)}
                      className="h-4 w-4 accent-accent-orange"
                    />
                    Subscribe on connect
                  </label>
                  <div className="space-y-2">
                    <Label className="text-text-secondary">Subscribe method</Label>
                    <Input
                      value={subscribeMethod}
                      onChange={(e) => setSubscribeMethod(e.target.value)}
                      placeholder="chat.subscribe"
                      className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim font-mono text-xs"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={includeCron}
                      onChange={(e) => setIncludeCron(e.target.checked)}
                      className="h-4 w-4 accent-accent-orange"
                    />
                    Include cron/heartbeat sessions in chat
                  </label>

                  <div className="space-y-2">
                    <Label className="text-text-secondary">History poll (ms)</Label>
                    <Input
                      value={historyPollMs}
                      onChange={(e) => setHistoryPollMs(e.target.value)}
                      placeholder="10000"
                      className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim font-mono text-xs"
                    />
                    <p className="text-[11px] text-text-dim">
                      Used to hydrate tool calls and missed messages via{" "}
                      <code className="font-mono">chat.history</code>.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                onClick={() => void onTestAndSave()}
                disabled={testing}
                className="bg-accent-orange hover:bg-accent-orange/90 text-white"
              >
                {testing ? "Testing..." : "Test & Save"}
              </Button>
              {testResult.status !== "idle" ? (
                <div
                  className={`rounded-xl border px-3 py-2 text-xs ${
                    testResult.status === "ok"
                      ? "border-status-active/40 bg-status-active/10 text-status-active"
                      : "border-status-blocked/40 bg-status-blocked/10 text-status-blocked"
                  }`}
                >
                  {testResult.message}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div
          className={`rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6 ${
            !step1Done ? "opacity-60" : ""
          }`}
        >
          <StepHeader
            step={2}
            title="Create main agent"
            subtitle='Creates the canonical main agent sessionKey "agent:main:main".'
            done={step2Done}
          />

          <div className="mt-5 space-y-4">
            {!step1Done ? (
              <p className="text-xs text-text-muted">
                Complete Step 1 first (OpenClaw connection) to unlock agent creation.
              </p>
            ) : status?.mainAgentId ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-text-muted">
                  Main agent already exists for this workspace.
                </p>
                <Button
                  className="bg-teal hover:bg-teal/90 text-white"
                  onClick={() => redirectAfterComplete(String(status.mainAgentId))}
                >
                  Go to chat
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-text-secondary">Agent name</Label>
                    <Input
                      value={mainName}
                      onChange={(e) => setMainName(e.target.value)}
                      placeholder="Jarvis"
                      className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-text-secondary">Emoji</Label>
                    <Input
                      value={mainEmoji}
                      onChange={(e) => setMainEmoji(e.target.value)}
                      placeholder="🦊"
                      className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-text-secondary">Role</Label>
                  <Input
                    value={mainRole}
                    onChange={(e) => setMainRole(e.target.value)}
                    placeholder="Squad Lead"
                    className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-text-secondary">Session key</Label>
                  <Input
                    value="agent:main:main"
                    readOnly
                    className="bg-bg-primary border-border-default text-text-muted font-mono text-xs"
                  />
                </div>

                {createError ? (
                  <p className="text-xs text-status-blocked">{createError}</p>
                ) : null}

                <Button
                  disabled={creatingAgent || !mainName.trim()}
                  className="bg-accent-orange hover:bg-accent-orange/90 text-white"
                  onClick={() => {
                    if (creatingAgent) return;
                    setCreatingAgent(true);
                    setCreateError(null);
                    void (async () => {
                      try {
                        const id = await createAgent({
                          workspaceId,
                          name: mainName.trim(),
                          role: mainRole.trim() || "Squad Lead",
                          emoji: mainEmoji.trim() || "🦊",
                          sessionKey: "agent:main:main",
                          externalAgentId: "agent:main:main",
                        });
                        setChatDraft({
                          workspaceId: String(workspaceId),
                          sessionKey: "agent:main:main",
                          content: bootstrapPrompt,
                        });
                        redirectAfterComplete(String(id));
                      } catch (e) {
                        setCreateError(e instanceof Error ? e.message : String(e));
                      } finally {
                        setCreatingAgent(false);
                      }
                    })();
                  }}
                >
                  {creatingAgent ? "Creating..." : "Create main agent"}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Optional: Next steps */}
        {step2Done ? (
          <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Settings2 className="h-4 w-4 text-text-muted" />
              <p className="text-sm font-semibold text-text-primary">
                Next steps (optional)
              </p>
            </div>

            <div className="space-y-4">
              <CopyBlock
                id="bootstrap"
                title="Main Agent Bootstrap Prompt"
                value={bootstrapPrompt}
                copiedId={copiedId}
                onCopy={copy}
              />

              <CopyBlock
                id="mcporter"
                title="MCPorter Config (Sutraha HQ MCP Server)"
                value={mcpConfigTemplate}
                copiedId={copiedId}
                onCopy={copy}
              />

              <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-3">
                  Model strategy presets
                </p>
                <div className="space-y-3">
                  {MODEL_STRATEGY_PRESETS.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl border border-border-default bg-bg-tertiary p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-text-primary">
                          {p.title}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void copy(`preset:${p.id}`, p.body)}
                          className="h-8 w-8 p-0 text-text-muted hover:text-text-primary hover:bg-bg-hover"
                          title={copiedId === `preset:${p.id}` ? "Copied" : "Copy"}
                        >
                          {copiedId === `preset:${p.id}` ? (
                            <Check className="h-4 w-4 text-status-active" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <Textarea
                        readOnly
                        value={p.body}
                        className="mt-3 bg-bg-primary border-border-default text-text-primary font-mono text-[11px] leading-relaxed"
                        rows={8}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border-default bg-bg-tertiary p-4">
                <p className="text-xs text-text-muted">
                  Tip: These are also available later in{" "}
                  <span className="font-medium text-text-secondary">
                    Settings -&gt; OpenClaw
                  </span>
                  .
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
