"use client";

import { useConvex, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
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
import { api } from "@/convex/_generated/api";
import { OpenClawBrowserGatewayClient } from "@/lib/openclaw-gateway-client";
import { Settings, ShieldAlert, Activity, Check, Copy } from "lucide-react";
import {
  buildMainAgentBootstrapMessage,
  buildMcpServerConfigTemplate,
  MODEL_STRATEGY_PRESETS,
} from "@/lib/onboardingTemplates";

type Protocol = "req" | "jsonrpc";

function parseScopesCsv(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function SettingsTabs({ active }: { active: "general" | "members" | "openclaw" }) {
  const base =
    "border-b-2 px-4 py-2.5 text-sm font-medium transition-smooth";
  const activeCls = "border-accent-orange text-accent-orange";
  const inactiveCls =
    "border-transparent text-text-muted hover:text-text-primary";

  return (
    <div className="flex gap-1 mb-8 border-b border-border-default">
      <Link
        href="/settings"
        className={`${base} ${active === "general" ? activeCls : inactiveCls}`}
      >
        General
      </Link>
      <Link
        href="/settings/members"
        className={`${base} ${active === "members" ? activeCls : inactiveCls}`}
      >
        Members
      </Link>
      <Link
        href="/settings/openclaw"
        className={`${base} ${active === "openclaw" ? activeCls : inactiveCls}`}
      >
        OpenClaw
      </Link>
    </div>
  );
}

function OpenClawSettingsContent() {
  const { workspaceId, canAdmin, workspace } = useWorkspace();
  const convex = useConvex();

  const summary = useQuery(api.openclaw.getConfigSummary, { workspaceId });
  const upsert = useMutation(api.openclaw.upsertConfig);

  const [wsUrl, setWsUrl] = useState("");
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

  const [tokenDraft, setTokenDraft] = useState("");
  const [tokenClear, setTokenClear] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState("");
  const [passwordClear, setPasswordClear] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    | { status: "idle" }
    | { status: "ok"; message: string }
    | { status: "error"; message: string }
  >({ status: "idle" });

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copy = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

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
    // Don't populate secrets.
    setTokenDraft("");
    setTokenClear(false);
    setPasswordDraft("");
    setPasswordClear(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary?.updatedAt]);

  const hasToken = summary?.hasAuthToken ?? false;
  const hasPassword = summary?.hasPassword ?? false;

  const scopes = useMemo(() => parseScopesCsv(scopesCsv), [scopesCsv]);

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

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

  const onSave = async () => {
    if (!canAdmin) return;
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      await upsert({
        workspaceId,
        wsUrl,
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
        authToken: tokenClear ? null : tokenDraft ? tokenDraft : undefined,
        password: passwordClear ? null : passwordDraft ? passwordDraft : undefined,
      });
      setTokenDraft("");
      setTokenClear(false);
      setPasswordDraft("");
      setPasswordClear(false);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    setTesting(true);
    setTestResult({ status: "idle" });
    try {
      const cfg = await convex.query(api.openclaw.getClientConfig, { workspaceId });
      if (!cfg) {
        setTestResult({
          status: "error",
          message: "OpenClaw is not configured yet.",
        });
        return;
      }
      if (!cfg.wsUrl) {
        setTestResult({ status: "error", message: "Missing wsUrl." });
        return;
      }

      const client = new OpenClawBrowserGatewayClient(
        {
          wsUrl: cfg.wsUrl,
          protocol: cfg.protocol,
          authToken: cfg.authToken,
          password: cfg.password,
          clientId: cfg.clientId,
          clientMode: cfg.clientMode,
          clientPlatform: cfg.clientPlatform,
          role: cfg.role,
          scopes: cfg.scopes,
          subscribeOnConnect: cfg.subscribeOnConnect,
          subscribeMethod: cfg.subscribeMethod,
        },
        async () => {},
      );

      try {
        await client.connect();
        const candidates = ["health.get", "health", "gateway.health"];
        for (const method of candidates) {
          try {
            await client.request(method, {});
            setTestResult({ status: "ok", message: `Connected. Health OK (${method}).` });
            return;
          } catch {
            // try next method
          }
        }
        setTestResult({
          status: "ok",
          message:
            "Connected. (Health method not detected, but connect succeeded.)",
        });
      } finally {
        await client.disconnect().catch(() => {});
      }
    } catch (e) {
      setTestResult({ status: "error", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setTesting(false);
    }
  };

  if (!canAdmin) {
    return (
      <div className="mx-auto max-w-2xl p-3 sm:p-6">
        <div className="flex items-center gap-2.5 mb-6 sm:mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-tertiary">
            <Settings className="h-4 w-4 text-text-muted" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-text-primary">
              Workspace Settings
            </h1>
            <p className="text-xs text-text-muted hidden sm:block">
              Manage OpenClaw gateway configuration
            </p>
          </div>
        </div>

        <SettingsTabs active="openclaw" />

        <div className="flex flex-col items-center justify-center rounded-xl border border-border-default bg-bg-secondary py-16">
          <ShieldAlert className="h-10 w-10 text-text-dim mb-3" />
          <p className="text-sm text-text-muted">
            Only workspace owners can manage OpenClaw settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-3 sm:p-6">
      <div className="flex items-center gap-2.5 mb-6 sm:mb-8">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-tertiary">
          <Settings className="h-4 w-4 text-text-muted" />
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-text-primary">
            Workspace Settings
          </h1>
          <p className="text-xs text-text-muted hidden sm:block">
            Configure OpenClaw Gateway for this workspace
          </p>
        </div>
      </div>

      <SettingsTabs active="openclaw" />

      <div className="space-y-8">
        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary mb-4">
            Connection
          </h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-text-secondary">WebSocket URL</Label>
              <Input
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
                placeholder='wss://claw.sahayoga.in'
                className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
              />
              <p className="text-[11px] text-text-dim">
                Make sure this origin is allowed in OpenClaw:
                <span className="ml-1 font-mono text-text-muted">{origin}</span>
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-text-secondary">Protocol</Label>
                <Select value={protocol} onValueChange={(v) => setProtocol(v as Protocol)}>
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
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary mb-4">
            Client Identity
          </h2>
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
        </div>

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary mb-4">
            Chat Behavior
          </h2>
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
              <p className="text-[11px] text-text-dim">
                If your gateway doesn’t support this, set “Subscribe on connect” off.
              </p>
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
                Used to hydrate tool calls and missed messages via <code className="font-mono">chat.history</code>.
                Set 0 to disable background polling.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary mb-4">
            Secrets
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-text-primary font-medium">Auth token</p>
                <p className="text-xs text-text-dim">
                  Status:{" "}
                  <span className={hasToken ? "text-status-active" : "text-text-muted"}>
                    {hasToken ? "Set" : "Not set"}
                  </span>
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => {
                  setTokenDraft("");
                  setTokenClear(true);
                }}
                disabled={!hasToken}
              >
                Clear token
              </Button>
            </div>
            <div className="space-y-2">
              <Label className="text-text-secondary">Replace token</Label>
              <Input
                value={tokenDraft}
                onChange={(e) => {
                  setTokenDraft(e.target.value);
                  setTokenClear(false);
                }}
                placeholder="Paste a new token…"
                className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim font-mono text-xs"
              />
              {tokenClear && (
                <p className="text-[11px] text-status-blocked">
                  Token will be cleared on Save.
                </p>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-text-primary font-medium">Password (optional)</p>
                <p className="text-xs text-text-dim">
                  Status:{" "}
                  <span className={hasPassword ? "text-status-active" : "text-text-muted"}>
                    {hasPassword ? "Set" : "Not set"}
                  </span>
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => {
                  setPasswordDraft("");
                  setPasswordClear(true);
                }}
                disabled={!hasPassword}
              >
                Clear password
              </Button>
            </div>
            <div className="space-y-2">
              <Label className="text-text-secondary">Replace password</Label>
              <Input
                value={passwordDraft}
                onChange={(e) => {
                  setPasswordDraft(e.target.value);
                  setPasswordClear(false);
                }}
                placeholder="Optional password mode…"
                className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim font-mono text-xs"
              />
              {passwordClear && (
                <p className="text-[11px] text-status-blocked">
                  Password will be cleared on Save.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              onClick={onSave}
              disabled={saving}
              className="bg-accent-orange hover:bg-accent-orange/90 text-white"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
            {saveOk && <span className="text-xs text-status-active">Saved</span>}
            {saveError && <span className="text-xs text-status-blocked">{saveError}</span>}
          </div>

          <Button
            variant="outline"
            onClick={onTest}
            disabled={testing}
            className="gap-2"
          >
            <Activity className="h-4 w-4" />
            {testing ? "Testing..." : "Test connection"}
          </Button>
        </div>

        {testResult.status !== "idle" && (
          <div
            className={`rounded-xl border p-4 ${
              testResult.status === "ok"
                ? "border-status-active/40 bg-status-active/10"
                : "border-status-blocked/40 bg-status-blocked/10"
            }`}
          >
            <p className="text-sm text-text-primary font-medium">Connection test</p>
            <p className="mt-1 text-xs text-text-secondary">{testResult.message}</p>
          </div>
        )}

        {summary?.wsUrl ? (
          <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">
                  Setup guide
                </h2>
                <p className="mt-1 text-xs text-text-muted">
                  Copy these templates to configure your agents and multi-agent workflow.
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="h-8">
                <Link href="/settings/api-keys">Create API key</Link>
              </Button>
            </div>

            <div className="mt-4 rounded-lg border border-border-default bg-bg-tertiary px-3 py-2">
              <p className="text-[11px] text-text-dim">
                Workspace ID:{" "}
                <span className="font-mono text-text-muted">
                  {String(workspaceId)}
                </span>
              </p>
            </div>

            {/* Multi-agent bootstrap prompt */}
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                  Main Agent Bootstrap Prompt
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void copy("bootstrap", bootstrapPrompt)}
                  className="h-8 w-8 p-0 text-text-muted hover:text-text-primary hover:bg-bg-hover"
                  title={copiedId === "bootstrap" ? "Copied" : "Copy"}
                >
                  {copiedId === "bootstrap" ? (
                    <Check className="h-4 w-4 text-status-active" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <pre className="max-h-[260px] overflow-auto rounded-lg bg-bg-primary border border-border-default p-3 font-mono text-[11px] text-text-primary whitespace-pre-wrap">
                {bootstrapPrompt}
              </pre>
            </div>

            {/* MCP config */}
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                  MCPorter Config (Sutraha HQ MCP Server)
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void copy("mcporter", mcpConfigTemplate)}
                  className="h-8 w-8 p-0 text-text-muted hover:text-text-primary hover:bg-bg-hover"
                  title={copiedId === "mcporter" ? "Copied" : "Copy"}
                >
                  {copiedId === "mcporter" ? (
                    <Check className="h-4 w-4 text-status-active" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <pre className="max-h-[260px] overflow-auto rounded-lg bg-bg-primary border border-border-default p-3 font-mono text-[11px] text-text-primary whitespace-pre-wrap">
                {mcpConfigTemplate}
              </pre>
              <p className="text-[11px] text-text-dim">
                Note: Sutraha HQ is BYO OpenClaw + BYO model provider. Sutraha HQ does not store LLM provider keys in this setup.
              </p>
            </div>

            {/* Model strategy */}
            <div className="mt-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                Model strategy presets
              </p>
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
        ) : null}
      </div>
    </div>
  );
}

export default function OpenClawSettingsPage() {
  return (
    <AppLayout>
      <OpenClawSettingsContent />
    </AppLayout>
  );
}
