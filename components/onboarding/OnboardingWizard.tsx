"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/EmptyState";
import { OpenClawBrowserGatewayClient } from "@/lib/openclaw-gateway-client";
import { Check, Settings2, Zap } from "lucide-react";
import { setChatDraft } from "@/lib/chatDraft";
import { buildMainAgentBootstrapMessage } from "@/lib/onboardingTemplates";

type Protocol = "req" | "jsonrpc";

function parseScopesCsv(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
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

export function OnboardingWizard() {
  const { workspaceId, workspace, canAdmin } = useWorkspace();
  const router = useRouter();

  const status = useQuery(api.onboarding.getStatus, { workspaceId });
  const summary = useQuery(api.openclaw.getConfigSummary, { workspaceId });
  const upsertOpenClaw = useMutation(api.openclaw.upsertConfig);
  const createAgent = useMutation(api.agents.create);

  const [wsUrl, setWsUrl] = useState("");
  const [tokenDraft, setTokenDraft] = useState("");
  const [passwordDraft, setPasswordDraft] = useState("");
  const [protocol, setProtocol] = useState<Protocol>("req");
  const [clientId, setClientId] = useState("cli");
  const [clientMode, setClientMode] = useState("operator");
  const [clientPlatform, setClientPlatform] = useState("web");
  const [role, setRole] = useState("operator");
  const [scopesCsv, setScopesCsv] = useState(
    "operator.read,operator.write,operator.admin",
  );
  const [subscribeOnConnect, setSubscribeOnConnect] = useState(true);
  const [subscribeMethod, setSubscribeMethod] = useState("chat.subscribe");
  const [includeCron, setIncludeCron] = useState(true);
  const [historyPollMs, setHistoryPollMs] = useState("10000");

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
    setClientMode(summary.clientMode ?? "operator");
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

  const [mainName, setMainName] = useState("Jarvis");
  const [mainEmoji, setMainEmoji] = useState("🦊");
  const [mainRole, setMainRole] = useState("Squad Lead");
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const mainBootstrap = useMemo(
    () =>
      buildMainAgentBootstrapMessage({
        workspaceName: workspace.name,
        workspaceId: String(workspaceId),
      }),
    [workspace.name, workspaceId],
  );

  const goChatSetup = (mainAgentId: string) => {
    setChatDraft({
      workspaceId: String(workspaceId),
      sessionKey: "agent:main:main",
      content: mainBootstrap,
    });
    router.replace(`/chat/${mainAgentId}?setup=1`);
  };

  useEffect(() => {
    if (!canAdmin) return;
    if (!status || !status.isComplete || !status.mainAgentId) return;
    goChatSetup(String(status.mainAgentId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAdmin, status?.isComplete, status?.mainAgentId]);

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
            Complete prerequisites, then continue setup in Chat.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <StepHeader
            step={1}
            title="Connect OpenClaw"
            subtitle="Test gateway and save configuration."
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
            </div>

            <div className="space-y-2">
              <Label className="text-text-secondary">Auth token</Label>
              <Input
                value={tokenDraft}
                onChange={(e) => setTokenDraft(e.target.value)}
                placeholder="Paste your OpenClaw token..."
                className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-text-secondary">Role</Label>
                <Input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="operator"
                  className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-text-secondary">Scopes</Label>
                <Input
                  value={scopesCsv}
                  onChange={(e) => setScopesCsv(e.target.value)}
                  placeholder="operator.read,operator.write,operator.admin"
                  className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim font-mono text-xs"
                />
              </div>
            </div>

            <div className="hidden">
              <Input value={protocol} onChange={(e) => setProtocol(e.target.value as Protocol)} />
              <Input value={clientId} onChange={(e) => setClientId(e.target.value)} />
              <Input value={clientMode} onChange={(e) => setClientMode(e.target.value)} />
              <Input value={clientPlatform} onChange={(e) => setClientPlatform(e.target.value)} />
              <Input value={subscribeMethod} onChange={(e) => setSubscribeMethod(e.target.value)} />
              <Input value={historyPollMs} onChange={(e) => setHistoryPollMs(e.target.value)} />
              <Input value={passwordDraft} onChange={(e) => setPasswordDraft(e.target.value)} />
              <input
                type="checkbox"
                checked={subscribeOnConnect}
                onChange={(e) => setSubscribeOnConnect(e.target.checked)}
              />
              <input
                type="checkbox"
                checked={includeCron}
                onChange={(e) => setIncludeCron(e.target.checked)}
              />
            </div>

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

        <div
          className={`rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6 ${
            !step1Done ? "opacity-60" : ""
          }`}
        >
          <StepHeader
            step={2}
            title="Create main agent"
            subtitle='Canonical sessionKey: "agent:main:main".'
            done={step2Done}
          />

          <div className="mt-5 space-y-4">
            {!step1Done ? (
              <p className="text-xs text-text-muted">Complete Step 1 first.</p>
            ) : status?.mainAgentId ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-text-muted">Main agent exists. Continue setup in Chat.</p>
                <Button
                  className="bg-teal hover:bg-teal/90 text-white"
                  onClick={() => goChatSetup(String(status.mainAgentId))}
                >
                  Continue in chat
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

                {createError ? <p className="text-xs text-status-blocked">{createError}</p> : null}

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
                        goChatSetup(String(id));
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

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <p className="text-xs text-text-muted">
            After prerequisites, setup continues in Chat with the left checklist rail.
          </p>
          <div className="mt-3">
            <Button asChild variant="outline" size="sm" className="h-8">
              <Link href="/chat?setup=1">Open chat setup</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
