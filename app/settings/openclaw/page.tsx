"use client";

import { useAction, useConvex, useMutation, useQuery } from "convex/react";
import {
  Activity,
  Check,
  Copy,
  LifeBuoy,
  Server,
  Settings,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { LocalOpenClawConfigEditor } from "@/components/openclaw/LocalOpenClawConfigEditor";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { canUseCapability } from "@/lib/edition";
import {
  AGENT_SETUP_ADVANCED_ENABLED,
  ASSISTED_LAUNCH_BETA_ENABLED,
  MANAGED_BETA_ENABLED,
  MANAGED_INTERNAL_CONTROLS_ENABLED,
} from "@/lib/features";
import { WorkspaceSettingsTabs } from "@/components/settings/WorkspaceSettingsTabs";
import {
  MANAGED_REGION_OPTIONS,
  type ManagedRegionCode,
  managedRegionLabel,
} from "@/lib/managedRegions";
import {
  MANAGED_SERVER_PROFILES,
  type ManagedServerProfileCode,
  managedServerProfileByCode,
} from "@/lib/managedServerProfiles";
import {
  buildMainAgentBootstrapMessage,
  buildMcpServerConfigTemplate,
} from "@/lib/onboardingTemplates";
// import { setChatDraft } from "@/lib/chatDraft";
import { readStoredDeviceIdentityV2 } from "@/lib/openclaw/device-auth-v3";
import {
  clearOpenClawLocalAuthState,
  isOpenClawDeviceAuthEnabled,
  OPENCLAW_DEVICE_IDENTITY_STORAGE_KEY,
  OpenClawBrowserGatewayClient,
  type OpenClawConnectionStatus,
  openClawDeviceTokenStorageKey,
} from "@/lib/openclaw-gateway-client";
import {
  mapOpenClawSetupError,
  OPENCLAW_METHOD_CARDS,
  type OpenClawTransportMode,
  PUBLIC_WSS_SECURITY_CHECKLIST,
  recommendTransportMode,
} from "@/lib/openclawSetupMethods";
import {
  buildSynclawProtocolMd,
  SYNCLAW_PROTOCOL_FILENAME,
} from "@/lib/synclawProtocol";

const FIXED_GATEWAY_ROLE = "operator";
const FIXED_GATEWAY_SCOPES = [
  "operator.read",
  "operator.write",
  "operator.admin",
];

function OpenClawSettingsContent() {
  const { workspaceId, canAdmin, canManage, workspace } = useWorkspace();
  const convex = useConvex();
  const managedProvisioningEnabled =
    canUseCapability("managedProvisioning") &&
    MANAGED_BETA_ENABLED &&
    MANAGED_INTERNAL_CONTROLS_ENABLED;
  const assistedLaunchEnabled =
    canUseCapability("assistedLaunch") && ASSISTED_LAUNCH_BETA_ENABLED;

  const summary = useQuery(api.openclaw.getConfigSummary, { workspaceId });
  const upsert = useMutation(api.openclaw.upsertConfig);
  const confirmSecurityChecklist = useMutation(
    api.openclaw.confirmSecurityChecklist,
  );
  const createManagedJob = useMutation(
    api.managedProvisioning.createManagedJob,
  );
  const retryManagedJob = useMutation(api.managedProvisioning.retryJob);
  const verifyManagedConnection = useMutation(
    api.managedProvisioning.verifyManagedConnection,
  );
  const listHostingerDatacenters = useAction(
    api.managedProvisioning.listHostingerDatacenters,
  );
  const measureHostingerApiLatency = useAction(
    api.managedProvisioning.measureHostingerApiLatency,
  );
  const managedStatus = useQuery(
    api.managedProvisioning.getManagedStatus,
    managedProvisioningEnabled ? { workspaceId } : "skip",
  );
  const createAssistedSession = useMutation(api.support.createAssistedSession);
  const assistedSessions =
    useQuery(
      api.support.listAssistedSessions,
      assistedLaunchEnabled ? { workspaceId } : "skip",
    ) ?? [];
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
  const [deploymentMode, setDeploymentMode] = useState<"managed" | "manual">(
    "manual",
  );
  const [requestedRegion, setRequestedRegion] =
    useState<ManagedRegionCode>("lt");
  const [hostingerDatacenters, setHostingerDatacenters] = useState<
    Array<{ id: string; name: string; country?: string; city?: string }>
  >([]);
  const [apiLatencyMs, setApiLatencyMs] = useState<number | null>(null);
  const [measuringLatency, setMeasuringLatency] = useState(false);
  const [serverProfile, setServerProfile] =
    useState<ManagedServerProfileCode>("starter");
  const [serviceTier, setServiceTier] = useState<"self_serve" | "assisted">(
    "self_serve",
  );
  const [setupStatus, setSetupStatus] = useState<
    | "not_started"
    | "infra_ready"
    | "openclaw_ready"
    | "agents_ready"
    | "verified"
  >("not_started");
  const [ownerContact, setOwnerContact] = useState("");
  const [supportNotes, setSupportNotes] = useState("");
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
    // Not shown in UI; default true so users only confirm actionable steps.
    minimalScopes: true,
    // Not shown in UI; treated as part of test/probe flow.
    testPass: true,
    dashboardProtection: false,
  });
  const [securityHardeningNotes, setSecurityHardeningNotes] = useState("");
  const [serviceMessage, setServiceMessage] = useState<string | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const managedModeActive =
    managedProvisioningEnabled && deploymentMode === "managed";
  const copy = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: this effect intentionally rehydrates form state from the latest summary snapshot.
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
    setDeploymentMode(
      managedProvisioningEnabled
        ? ((summary.deploymentMode as "managed" | "manual") ?? "manual")
        : "manual",
    );
    setRequestedRegion(
      ((summary.managedRegionRequested ||
        summary.managedRegionResolved) as ManagedRegionCode) ?? "lt",
    );
    setServerProfile(
      (summary.managedServerProfile as ManagedServerProfileCode) ?? "starter",
    );
    setServiceTier(
      assistedLaunchEnabled && summary.serviceTier === "assisted"
        ? "assisted"
        : "self_serve",
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
    setIncludeCron(Boolean(summary.includeCron));
    setHistoryPollMs(String(summary.historyPollMs ?? 5000));
    setSecurityHardeningNotes(summary.publicWssHardeningNotes ?? "");
    // Don't populate secrets.
    setTokenDraft("");
    setTokenClear(false);
    setPasswordDraft("");
    setPasswordClear(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistedLaunchEnabled, managedProvisioningEnabled, summary?.updatedAt]);

  useEffect(() => {
    if (!managedProvisioningEnabled) return;
    listHostingerDatacenters().then((r) => {
      if (r.ok && r.datacenters?.length) setHostingerDatacenters(r.datacenters);
    });
  }, [managedProvisioningEnabled, listHostingerDatacenters]);

  const regionOptions = useMemo(() => {
    if (hostingerDatacenters.length > 0) {
      return hostingerDatacenters.map((dc) => ({
        code: dc.id as ManagedRegionCode,
        label: dc.country ? `${dc.name} (${dc.country})` : dc.name,
      }));
    }
    return MANAGED_REGION_OPTIONS;
  }, [hostingerDatacenters]);

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: localAuthRev intentionally forces storage re-read after explicit reset actions.
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
        FIXED_GATEWAY_ROLE,
      );
      const hasDeviceToken = Boolean(window.localStorage.getItem(key));
      return { hasDeviceIdentity, hasDeviceToken };
    } catch {
      return { hasDeviceIdentity: false, hasDeviceToken: false };
    }
  }, [wsUrl, localAuthRev]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: localAuthRev intentionally forces storage re-read after explicit reset actions.
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
        managedServerProfile: serverProfile,
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
        role: FIXED_GATEWAY_ROLE,
        scopes: FIXED_GATEWAY_SCOPES,
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
          forceDisableDeviceAuth:
            (cfg.deploymentMode ?? "manual") === "managed",
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
          const validation = await convex.query(
            api.openclaw.validatePublicWssConfig,
            {
              workspaceId,
            },
          );
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
        { deploymentMode },
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
    if (!managedProvisioningEnabled) {
      setServiceMessage(
        "Managed setup is private beta right now. Continue with BYO OpenClaw, or contact support for managed access.",
      );
      return;
    }
    try {
      const result = await createManagedJob({
        workspaceId,
        requestedRegion,
        serviceTier,
        serverProfile,
      });
      setDeploymentMode("managed");
      setSetupStatus("verified");
      setServiceMessage(
        result.fallbackApplied
          ? `Provisioning started. Requested region unavailable; deploying to nearest available region: ${managedRegionLabel(result.resolvedRegion, regionOptions)}.`
          : `Provisioning started in ${managedRegionLabel(result.resolvedRegion, regionOptions)}.`,
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
    if (!managedProvisioningEnabled) {
      setServiceMessage(
        "BYO mode: run Reconnect / Verify to validate your current wsUrl and auth settings.",
      );
      return;
    }
    try {
      const result = await verifyManagedConnection({ workspaceId });
      setSetupStatus(result.ok ? "verified" : "openclaw_ready");
      setServiceMessage(
        result.ok ? "Managed connection verified." : result.nextAction,
      );
    } catch (e) {
      setServiceError(e instanceof Error ? e.message : String(e));
    }
  };

  const onRequestAssistedLaunch = async () => {
    setServiceError(null);
    setServiceMessage(null);
    if (!assistedLaunchEnabled) {
      setServiceError("Assisted launch is not available in this edition.");
      return;
    }
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
        `Assisted launch requested (${String(result.sessionId)}). Team will follow up via owner contact.`,
      );
    } catch (e) {
      setServiceError(e instanceof Error ? e.message : String(e));
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

        <WorkspaceSettingsTabs active="openclaw" canManage={canManage} />

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

      <WorkspaceSettingsTabs active="openclaw" canManage={canManage} />

      <div className="space-y-8">
        {managedProvisioningEnabled ? (
          <>
            <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
              <h2 className="text-sm font-semibold text-text-primary mb-1">
                Connection Method
              </h2>
              <p className="text-xs text-text-muted">
                Choose how this workspace connects to OpenClaw. Switching
                methods can require a different setup path.
              </p>
              <p className="mt-1 text-[11px] text-text-dim">
                Switching method may require a new URL/auth strategy and a fresh
                connectivity test.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {OPENCLAW_METHOD_CARDS.filter(
                  (m) => m.mode !== "connector",
                ).map((method) => {
                  const active = transportMode === method.mode;
                  const suggested = recommendedMode === method.mode;
                  return (
                    <button
                      key={method.mode}
                      type="button"
                      onClick={() => {
                        if (managedModeActive) return;
                        setTransportMode(method.mode);
                      }}
                      className={`rounded-xl border p-3 text-left ${
                        active
                          ? "border-accent-orange/50 bg-accent-orange/10"
                          : "border-border-default bg-bg-primary"
                      } ${managedModeActive ? "opacity-60 cursor-not-allowed" : ""}`}
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
                })}
              </div>
              <details className="mt-2 rounded-xl border border-border-default bg-bg-primary p-3">
                <summary className="cursor-pointer text-xs font-semibold text-text-primary">
                  Advanced: Private Connector
                </summary>
                <p className="mt-2 text-[11px] text-text-muted">
                  Experimental/advanced until relay runtime is fully available.
                </p>
                {OPENCLAW_METHOD_CARDS.filter(
                  (m) => m.mode === "connector",
                ).map((method) => {
                  const active = transportMode === method.mode;
                  return (
                    <button
                      key={method.mode}
                      type="button"
                      onClick={() => {
                        if (managedModeActive) return;
                        setTransportMode(method.mode);
                      }}
                      className={`mt-2 w-full rounded-xl border p-3 text-left ${
                        active
                          ? "border-accent-orange/50 bg-accent-orange/10"
                          : "border-border-default bg-bg-secondary"
                      } ${managedModeActive ? "opacity-60 cursor-not-allowed" : ""}`}
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
                })}
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
                Managed cloud setup: choose region and launch mode, then Sutraha
                provisions and auto-connects OpenClaw.
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
                    {regionOptions.length === 0 ? (
                      <option value="lt">Lithuania (default)</option>
                    ) : (
                      regionOptions.map((region) => (
                        <option key={region.code} value={region.code}>
                          {region.label}
                          {apiLatencyMs != null ? ` — ~${apiLatencyMs} ms` : ""}
                        </option>
                      ))
                    )}
                  </select>
                  {hostingerDatacenters.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-dim">
                      <span>
                        API latency:{" "}
                        {measuringLatency
                          ? "Measuring…"
                          : apiLatencyMs != null
                            ? `~${apiLatencyMs} ms`
                            : "—"}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        disabled={measuringLatency}
                        onClick={async () => {
                          setMeasuringLatency(true);
                          try {
                            const r = await measureHostingerApiLatency();
                            if (r.ok && r.latencyMs != null)
                              setApiLatencyMs(r.latencyMs);
                          } finally {
                            setMeasuringLatency(false);
                          }
                        }}
                      >
                        Measure latency
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label className="text-text-secondary">Launch mode</Label>
                  <select
                    value={serviceTier}
                    onChange={(e) =>
                      setServiceTier(
                        e.target.value as "self_serve" | "assisted",
                      )
                    }
                    className="h-10 w-full rounded-md border border-border-default bg-bg-primary px-3 text-sm text-text-primary"
                  >
                    <option value="self_serve">Guided self-serve</option>
                    {assistedLaunchEnabled ? (
                      <option value="assisted">Assisted launch</option>
                    ) : null}
                  </select>
                  <p className="text-[11px] text-text-dim">
                    {serviceTier === "assisted"
                      ? "Assisted launch creates a support request; status appears below in Latest assisted session."
                      : "Guided self-serve means no support ticket is created unless you explicitly request it."}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Label className="text-text-secondary">Server size</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {MANAGED_SERVER_PROFILES.map((profile) => {
                    const selected = serverProfile === profile.code;
                    return (
                      <button
                        key={profile.code}
                        type="button"
                        onClick={() => setServerProfile(profile.code)}
                        className={`rounded-md border p-2 text-left ${
                          selected
                            ? "border-accent-orange/50 bg-accent-orange/10"
                            : "border-border-default bg-bg-primary"
                        }`}
                      >
                        <p className="text-xs font-semibold text-text-primary">
                          {profile.label}
                        </p>
                        <p className="mt-1 text-[10px] text-text-muted">
                          {profile.serverType} · {profile.vcpu} vCPU ·{" "}
                          {profile.ramGb}GB RAM
                        </p>
                        <p className="text-[10px] text-text-muted">
                          {profile.storageGb}GB {profile.storageType} ·{" "}
                          {profile.costTier} cost
                        </p>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-text-dim">
                  {managedServerProfileByCode(serverProfile).description}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                {assistedLaunchEnabled && serviceTier === "assisted" ? (
                  <div className="space-y-2">
                    <Label className="text-text-secondary">Owner contact</Label>
                    <Input
                      value={ownerContact}
                      onChange={(e) => setOwnerContact(e.target.value)}
                      placeholder="name@company.com or +1 phone"
                      className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
                    />
                  </div>
                ) : null}
              </div>

              {assistedLaunchEnabled && serviceTier === "assisted" ? (
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
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {assistedLaunchEnabled && serviceTier === "assisted" ? (
                  <Button
                    type="button"
                    className="h-8 bg-accent-orange hover:bg-accent-orange/90 text-white"
                    onClick={() => void onRequestAssistedLaunch()}
                  >
                    <LifeBuoy className="mr-1 h-3.5 w-3.5" />
                    Request assisted launch
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8"
                    onClick={() => void onCreateProvisioningJob()}
                  >
                    Launch managed OpenClaw
                  </Button>
                )}
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
              </div>
              {assistedLaunchEnabled && serviceTier === "assisted" ? (
                <p className="mt-2 text-[11px] text-text-dim">
                  Assisted launch creates a support request only. Infra
                  provisioning starts when support triggers setup.
                </p>
              ) : null}

              {serviceMessage ? (
                <p className="mt-3 text-xs text-status-active">
                  {serviceMessage}
                </p>
              ) : null}
              {serviceError ? (
                <p className="mt-3 text-xs text-status-blocked">
                  {serviceError}
                </p>
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
                  {managedStatus?.latestJob?.failureCode ? (
                    <p className="mt-1 text-[11px] text-status-blocked">
                      Failure code: {managedStatus.latestJob.failureCode}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-text-dim">
                    Server:{" "}
                    {managedStatus?.serverType ||
                      managedServerProfileByCode(serverProfile).serverType}{" "}
                    (
                    {
                      managedServerProfileByCode(
                        managedStatus?.serverProfile ?? serverProfile,
                      ).label
                    }
                    )
                  </p>
                </div>
                {assistedLaunchEnabled ? (
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
                ) : null}
              </div>
            </div>
          </>
        ) : null}

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary mb-4">
            Connection
          </h2>
          <div className="space-y-4">
            {managedModeActive ? (
              <div className="rounded-lg border border-border-default bg-bg-primary p-3">
                <p className="text-xs font-semibold text-text-primary">
                  Managed instance
                </p>
                <p className="mt-1 text-[11px] text-text-muted">
                  This workspace uses Sutraha-managed OpenClaw. Connection is
                  auto-configured.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
                  <div className="rounded-md border border-border-default bg-bg-tertiary p-2">
                    <p className="text-[10px] text-text-dim">Region</p>
                    <p className="text-xs text-text-primary">
                      {managedRegionLabel(
                        managedStatus?.resolvedRegion ||
                          managedStatus?.requestedRegion,
                        regionOptions,
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
                        ? new Date(
                            managedStatus.managedConnectedAt,
                          ).toLocaleString()
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
                      {managedStatus.latestJob.logs
                        .slice(-8)
                        .map((log: string) => (
                          <p key={log} className="font-mono">
                            {log}
                          </p>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {managedModeActive ? null : (
              <>
                {transportMode === "connector" ? (
                  <>
                    <div className="rounded-lg border border-status-review/40 bg-status-review/10 px-3 py-2 text-[11px] text-status-review">
                      Private Connector is an advanced path for private
                      networking operators. Use Public WSS unless you need
                      tailnet/private upstream routing.
                    </div>
                    <div className="space-y-2">
                      <Label className="text-text-secondary">
                        Connector ID
                      </Label>
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
                        <code className="font-mono">ws://</code> as mixed
                        content. Prefer{" "}
                        <code className="font-mono">wss://</code>. Or use
                        Private Connector.
                      </div>
                    ) : null}
                    {transportMode === "self_hosted_local" ? (
                      <p className="text-[11px] text-text-dim">
                        Local mode is recommended only when Sutraha is also
                        hosted inside your private/local network.
                      </p>
                    ) : null}
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-text-secondary">Protocol</Label>
                  <Input
                    value="req"
                    readOnly
                    className="bg-bg-primary border-border-default text-text-primary font-mono text-xs"
                  />
                  <p className="text-[11px] text-text-dim">
                    Role/scopes are managed automatically for this workspace.
                  </p>
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

            {canManage ? (
              <p className="text-xs text-text-muted">
                <Link
                  href="/admin/cron"
                  className="font-medium text-accent-orange hover:underline"
                >
                  Manage gateway cron jobs
                </Link>{" "}
                (schedules and run history on your OpenClaw gateway).
              </p>
            ) : null}

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
          {managedModeActive ? (
            <p className="text-[11px] text-text-dim">
              Managed mode handles gateway credentials automatically. No manual
              token/password entry is required.
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
                  <Label className="text-text-secondary">
                    Replace password
                  </Label>
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
            {testing
              ? "Testing..."
              : managedModeActive
                ? "Initiate pairing handshake / Test"
                : "Reconnect / Verify (BYO)"}
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
              <p className="mt-1 text-xs text-text-primary">
                {securityUiStatus}
              </p>
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
            Default baseline for production. Complete and confirm after your
            test passes.
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
                    Confirmed at{" "}
                    {new Date(
                      securityStatus.securityConfirmedAt,
                    ).toLocaleString()}
                  </span>
                ) : null}
              </div>
            </div>
          ) : transportMode === "connector" ? (
            <ol className="mt-3 list-decimal pl-5 space-y-2 text-xs text-text-secondary">
              <li>
                Save connector config and run connector runtime on private host.
              </li>
              <li>Wait for connector status to report online.</li>
              <li>Run Test and verify upstream health.</li>
              <li>Use this only for private-network/tailnet operation.</li>
            </ol>
          ) : (
            <ol className="mt-3 list-decimal pl-5 space-y-2 text-xs text-text-secondary">
              <li>
                Use self-hosted local only when Synclaw and OpenClaw share the
                same private/local network.
              </li>
              <li>
                Set local ws:// URL and verify browser/network policy allows it.
              </li>
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
                  FIXED_GATEWAY_ROLE,
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

        {summary && AGENT_SETUP_ADVANCED_ENABLED ? (
          <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">
                  Setup diagnostics
                </h2>
                <p className="mt-1 text-xs text-text-muted">
                  Internal setup references and diagnostic templates.
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
                  BYO mode: provider keys are stored encrypted at workspace
                  scope.
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
