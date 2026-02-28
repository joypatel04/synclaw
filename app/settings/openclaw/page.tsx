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
import {
  Settings,
  ShieldAlert,
  Activity,
  Check,
  Copy,
  LifeBuoy,
  Server,
} from "lucide-react";
import {
  buildMainAgentBootstrapMessage,
  buildSpecialistAgentBootstrapMessage,
  buildMcpServerConfigTemplate,
  CANONICAL_AGENT_TEMPLATES,
  MODEL_STRATEGY_PRESETS,
} from "@/lib/onboardingTemplates";
import {
  buildSynclawProtocolMd,
  SYNCLAW_PROTOCOL_FILENAME,
} from "@/lib/synclawProtocol";
import { LocalOpenClawConfigEditor } from "@/components/openclaw/LocalOpenClawConfigEditor";
import { setChatDraft } from "@/lib/chatDraft";
import { readStoredDeviceIdentityV2 } from "@/lib/openclaw/device-auth-v3";
import { BILLING_ENABLED, WEBHOOKS_ENABLED } from "@/lib/features";
import {
  mapOpenClawSetupError,
  OPENCLAW_METHOD_CARDS,
  PUBLIC_WSS_SECURITY_CHECKLIST,
  recommendTransportMode,
  type OpenClawTransportMode,
} from "@/lib/openclawSetupMethods";
import {
  MANAGED_REGION_OPTIONS,
  managedRegionLabel,
  type ManagedRegionCode,
} from "@/lib/managedRegions";

const MODEL_PROVIDER_OPTIONS = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "gemini", label: "Gemini" },
  { id: "google_antigravity", label: "Google Antigravity" },
  { id: "z_ai", label: "Z.ai" },
  { id: "minimax", label: "Minimax" },
] as const;

type ModelProviderId = (typeof MODEL_PROVIDER_OPTIONS)[number]["id"];

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
  const confirmSecurityChecklist = useMutation(
    api.openclaw.confirmSecurityChecklist,
  );
  const createManagedJob = useMutation(api.managedProvisioning.createManagedJob);
  const retryManagedJob = useMutation(api.managedProvisioning.retryJob);
  const verifyManagedConnection = useMutation(
    api.managedProvisioning.verifyManagedConnection,
  );
  const managedStatus = useQuery(api.managedProvisioning.getManagedStatus, {
    workspaceId,
  });
  const createAssistedSession = useMutation(api.support.createAssistedSession);
  const upsertWorkspaceKey = useMutation(api.modelKeys.upsertWorkspaceKey);
  const validateWorkspaceKeys = useMutation(api.modelKeys.validateWorkspaceKeys);
  const createAgent = useMutation(api.agents.create);
  const assistedSessions =
    useQuery(api.support.listAssistedSessions, { workspaceId }) ?? [];
  const providerKeyStatuses =
    useQuery(api.modelKeys.listWorkspaceKeyStatus, { workspaceId }) ?? [];

  const [wsUrl, setWsUrl] = useState("");
  const [transportMode, setTransportMode] =
    useState<OpenClawTransportMode>("direct_ws");
  const [connectorId, setConnectorId] = useState("");
  const [connectorStatus, setConnectorStatus] = useState<
    "online" | "offline" | "degraded"
  >("offline");
  const [connectorLastSeenAt, setConnectorLastSeenAt] = useState<number | null>(
    null,
  );
  const [role, setRole] = useState("operator");
  const [deploymentMode, setDeploymentMode] = useState<"managed" | "manual">(
    "manual",
  );
  const [requestedRegion, setRequestedRegion] =
    useState<ManagedRegionCode>("eu_central_hil");
  const [serviceTier, setServiceTier] = useState<
    "self_serve" | "assisted" | "managed"
  >("self_serve");
  const [setupStatus, setSetupStatus] = useState<
    | "not_started"
    | "infra_ready"
    | "openclaw_ready"
    | "agents_ready"
    | "verified"
  >("not_started");
  const [ownerContact, setOwnerContact] = useState("");
  const [supportNotes, setSupportNotes] = useState("");
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
  const [lastTestedAt, setLastTestedAt] = useState<number | null>(null);
  const securityStatus = useQuery(api.openclaw.getSecurityStatus, {
    workspaceId,
  });
  const [validationState, setValidationState] = useState<{
    ok: boolean;
    errors: string[];
    warnings: string[];
    nextActions: string[];
    riskLevel: "low" | "medium" | "high";
  } | null>(null);
  const [securityChecklistAck, setSecurityChecklistAck] = useState({
    allowedOrigins: false,
    deviceApproval: false,
    minimalScopes: false,
    testPass: false,
    dashboardProtection: false,
  });
  const [securityHardeningNotes, setSecurityHardeningNotes] = useState("");
  const [serviceMessage, setServiceMessage] = useState<string | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [providerKeyDrafts, setProviderKeyDrafts] = useState({
    openai: "",
    anthropic: "",
    gemini: "",
    google_antigravity: "",
    z_ai: "",
    minimax: "",
  });
  const [providerKeyMessage, setProviderKeyMessage] = useState<string | null>(
    null,
  );
  const [providerKeyError, setProviderKeyError] = useState<string | null>(null);
  const copy = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    if (!summary) return;
    const nextMode =
      (summary.transportMode as OpenClawTransportMode) ?? "direct_ws";
    setTransportMode(nextMode);
    setConnectorId(summary.connectorId ?? "");
    setConnectorStatus(
      (summary.connectorStatus as "online" | "offline" | "degraded") ??
        "offline",
    );
    setConnectorLastSeenAt(
      typeof summary.connectorLastSeenAt === "number"
        ? summary.connectorLastSeenAt
        : null,
    );
    setDeploymentMode((summary.deploymentMode as "managed" | "manual") ?? "manual");
    setRequestedRegion(
      ((summary.managedRegionRequested ||
        summary.managedRegionResolved) as ManagedRegionCode) ??
        "eu_central_hil",
    );
    setServiceTier(
      (summary.serviceTier as "self_serve" | "assisted" | "managed") ??
        "self_serve",
    );
    setSetupStatus(
      (summary.setupStatus as
        | "not_started"
        | "infra_ready"
        | "openclaw_ready"
        | "agents_ready"
        | "verified") ?? "not_started",
    );
    setOwnerContact(summary.ownerContact ?? "");
    setSupportNotes(summary.supportNotes ?? "");
    setWsUrl(summary.wsUrl ?? "");
    setRole(summary.role ?? "operator");
    setScopesCsv((summary.scopes ?? []).join(",") || scopesCsv);
    setIncludeCron(Boolean(summary.includeCron));
    setHistoryPollMs(String(summary.historyPollMs ?? 5000));
    setSecurityHardeningNotes(summary.publicWssHardeningNotes ?? "");
    // Don't populate secrets.
    setTokenDraft("");
    setTokenClear(false);
    setPasswordDraft("");
    setPasswordClear(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary?.updatedAt]);

  useEffect(() => {
    if (!securityStatus) return;
    setValidationState(securityStatus.validation ?? null);
    if (securityStatus.securityConfirmedAt) {
      setSecurityChecklistAck({
        allowedOrigins: true,
        deviceApproval: true,
        minimalScopes: true,
        testPass: true,
        dashboardProtection: true,
      });
    }
    if (securityStatus.publicWssHardeningNotes) {
      setSecurityHardeningNotes(securityStatus.publicWssHardeningNotes);
    }
  }, [securityStatus]);

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
  const recommendedMode = useMemo(
    () => recommendTransportMode(wsUrl, isHttpsPage),
    [isHttpsPage, wsUrl],
  );

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
    return buildSynclawProtocolMd({
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
        deploymentMode,
        transportMode,
        recommendedMethod:
          recommendedMode === "direct_ws"
            ? "public_wss"
            : recommendedMode === "connector"
              ? "connector_advanced"
              : "self_hosted_local",
        provisioningMode: "sutraha_managed",
        managedRegionRequested: requestedRegion,
        serviceTier,
        setupStatus,
        ownerContact,
        supportNotes,
        connectorId: connectorId.trim() || undefined,
        connectorStatus,
        connectorLastSeenAt,
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
      if ((cfg.transportMode ?? "direct_ws") === "connector") {
        if (!cfg.connectorId) {
          setTestResult({
            status: "error",
            message: "Missing connector ID.",
          });
          return;
        }
        if ((cfg.connectorStatus ?? "offline") !== "online") {
          setTestResult({
            status: "error",
            message:
              "Connector Offline: start your connector process and verify connectivity.",
          });
          return;
        }
        setTestResult({
          status: "ok",
          message: "Connector is online and ready.",
        });
        setLastTestedAt(Date.now());
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
        if ((cfg.transportMode ?? "direct_ws") === "direct_ws") {
          const validation = await convex.query(api.openclaw.validatePublicWssConfig, {
            workspaceId,
          });
          setValidationState(validation);
          if (!validation.ok) {
            setTestResult({
              status: "error",
              message: validation.errors[0] ?? "Public WSS validation failed.",
            });
          } else if (validation.warnings.length > 0) {
            setTestResult({
              status: "error",
              message: validation.warnings[0],
            });
          }
        }
        setLastTestedAt(Date.now());
      } finally {
        await client.disconnect().catch(() => {});
      }
    } catch (e) {
      const message = mapOpenClawSetupError(
        e instanceof Error ? e.message : String(e),
        transportMode,
      );
      setTestResult({ status: "error", message });
      if (client) {
        setTestStatus(client.getConnectionStatus());
        setDiagnosticsText(JSON.stringify(client.getDiagnostics(), null, 2));
      }
    } finally {
      setTesting(false);
    }
  };

  const onConfirmSecurityChecklist = async () => {
    try {
      await confirmSecurityChecklist({
        workspaceId,
        checklistAck: securityChecklistAck,
        hardeningNotes: securityHardeningNotes.trim() || undefined,
      });
      const latest = await convex.query(api.openclaw.getSecurityStatus, {
        workspaceId,
      });
      setValidationState(latest.validation ?? null);
      setServiceMessage("Security checklist confirmed.");
      setServiceError(null);
    } catch (e) {
      setServiceError(e instanceof Error ? e.message : String(e));
    }
  };

  const onCreateProvisioningJob = async () => {
    setServiceError(null);
    setServiceMessage(null);
    try {
      const result = await createManagedJob({
        workspaceId,
        requestedRegion,
        serviceTier,
      });
      setDeploymentMode("managed");
      setSetupStatus("verified");
      setServiceMessage(
        result.fallbackApplied
          ? `Provisioning started. Requested region unavailable; deploying to nearest available region: ${managedRegionLabel(result.resolvedRegion)}.`
          : `Provisioning started in ${managedRegionLabel(result.resolvedRegion)}.`,
      );
    } catch (e) {
      setServiceError(e instanceof Error ? e.message : String(e));
    }
  };

  const onRetryLatestJob = async () => {
    setServiceError(null);
    setServiceMessage(null);
    try {
      const latest = managedStatus?.latestJob;
      if (!latest) {
        setServiceError("No provisioning job available to retry.");
        return;
      }
      const result = await retryManagedJob({
        workspaceId,
        jobId: latest._id,
      });
      setServiceMessage(`Retry job queued (${String(result.jobId)}).`);
    } catch (e) {
      setServiceError(e instanceof Error ? e.message : String(e));
    }
  };

  const onVerifyProvisioning = async () => {
    setServiceError(null);
    setServiceMessage(null);
    try {
      const result = await verifyManagedConnection({ workspaceId });
      setSetupStatus(result.ok ? "verified" : "openclaw_ready");
      setServiceMessage(result.ok ? "Managed connection verified." : result.nextAction);
    } catch (e) {
      setServiceError(e instanceof Error ? e.message : String(e));
    }
  };

  const onRequestAssistedLaunch = async () => {
    setServiceError(null);
    setServiceMessage(null);
    try {
      if (!ownerContact.trim()) {
        setServiceError("Owner contact is required for assisted launch.");
        return;
      }
      const result = await createAssistedSession({
        workspaceId,
        ownerContact: ownerContact.trim(),
        notes: supportNotes.trim() || undefined,
      });
      setServiceTier("assisted");
      setServiceMessage(
        `Assisted launch requested (${String(result.sessionId)}). Team will follow up.`,
      );
    } catch (e) {
      setServiceError(e instanceof Error ? e.message : String(e));
    }
  };

  const onSaveProviderKey = async (provider: ModelProviderId) => {
    setProviderKeyMessage(null);
    setProviderKeyError(null);
    try {
      const keyValue = providerKeyDrafts[provider].trim();
      if (!keyValue) {
        setProviderKeyError(`Enter a ${provider} key first.`);
        return;
      }
      await upsertWorkspaceKey({
        workspaceId,
        provider,
        key: keyValue,
      });
      setProviderKeyDrafts((prev) => ({ ...prev, [provider]: "" }));
      setProviderKeyMessage(`${provider} key saved (encrypted).`);
    } catch (e) {
      setProviderKeyError(e instanceof Error ? e.message : String(e));
    }
  };

  const onValidateProviderKeys = async () => {
    setProviderKeyMessage(null);
    setProviderKeyError(null);
    try {
      const result = await validateWorkspaceKeys({ workspaceId });
      const validCount = result.results.filter((r) => r.status === "valid").length;
      setProviderKeyMessage(`Validated ${validCount}/${result.results.length} provider keys.`);
    } catch (e) {
      setProviderKeyError(e instanceof Error ? e.message : String(e));
    }
  };

  const connectionHealth = useMemo(() => {
    if (testResult.status === "ok") return "Connected";
    if (transportMode === "connector" && connectorStatus !== "online") {
      return "Connector Offline";
    }
    if (
      testStatus?.state === "PAIRING_REQUIRED" ||
      testStatus?.state === "PAIRING_PENDING" ||
      testStatus?.state === "SCOPES_INSUFFICIENT"
    ) {
      return "Needs Pairing";
    }
    if (testResult.status === "error") return "Invalid Config";
    return "Not Verified";
  }, [connectorStatus, testResult.status, testStatus?.state, transportMode]);
  const securityUiStatus = useMemo(() => {
    if (validationState?.errors?.length) return "Invalid config";
    if (validationState?.warnings?.length) return "Needs hardening";
    if (securityStatus?.status === "secure") return "Secure";
    return "Needs hardening";
  }, [securityStatus?.status, validationState]);

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
          <h2 className="text-sm font-semibold text-text-primary mb-1">
            Connection Method
          </h2>
          <p className="text-xs text-text-muted">
            Choose how this workspace connects to OpenClaw. Switching methods
            can require a different setup path.
          </p>
          <p className="mt-1 text-[11px] text-text-dim">
            Switching method may require a new URL/auth strategy and a fresh connectivity test.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {OPENCLAW_METHOD_CARDS.filter((m) => m.mode !== "connector").map(
              (method) => {
                const active = transportMode === method.mode;
                const suggested = recommendedMode === method.mode;
                return (
                  <button
                    key={method.mode}
                    type="button"
                    onClick={() => {
                      if (deploymentMode === "managed") return;
                      setTransportMode(method.mode);
                    }}
                    className={`rounded-xl border p-3 text-left ${
                      active
                        ? "border-accent-orange/50 bg-accent-orange/10"
                        : "border-border-default bg-bg-primary"
                    } ${deploymentMode === "managed" ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-text-primary">
                        {method.title}
                      </p>
                      {method.badge ? (
                        <span className="rounded-full bg-accent-orange/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-orange">
                          {method.badge}
                        </span>
                      ) : suggested ? (
                        <span className="rounded-full bg-bg-tertiary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          Context match
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] text-text-muted">
                      {method.subtitle}
                    </p>
                    <p className="mt-2 text-[11px] text-text-secondary">
                      Use when: {method.useWhen}
                    </p>
                  </button>
                );
              },
            )}
          </div>
          <details className="mt-2 rounded-xl border border-border-default bg-bg-primary p-3">
            <summary className="cursor-pointer text-xs font-semibold text-text-primary">
              Advanced: Private Connector
            </summary>
            <p className="mt-2 text-[11px] text-text-muted">
              Experimental/advanced until relay runtime is fully available.
            </p>
            {OPENCLAW_METHOD_CARDS.filter((m) => m.mode === "connector").map(
              (method) => {
                const active = transportMode === method.mode;
                return (
                  <button
                    key={method.mode}
                    type="button"
                    onClick={() => {
                      if (deploymentMode === "managed") return;
                      setTransportMode(method.mode);
                    }}
                    className={`mt-2 w-full rounded-xl border p-3 text-left ${
                      active
                        ? "border-accent-orange/50 bg-accent-orange/10"
                        : "border-border-default bg-bg-secondary"
                    } ${deploymentMode === "managed" ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-text-primary">
                        {method.title}
                      </p>
                      <span className="rounded-full bg-bg-tertiary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        {method.badge}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-text-muted">
                      {method.useWhen}
                    </p>
                  </button>
                );
              },
            )}
          </details>
        </div>

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-accent-orange" />
            <h2 className="text-sm font-semibold text-text-primary">
              Need OpenClaw setup?
            </h2>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            Managed cloud setup: choose region and launch mode, then Sutraha provisions and auto-connects OpenClaw.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-text-secondary">Region</Label>
              <select
                value={requestedRegion}
                onChange={(e) =>
                  setRequestedRegion(e.target.value as ManagedRegionCode)
                }
                className="h-10 w-full rounded-md border border-border-default bg-bg-primary px-3 text-sm text-text-primary"
              >
                {MANAGED_REGION_OPTIONS.map((region) => (
                  <option key={region.code} value={region.code}>
                    {region.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-text-secondary">Launch mode</Label>
              <select
                value={serviceTier}
                onChange={(e) =>
                  setServiceTier(
                    e.target.value as "self_serve" | "assisted" | "managed",
                  )
                }
                className="h-10 w-full rounded-md border border-border-default bg-bg-primary px-3 text-sm text-text-primary"
              >
                <option value="self_serve">Guided self-serve</option>
                <option value="assisted">Assisted launch</option>
                <option value="managed">Managed operations</option>
              </select>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-text-secondary">Owner contact</Label>
              <Input
                value={ownerContact}
                onChange={(e) => setOwnerContact(e.target.value)}
                placeholder="name@company.com or +1 phone"
                className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-text-secondary">Setup status</Label>
              <select
                value={setupStatus}
                onChange={(e) =>
                  setSetupStatus(
                    e.target.value as
                      | "not_started"
                      | "infra_ready"
                      | "openclaw_ready"
                      | "agents_ready"
                      | "verified",
                  )
                }
                className="h-10 w-full rounded-md border border-border-default bg-bg-primary px-3 text-sm text-text-primary"
              >
                <option value="not_started">Not started</option>
                <option value="infra_ready">Infra ready</option>
                <option value="openclaw_ready">OpenClaw ready</option>
                <option value="agents_ready">Agents ready</option>
                <option value="verified">Verified</option>
              </select>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Label className="text-text-secondary">Support notes</Label>
            <Textarea
              value={supportNotes}
              onChange={(e) => setSupportNotes(e.target.value)}
              placeholder="Deployment preferences, tailnet notes, constraints, preferred regions..."
              className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
              rows={3}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-8"
              onClick={() => void onCreateProvisioningJob()}
            >
              Launch managed OpenClaw
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8"
              onClick={() => void onVerifyProvisioning()}
            >
              Verify stack
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8"
              onClick={() => void onRetryLatestJob()}
            >
              Retry latest job
            </Button>
            <Button
              type="button"
              className="h-8 bg-accent-orange hover:bg-accent-orange/90 text-white"
              onClick={() => void onRequestAssistedLaunch()}
            >
              <LifeBuoy className="mr-1 h-3.5 w-3.5" />
              Request assisted launch
            </Button>
          </div>

          {serviceMessage ? (
            <p className="mt-3 text-xs text-status-active">{serviceMessage}</p>
          ) : null}
          {serviceError ? (
            <p className="mt-3 text-xs text-status-blocked">{serviceError}</p>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2">
              <p className="text-[11px] text-text-dim">
                Latest provisioning job
              </p>
              <p className="mt-1 text-xs text-text-primary">
                {managedStatus?.latestJob
                  ? `${managedStatus.latestJob.status} · ${managedStatus.latestJob.step}`
                  : "No job yet"}
              </p>
            </div>
            <div className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2">
              <p className="text-[11px] text-text-dim">
                Latest assisted session
              </p>
              <p className="mt-1 text-xs text-text-primary">
                {assistedSessions[0]
                  ? `${assistedSessions[0].status} · ${new Date(
                      assistedSessions[0].createdAt,
                    ).toLocaleString()}`
                  : "No request yet"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary">
            BYO Model Provider Keys
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Workspace-level encrypted keys for managed OpenClaw runtime.
          </p>
          <div className="mt-3 rounded-md border border-status-review/40 bg-status-review/10 px-3 py-2">
            <p className="text-[11px] font-semibold text-status-review">
              API-key-only adapters currently supported
            </p>
            <p className="mt-1 text-[11px] text-text-secondary">
              If a provider requires login/session auth, integration is pending.
              OAuth/session adapters are not enabled yet.
            </p>
          </div>
          <div className="mt-4 space-y-4">
            {MODEL_PROVIDER_OPTIONS.map((providerOpt) => {
              const provider = providerOpt.id;
              const status = providerKeyStatuses.find((s) => s.provider === provider);
              return (
                <div
                  key={provider}
                  className="rounded-lg border border-border-default bg-bg-primary p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                      {providerOpt.label}
                    </p>
                    <p className="text-[11px] text-text-dim">
                      Status: {status?.status ?? "missing"}
                    </p>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Input
                      value={providerKeyDrafts[provider]}
                      onChange={(e) =>
                        setProviderKeyDrafts((prev) => ({
                          ...prev,
                          [provider]: e.target.value,
                        }))
                      }
                      placeholder={`Paste ${provider} key`}
                      className="bg-bg-secondary border-border-default text-text-primary placeholder:text-text-dim font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10"
                      onClick={() => void onSaveProviderKey(provider)}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              );
            })}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-8"
                onClick={() => void onValidateProviderKeys()}
              >
                Validate provider keys
              </Button>
              {providerKeyMessage ? (
                <span className="text-xs text-status-active">{providerKeyMessage}</span>
              ) : null}
              {providerKeyError ? (
                <span className="text-xs text-status-blocked">{providerKeyError}</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary mb-4">
            Connection
          </h2>
          <div className="space-y-4">
            {deploymentMode === "managed" ? (
              <div className="rounded-lg border border-border-default bg-bg-primary p-3">
                <p className="text-xs font-semibold text-text-primary">
                  Managed instance
                </p>
                <p className="mt-1 text-[11px] text-text-muted">
                  This workspace uses Sutraha-managed OpenClaw. Connection is auto-configured.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
                  <div className="rounded-md border border-border-default bg-bg-tertiary p-2">
                    <p className="text-[10px] text-text-dim">Region</p>
                    <p className="text-xs text-text-primary">
                      {managedRegionLabel(
                        managedStatus?.resolvedRegion || managedStatus?.requestedRegion,
                      )}
                    </p>
                  </div>
                  <div className="rounded-md border border-border-default bg-bg-tertiary p-2">
                    <p className="text-[10px] text-text-dim">Health</p>
                    <p className="text-xs text-text-primary">
                      {managedStatus?.managedStatus ?? "queued"}
                    </p>
                  </div>
                  <div className="rounded-md border border-border-default bg-bg-tertiary p-2">
                    <p className="text-[10px] text-text-dim">Setup</p>
                    <p className="text-xs text-text-primary">
                      {managedStatus?.setupStatus ?? setupStatus}
                    </p>
                  </div>
                  <div className="rounded-md border border-border-default bg-bg-tertiary p-2">
                    <p className="text-[10px] text-text-dim">Last connect</p>
                    <p className="text-xs text-text-primary">
                      {managedStatus?.managedConnectedAt
                        ? new Date(managedStatus.managedConnectedAt).toLocaleString()
                        : "Pending"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => void onVerifyProvisioning()}
                  >
                    Reconnect / Verify
                  </Button>
                  {managedStatus?.fallbackApplied ? (
                    <p className="text-[11px] text-text-dim">
                      Deployed to nearest available region.
                    </p>
                  ) : null}
                </div>
                {managedStatus?.latestJob?.logs?.length ? (
                  <div className="mt-3 rounded-md border border-border-default bg-bg-tertiary p-2">
                    <p className="text-[11px] font-semibold text-text-primary">
                      Live setup activity
                    </p>
                    <div className="mt-1 space-y-1 text-[11px] text-text-secondary">
                      {managedStatus.latestJob.logs.slice(-8).map((log: string) => (
                        <p key={log} className="font-mono">
                          {log}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {deploymentMode === "managed" ? null : (
            <>
            {transportMode === "connector" ? (
              <>
                <div className="rounded-lg border border-status-review/40 bg-status-review/10 px-3 py-2 text-[11px] text-status-review">
                  Private Connector is an advanced path for private networking operators.
                  Use Public WSS unless you need tailnet/private upstream routing.
                </div>
                <div className="space-y-2">
                  <Label className="text-text-secondary">Connector ID</Label>
                  <Input
                    value={connectorId}
                    onChange={(e) => setConnectorId(e.target.value)}
                    placeholder="connector-workspace-prod-01"
                    className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
                  />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2">
                    <p className="text-[11px] text-text-dim">
                      Connector status
                    </p>
                    <p className="mt-1 text-xs text-text-primary capitalize">
                      {connectorStatus}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2">
                    <p className="text-[11px] text-text-dim">Last seen</p>
                    <p className="mt-1 text-xs text-text-primary">
                      {connectorLastSeenAt
                        ? new Date(connectorLastSeenAt).toLocaleString()
                        : "Not reported"}
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2">
                  <p className="text-[11px] text-text-dim">
                    Connector startup template
                  </p>
                  <pre className="mt-1 overflow-auto whitespace-pre-wrap rounded bg-bg-primary p-2 font-mono text-[11px] text-text-primary">
                    {`SUTRAHA_CONNECTOR_ID=${connectorId || "<connector-id>"}
SUTRAHA_WORKSPACE_ID=${String(workspaceId)}
OPENCLAW_PRIVATE_WS_URL=ws://127.0.0.1:8788
./sutraha-connector start`}
                  </pre>
                  <p className="mt-2 text-[11px] text-text-dim">
                    Guide:{" "}
                    <Link
                      href="/docs/hosting/self-hosted/mcp"
                      className="text-accent-orange hover:underline"
                    >
                      Private-network setup documentation
                    </Link>
                  </p>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label className="text-text-secondary">WebSocket URL</Label>
                <Input
                  value={wsUrl}
                  onChange={(e) => setWsUrl(e.target.value)}
                  placeholder={
                    transportMode === "self_hosted_local"
                      ? "ws://localhost:8788"
                      : "wss://claw.sahayoga.in"
                  }
                  className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
                />
                <p className="text-[11px] text-text-dim">
                  Make sure this origin is allowed in OpenClaw:
                  <span className="ml-1 font-mono text-text-muted">
                    {origin}
                  </span>
                </p>
                {showMixedContentWarning ? (
                  <div className="rounded-md border border-status-review/40 bg-status-review/10 px-2.5 py-2 text-[11px] text-status-review">
                    This app is running on HTTPS. Browsers often block{" "}
                    <code className="font-mono">ws://</code> as mixed content.
                    Prefer <code className="font-mono">wss://</code>. Or use
                    Private Connector.
                  </div>
                ) : null}
                {transportMode === "self_hosted_local" ? (
                  <p className="text-[11px] text-text-dim">
                    Local mode is recommended only when Sutraha is also hosted
                    inside your private/local network.
                  </p>
                ) : null}
              </div>
            )}

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
            </>
            )}
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
          {deploymentMode === "managed" ? (
            <p className="text-[11px] text-text-dim">
              Managed mode handles gateway credentials automatically. No manual token/password entry is required.
            </p>
          ) : (
          <>
          <p className="mb-4 text-[11px] text-text-dim">
            {transportMode === "connector"
              ? "For connector/private network flows, you can use token or password auth."
              : "For direct WebSocket flows, use token/password as required by your gateway."}
          </p>
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
          </>
          )}
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
            Connection Health
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2">
              <p className="text-[11px] text-text-dim">Status</p>
              <p className="mt-1 text-xs text-text-primary">
                {connectionHealth}
              </p>
            </div>
            <div className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2">
              <p className="text-[11px] text-text-dim">Security</p>
              <p className="mt-1 text-xs text-text-primary">{securityUiStatus}</p>
            </div>
            <div className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2">
              <p className="text-[11px] text-text-dim">Method</p>
              <p className="mt-1 text-xs text-text-primary">
                {
                  OPENCLAW_METHOD_CARDS.find((m) => m.mode === transportMode)
                    ?.title
                }
              </p>
            </div>
            <div className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2">
              <p className="text-[11px] text-text-dim">Last test</p>
              <p className="mt-1 text-xs text-text-primary">
                {lastTestedAt
                  ? new Date(lastTestedAt).toLocaleString()
                  : "Not run"}
              </p>
            </div>
          </div>
          {validationState?.nextActions?.length ? (
            <p className="mt-3 text-xs text-text-muted">
              Next action: {validationState.nextActions[0]}
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary">
            Public WSS Security Checklist
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Default baseline for production. Complete and confirm after your test passes.
          </p>
          {transportMode === "direct_ws" ? (
            <div className="mt-3 space-y-3">
              <div className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2">
                <p className="text-[11px] text-text-dim">Current origin</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="rounded bg-bg-primary px-2 py-1 font-mono text-[11px] text-text-primary">
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
              </div>
              <div className="space-y-2">
                {PUBLIC_WSS_SECURITY_CHECKLIST.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-start gap-2 text-xs text-text-secondary"
                  >
                    <input
                      type="checkbox"
                      checked={securityChecklistAck[item.id]}
                      onChange={(e) =>
                        setSecurityChecklistAck((prev) => ({
                          ...prev,
                          [item.id]: e.target.checked,
                        }))
                      }
                      className="mt-0.5 h-4 w-4 accent-accent-orange"
                    />
                    {item.label}
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <Label className="text-text-secondary">
                  Hardening notes (optional)
                </Label>
                <Textarea
                  value={securityHardeningNotes}
                  onChange={(e) => setSecurityHardeningNotes(e.target.value)}
                  placeholder="Document controls: WAF, dashboard auth, IP allowlist, etc."
                  rows={2}
                  className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-8"
                  onClick={() => void onConfirmSecurityChecklist()}
                >
                  Confirm security checklist
                </Button>
                {securityStatus?.securityConfirmedAt ? (
                  <span className="text-xs text-status-active">
                    Confirmed at {new Date(securityStatus.securityConfirmedAt).toLocaleString()}
                  </span>
                ) : null}
              </div>
            </div>
          ) : transportMode === "connector" ? (
            <ol className="mt-3 list-decimal pl-5 space-y-2 text-xs text-text-secondary">
              <li>Save connector config and run connector runtime on private host.</li>
              <li>Wait for connector status to report online.</li>
              <li>Run Test and verify upstream health.</li>
              <li>Use this only for private-network/tailnet operation.</li>
            </ol>
          ) : (
            <ol className="mt-3 list-decimal pl-5 space-y-2 text-xs text-text-secondary">
              <li>Use self-hosted local only when Synclaw and OpenClaw share the same private/local network.</li>
              <li>Set local ws:// URL and verify browser/network policy allows it.</li>
              <li>Run Test and complete device approval + scope checks.</li>
            </ol>
          )}
        </div>

        <details className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <summary className="cursor-pointer text-sm font-semibold text-text-primary">
            Advanced diagnostics
          </summary>
          <p className="mt-2 text-xs text-text-muted">
            Diagnostics for this browser session.
          </p>

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
        </details>

        {summary ? (
          <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">
                  Setup guide
                </h2>
                <p className="mt-1 text-xs text-text-muted">
                  Open Setup Guide for the canonical workflow. Templates below
                  are minimal references.
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="h-8">
                <Link href="/help/agent-setup">Open Setup Guide</Link>
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
                  BYO mode: provider keys are stored encrypted at workspace scope.
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
                  {SYNCLAW_PROTOCOL_FILENAME}
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
