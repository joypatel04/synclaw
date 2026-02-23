"use client";

import { useConvex, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import {
  OpenClawBrowserGatewayClient,
  OPENCLAW_DEVICE_IDENTITY_STORAGE_KEY,
  clearOpenClawLocalAuthState,
  isOpenClawDeviceAuthEnabled,
  type OpenClawConnectionStatus,
  openClawDeviceTokenStorageKey,
} from "@/lib/openclaw-gateway-client";
import { Settings, ShieldAlert, Activity, Check, Copy } from "lucide-react";
import {
  buildMainAgentBootstrapMessage,
  buildSpecialistAgentBootstrapMessage,
  buildMcpServerConfigTemplate,
  CANONICAL_AGENT_TEMPLATES,
  MODEL_STRATEGY_PRESETS,
} from "@/lib/onboardingTemplates";
import {
  buildSutrahaProtocolMd,
  SUTRAHA_PROTOCOL_FILENAME,
} from "@/lib/sutrahaProtocol";
import { LocalOpenClawConfigEditor } from "@/components/openclaw/LocalOpenClawConfigEditor";
import { setChatDraft } from "@/lib/chatDraft";
import { readStoredDeviceIdentityV2 } from "@/lib/openclaw/device-auth-v3";
import { BILLING_ENABLED, WEBHOOKS_ENABLED } from "@/lib/features";

function parseScopesCsv(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function SettingsTabs({
  active,
}: {
  active: "general" | "members" | "openclaw" | "billing";
}) {
  const base = "border-b-2 px-4 py-2.5 text-sm font-medium transition-smooth";
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
      {WEBHOOKS_ENABLED ? (
        <Link href="/settings/webhooks" className={`${base} ${inactiveCls}`}>
          Webhooks
        </Link>
      ) : null}
      {BILLING_ENABLED ? (
        <Link
          href="/settings/billing"
          className={`${base} ${active === "billing" ? activeCls : inactiveCls}`}
        >
          Billing
        </Link>
      ) : null}
    </div>
  );
}

function OpenClawSettingsContent() {
  const { workspaceId, canAdmin, workspace } = useWorkspace();
  const convex = useConvex();
  const router = useRouter();

  const summary = useQuery(api.openclaw.getConfigSummary, { workspaceId });
  const agents =
    useQuery(
      api.agents.list,
      canAdmin ? { workspaceId, includeArchived: true } : "skip",
    ) ?? [];
  const upsert = useMutation(api.openclaw.upsertConfig);
  const createAgent = useMutation(api.agents.create);

  const [wsUrl, setWsUrl] = useState("");
  const [role, setRole] = useState("operator");
  const [scopesCsv, setScopesCsv] = useState(
    "operator.read,operator.write,operator.admin",
  );
  const [includeCron, setIncludeCron] = useState(true);
  const [historyPollMs, setHistoryPollMs] = useState("5000");

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
  const [testStatus, setTestStatus] = useState<OpenClawConnectionStatus | null>(
    null,
  );
  const [diagnosticsText, setDiagnosticsText] = useState("");

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [localAuthRev, setLocalAuthRev] = useState(0);
  const copy = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    if (!summary) return;
    setWsUrl(summary.wsUrl ?? "");
    setRole(summary.role ?? "operator");
    setScopesCsv((summary.scopes ?? []).join(",") || scopesCsv);
    setIncludeCron(Boolean(summary.includeCron));
    setHistoryPollMs(String(summary.historyPollMs ?? 5000));
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
  const isHttpsPage =
    typeof window !== "undefined" && window.location.protocol === "https:";
  const isInsecureWsUrl = wsUrl.trim().toLowerCase().startsWith("ws://");
  const showMixedContentWarning = isHttpsPage && isInsecureWsUrl;

  const localAuthState = useMemo(() => {
    if (typeof window === "undefined") {
      return { hasDeviceIdentity: false, hasDeviceToken: false };
    }
    try {
      const hasDeviceIdentity = Boolean(
        window.localStorage.getItem(OPENCLAW_DEVICE_IDENTITY_STORAGE_KEY),
      );
      const key = openClawDeviceTokenStorageKey(
        wsUrl.trim() || "",
        role.trim() || "operator",
      );
      const hasDeviceToken = Boolean(window.localStorage.getItem(key));
      return { hasDeviceIdentity, hasDeviceToken };
    } catch {
      return { hasDeviceIdentity: false, hasDeviceToken: false };
    }
  }, [wsUrl, role, localAuthRev]);

  const localIdentity = useMemo(
    () => readStoredDeviceIdentityV2(),
    [localAuthRev],
  );

  const deviceAuthEnabled = useMemo(() => {
    if (typeof window === "undefined") return false;
    return isOpenClawDeviceAuthEnabled();
  }, [localAuthRev]);

  const bootstrapPrompt = useMemo(() => {
    return buildMainAgentBootstrapMessage({
      workspaceName: workspace.name,
      workspaceId: String(workspaceId),
    });
  }, [workspace.name, workspaceId]);

  const protocolMd = useMemo(() => {
    return buildSutrahaProtocolMd({
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

  const canonicalSpecialists = useMemo(() => {
    return CANONICAL_AGENT_TEMPLATES.filter((a) => a.id !== "main");
  }, []);

  const existingSessionKeys = useMemo(() => {
    return new Set(agents.map((a: any) => a.sessionKey));
  }, [agents]);

  const mainAgent = useMemo(() => {
    return agents.find((a: any) => a.sessionKey === "agent:main:main") ?? null;
  }, [agents]);

  const missingSpecialists = useMemo(() => {
    return canonicalSpecialists.filter(
      (a) => !existingSessionKeys.has(a.sessionKey),
    );
  }, [canonicalSpecialists, existingSessionKeys]);

  const specialistPrompts = useMemo(() => {
    return canonicalSpecialists.map((agent) => {
      return {
        id: `bootstrap:${agent.id}`,
        title: `${agent.name} Bootstrap Prompt (${agent.sessionKey})`,
        value: buildSpecialistAgentBootstrapMessage({
          workspaceName: workspace.name,
          workspaceId: String(workspaceId),
          agent,
        }),
      };
    });
  }, [canonicalSpecialists, workspace.name, workspaceId]);

  const [creatingSquad, setCreatingSquad] = useState(false);
  const [squadError, setSquadError] = useState<string | null>(null);
  const [squadOk, setSquadOk] = useState(false);

  const onCreateSquad = async () => {
    if (!canAdmin) return;
    if (creatingSquad) return;
    if (missingSpecialists.length === 0) return;

    setCreatingSquad(true);
    setSquadError(null);
    setSquadOk(false);
    try {
      for (const agent of missingSpecialists) {
        await createAgent({
          workspaceId,
          name: agent.name,
          role: agent.role,
          emoji: agent.emoji,
          sessionKey: agent.sessionKey,
          externalAgentId: agent.sessionKey,
        });
      }
      setSquadOk(true);
      setTimeout(() => setSquadOk(false), 2000);
    } catch (e) {
      setSquadError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreatingSquad(false);
    }
  };

  const onSave = async () => {
    if (!canAdmin) return;
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      await upsert({
        workspaceId,
        wsUrl,
        protocol: "req",
        clientId: "openclaw-control-ui",
        clientMode: "webchat",
        clientPlatform:
          typeof navigator !== "undefined"
            ? navigator.platform || "web"
            : "web",
        role,
        scopes,
        subscribeOnConnect: false,
        subscribeMethod: "chat.subscribe",
        includeCron,
        historyPollMs: Number(historyPollMs || "0"),
        authToken: tokenClear ? null : tokenDraft ? tokenDraft : undefined,
        password: passwordClear
          ? null
          : passwordDraft
            ? passwordDraft
            : undefined,
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
    setTestStatus(null);
    setDiagnosticsText("");
    let client: OpenClawBrowserGatewayClient | null = null;
    try {
      const cfg = await convex.query(api.openclaw.getClientConfig, {
        workspaceId,
      });
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

      client = new OpenClawBrowserGatewayClient(
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
        const status = client.getConnectionStatus();
        setTestStatus(status);
        setDiagnosticsText(JSON.stringify(client.getDiagnostics(), null, 2));
        setTestResult({
          status: "ok",
          message: status?.message ?? "Connected.",
        });
      } finally {
        await client.disconnect().catch(() => {});
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setTestResult({ status: "error", message });
      if (client) {
        setTestStatus(client.getConnectionStatus());
        setDiagnosticsText(JSON.stringify(client.getDiagnostics(), null, 2));
      }
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
                placeholder="wss://claw.sahayoga.in"
                className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
              />
              <p className="text-[11px] text-text-dim">
                Make sure this origin is allowed in OpenClaw:
                <span className="ml-1 font-mono text-text-muted">{origin}</span>
              </p>
              {showMixedContentWarning ? (
                <div className="rounded-md border border-status-review/40 bg-status-review/10 px-2.5 py-2 text-[11px] text-status-review">
                  This app is running on HTTPS. Browsers often block{" "}
                  <code className="font-mono">ws://</code> as mixed content.
                  Prefer <code className="font-mono">wss://</code>. Or setup self-hosted Synclaw.
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-text-secondary">Protocol</Label>
                <Input
                  value="req"
                  readOnly
                  className="bg-bg-primary border-border-default text-text-primary font-mono text-xs"
                />
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
              <Label className="text-text-secondary">
                Scopes (comma-separated)
              </Label>
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
            Chat Behavior
          </h2>
          <div className="space-y-4">
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
                placeholder="5000"
                className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim font-mono text-xs"
              />
              <p className="text-[11px] text-text-dim">
                Used to hydrate tool calls and missed messages via{" "}
                <code className="font-mono">chat.history</code>. Recommended:
                3000-5000ms. Set 0 to disable background polling.
              </p>
            </div>

            <div className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2">
              <p className="text-[11px] text-text-dim">
                Client identity (managed automatically)
              </p>
              <p className="mt-1 font-mono text-[11px] text-text-primary">
                openclaw-control-ui / webchat / req
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
                <p className="text-sm text-text-primary font-medium">
                  Auth token
                </p>
                <p className="text-xs text-text-dim">
                  Status:{" "}
                  <span
                    className={
                      hasToken ? "text-status-active" : "text-text-muted"
                    }
                  >
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
                <p className="text-sm text-text-primary font-medium">
                  Password (optional)
                </p>
                <p className="text-xs text-text-dim">
                  Status:{" "}
                  <span
                    className={
                      hasPassword ? "text-status-active" : "text-text-muted"
                    }
                  >
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
            {saveOk && (
              <span className="text-xs text-status-active">Saved</span>
            )}
            {saveError && (
              <span className="text-xs text-status-blocked">{saveError}</span>
            )}
          </div>

          <Button
            variant="outline"
            onClick={onTest}
            disabled={testing}
            className="gap-2"
          >
            <Activity className="h-4 w-4" />
            {testing ? "Testing..." : "Initiate pairing handshake / Test"}
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
            <p className="text-sm text-text-primary font-medium">
              Connection test
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              {testResult.message}
            </p>
          </div>
        )}

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary">
            Pairing-first checklist
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Use this exact order for strict device-auth setup.
          </p>

          <ol className="mt-3 list-decimal pl-5 space-y-2 text-xs text-text-secondary">
            <li>
              Save gateway URL + token, then click{" "}
              <span className="font-medium">Initiate pairing handshake</span>{" "}
              (Test connection).
            </li>
            <li>
              Add this Sutraha origin to OpenClaw allowed origins:
              <div className="mt-1 flex items-center gap-2">
                <code className="rounded bg-bg-tertiary px-2 py-1 font-mono text-[11px] text-text-primary">
                  {origin || "(open this page in browser to detect origin)"}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={!origin}
                  title={copiedId === "origin" ? "Copied" : "Copy origin"}
                  onClick={() => void copy("origin", origin)}
                >
                  {copiedId === "origin" ? (
                    <Check className="h-4 w-4 text-status-active" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </li>
            <li>
              Approve this device in OpenClaw:
              <pre className="mt-1 overflow-auto rounded-lg border border-border-default bg-bg-primary p-2 font-mono text-[11px] text-text-primary whitespace-pre-wrap">
                {`openclaw devices list
openclaw devices approve <requestId>`}
              </pre>
            </li>
            <li>
              Rotate required scopes for this exact device id:
              <pre className="mt-1 overflow-auto rounded-lg border border-border-default bg-bg-primary p-2 font-mono text-[11px] text-text-primary whitespace-pre-wrap">
                {`openclaw devices rotate \\
  --device <deviceId> \\
  --role operator \\
  --scope operator.read \\
  --scope operator.write \\
  --scope operator.admin`}
              </pre>
            </li>
            <li>
              Verify read + admin access by clicking{" "}
              <span className="font-medium">Test connection</span> again.
            </li>
          </ol>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2">
              <p className="text-[11px] text-text-dim">Local device id (v2)</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="truncate rounded bg-bg-primary px-2 py-1 font-mono text-[11px] text-text-primary">
                  {localIdentity?.deviceId ?? "Not generated yet"}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={!localIdentity?.deviceId}
                  title={copiedId === "device-id" ? "Copied" : "Copy device id"}
                  onClick={() =>
                    localIdentity?.deviceId &&
                    void copy("device-id", localIdentity.deviceId)
                  }
                >
                  {copiedId === "device-id" ? (
                    <Check className="h-4 w-4 text-status-active" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2">
              <p className="text-[11px] text-text-dim">Connection status</p>
              <p className="mt-1 text-xs text-text-primary">
                {testStatus?.state ?? "Not verified"}
                {testStatus?.missingScope
                  ? ` (${testStatus.missingScope})`
                  : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary">
            Local auth state
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Diagnostics for this browser session.
          </p>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2">
              <p className="text-[11px] text-text-dim">
                Device-auth pairing mode
              </p>
              <p
                className={`text-xs ${
                  deviceAuthEnabled ? "text-status-active" : "text-text-muted"
                }`}
              >
                {deviceAuthEnabled ? "Enabled" : "Disabled (token-only mode)"}
              </p>
            </div>
            <div className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2">
              <p className="text-[11px] text-text-dim">Device identity</p>
              <p
                className={`text-xs ${
                  localAuthState.hasDeviceIdentity
                    ? "text-status-active"
                    : "text-text-muted"
                }`}
              >
                {localAuthState.hasDeviceIdentity ? "Present" : "Not found"}
              </p>
            </div>
            <div className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2">
              <p className="text-[11px] text-text-dim">
                Device token (current wsUrl/role)
              </p>
              <p
                className={`text-xs ${
                  localAuthState.hasDeviceToken
                    ? "text-status-active"
                    : "text-text-muted"
                }`}
              >
                {localAuthState.hasDeviceToken ? "Present" : "Not found"}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => {
                clearOpenClawLocalAuthState(
                  wsUrl.trim() || undefined,
                  role.trim() || "operator",
                );
                setLocalAuthRev((v) => v + 1);
              }}
            >
              Clear current gateway token cache
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => {
                clearOpenClawLocalAuthState();
                setLocalAuthRev((v) => v + 1);
              }}
            >
              Reset local OpenClaw identity (v2)
            </Button>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-text-primary">
                Diagnostics
              </p>
              <Button
                variant="ghost"
                size="sm"
                disabled={!diagnosticsText}
                onClick={() => void copy("diagnostics", diagnosticsText)}
              >
                {copiedId === "diagnostics" ? "Copied" : "Copy diagnostics"}
              </Button>
            </div>
            <pre className="mt-2 overflow-auto rounded-lg border border-border-default bg-bg-primary p-2 font-mono text-[11px] text-text-primary whitespace-pre-wrap">
              {diagnosticsText ||
                "Run Test connection to generate diagnostics."}
            </pre>
          </div>
        </div>

        {summary?.wsUrl ? (
          <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">
                  Setup guide
                </h2>
                <p className="mt-1 text-xs text-text-muted">
                  Open Chat setup guide for the canonical workflow. Templates
                  below are minimal references.
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="h-8">
                <Link href="/chat">Open chat setup</Link>
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-border-default bg-bg-tertiary p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                  Main bootstrap
                </p>
                <p className="mt-1 text-[11px] text-text-muted">
                  Where to paste: OpenClaw main agent prompt (or first chat
                  message).
                </p>
                <div className="mt-2 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void copy("bootstrap", bootstrapPrompt)}
                    className="h-8 w-8 p-0"
                    title={copiedId === "bootstrap" ? "Copied" : "Copy"}
                  >
                    {copiedId === "bootstrap" ? (
                      <Check className="h-4 w-4 text-status-active" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border-default bg-bg-tertiary p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                  MCPorter config
                </p>
                <p className="mt-1 text-[11px] text-text-muted">
                  BYO mode: Synclaw does not store model provider keys.
                </p>
                <div className="mt-2 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void copy("mcporter", mcpConfigTemplate)}
                    className="h-8 w-8 p-0"
                    title={copiedId === "mcporter" ? "Copied" : "Copy"}
                  >
                    {copiedId === "mcporter" ? (
                      <Check className="h-4 w-4 text-status-active" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <details className="rounded-xl border border-border-default bg-bg-tertiary p-3">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-text-dim">
                  {SUTRAHA_PROTOCOL_FILENAME}
                </summary>
                <p className="mt-2 text-[11px] text-text-muted">
                  Where to paste: each OpenClaw workspace root.
                </p>
                <div className="mt-2 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void copy("protocol", protocolMd)}
                    className="h-8 w-8 p-0"
                    title={copiedId === "protocol" ? "Copied" : "Copy"}
                  >
                    {copiedId === "protocol" ? (
                      <Check className="h-4 w-4 text-status-active" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </details>
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary">
            Workspace Files
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Bridge setup and remote file editor moved to the dedicated
            Filesystem page.
          </p>
          <div className="mt-3">
            <Button asChild variant="outline" size="sm" className="h-8">
              <Link href="/filesystem">Open /filesystem</Link>
            </Button>
          </div>
        </div>

        <LocalOpenClawConfigEditor />
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
