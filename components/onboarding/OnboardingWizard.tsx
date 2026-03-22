"use client";

import { useAction, useConvex, useMutation, useQuery } from "convex/react";
import { Check, LifeBuoy, Server, Settings2, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { setChatDraft } from "@/lib/chatDraft";
import { canUseCapability } from "@/lib/edition";
import {
  AGENT_SETUP_ADVANCED_ENABLED,
  ASSISTED_LAUNCH_BETA_ENABLED,
  MANAGED_BETA_ENABLED,
  MANAGED_INTERNAL_CONTROLS_ENABLED,
} from "@/lib/features";
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
import { buildMainAgentBootstrapMessage } from "@/lib/onboardingTemplates";
import { OpenClawBrowserGatewayClient } from "@/lib/openclaw-gateway-client";
import {
  mapOpenClawSetupError,
  OPENCLAW_METHOD_CARDS,
  type OpenClawTransportMode,
  PUBLIC_WSS_SECURITY_CHECKLIST,
  recommendTransportMode,
} from "@/lib/openclawSetupMethods";

type Protocol = "req";
type ModelProviderId =
  | "openai"
  | "anthropic"
  | "gemini"
  | "google_antigravity"
  | "z_ai"
  | "minimax";
type ManagedProviderId = "openai" | "anthropic" | "gemini";

const MODEL_PROVIDER_OPTIONS: Array<{ id: ModelProviderId; label: string }> = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "gemini", label: "Gemini" },
  { id: "google_antigravity", label: "Google Antigravity" },
  { id: "z_ai", label: "Z.ai" },
  { id: "minimax", label: "Minimax" },
];
const MANAGED_PROVIDER_OPTIONS: Array<{
  id: ManagedProviderId;
  label: string;
}> = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "gemini", label: "Gemini" },
];

const FIXED_GATEWAY_ROLE = "operator";
const FIXED_GATEWAY_SCOPES = [
  "operator.read",
  "operator.write",
  "operator.admin",
];

function isPairingRequiredMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("not_paired") ||
    lower.includes("pairing required") ||
    lower.includes("device identity mismatch") ||
    lower.includes("device signature invalid")
  );
}

function isManagedProviderId(
  value: ModelProviderId,
): value is ManagedProviderId {
  return value === "openai" || value === "anthropic" || value === "gemini";
}

function mapOneClickSetupError(
  code: string | undefined,
  message: string,
): string {
  switch (code) {
    case "BRIDGE_UNAVAILABLE":
      return "Remote files bridge is not reachable. Verify OpenClaw files bridge and retry.";
    case "BRIDGE_WRITE_FAILED":
      return `Failed to write setup files to workspace directory. ${message}`;
    case "TEMPLATE_VALIDATION_FAILED":
      return `Template validation failed after write. ${message}`;
    case "ROLLBACK_FAILED":
      return `Setup failed and rollback also failed. ${message}`;
    case "DUPLICATE_SESSION_KEY":
      return "An agent with sessionKey agent:main:main already exists.";
    case "AGENT_LIMIT_REACHED":
      return "Workspace agent limit reached. Upgrade plan or archive an agent, then retry.";
    default:
      return message;
  }
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
  const { workspaceId, workspace, canAdmin, membershipId } = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const convex = useConvex();
  const managedCapabilityEnabled = canUseCapability("managedProvisioning");
  const managedProvisioningEnabled =
    managedCapabilityEnabled &&
    MANAGED_BETA_ENABLED &&
    MANAGED_INTERNAL_CONTROLS_ENABLED;
  const managedSelfServeVisible = managedCapabilityEnabled;
  const assistedLaunchEnabled =
    canUseCapability("assistedLaunch") && ASSISTED_LAUNCH_BETA_ENABLED;

  const status = useQuery(api.onboarding.getStatus, { workspaceId });
  const members = useQuery(api.workspaces.getMembers, { workspaceId }) ?? [];
  const summary = useQuery(api.openclaw.getConfigSummary, { workspaceId });
  const upsertOpenClaw = useMutation(api.openclaw.upsertConfig);
  const confirmSecurityChecklist = useMutation(
    api.openclaw.confirmSecurityChecklist,
  );
  const securityStatus = useQuery(api.openclaw.getSecurityStatus, {
    workspaceId,
  });
  const createManagedJob = useMutation(
    api.managedProvisioning.createManagedJob,
  );
  const retryManagedJob = useMutation(api.managedProvisioning.retryJob);
  const verifyManagedConnection = useMutation(
    api.managedProvisioning.verifyManagedConnection,
  );
  const managedStatus = useQuery(
    api.managedProvisioning.getManagedStatus,
    canAdmin && managedProvisioningEnabled ? { workspaceId } : "skip",
  );
  const createAssistedSession = useMutation(api.support.createAssistedSession);
  const assistedSessions = useQuery(
    api.support.listAssistedSessions,
    canAdmin && assistedLaunchEnabled ? { workspaceId } : "skip",
  );
  const upsertWorkspaceKey = useMutation(api.modelKeys.upsertWorkspaceKey);
  const validateWorkspaceKeys = useMutation(
    api.modelKeys.validateWorkspaceKeys,
  );
  const applyManagedProviderConfig = useAction(
    (api.managedProvisioning as Record<string, unknown>)
      .applyManagedProviderConfig as any,
  );
  const listHostingerDatacenters = useAction(
    api.managedProvisioning.listHostingerDatacenters,
  );
  const measureHostingerApiLatency = useAction(
    api.managedProvisioning.measureHostingerApiLatency,
  );
  const providerKeyStatuses =
    useQuery(
      api.modelKeys.listWorkspaceKeyStatus,
      canAdmin ? { workspaceId } : "skip",
    ) ?? [];
  const createAgentOneClick = useAction(api.agentSetup.createAgentOneClick);

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
  const [tokenDraft, setTokenDraft] = useState("");
  const [passwordDraft, setPasswordDraft] = useState("");
  const [protocol, setProtocol] = useState<Protocol>("req");
  const [clientId, setClientId] = useState("openclaw-control-ui");
  const [clientMode, setClientMode] = useState("webchat");
  const [clientPlatform, setClientPlatform] = useState("web");
  const [needsManagedSetup, setNeedsManagedSetup] = useState(false);
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
  const [subscribeOnConnect, setSubscribeOnConnect] = useState(false);
  const [subscribeMethod, setSubscribeMethod] = useState("chat.subscribe");
  const [includeCron, setIncludeCron] = useState(true);
  const [historyPollMs, setHistoryPollMs] = useState("5000");
  const [securityHardeningNotes, setSecurityHardeningNotes] = useState("");
  const [securityChecklistAck, setSecurityChecklistAck] = useState({
    allowedOrigins: false,
    deviceApproval: false,
    // Not shown in UI; default true so users only confirm actionable steps.
    minimalScopes: true,
    // Not shown in UI; covered by connection probe + Test & Save flow.
    testPass: true,
    dashboardProtection: false,
  });

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    | { status: "idle" }
    | { status: "ok"; message: string }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const [serviceMessage, setServiceMessage] = useState<string | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<ModelProviderId>("openai");
  const [providerKeyDraft, setProviderKeyDraft] = useState("");
  const [providerMessage, setProviderMessage] = useState<string | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [providerSaving, setProviderSaving] = useState(false);
  const [providerAutoApplying, setProviderAutoApplying] = useState(false);
  const [providerChecks, setProviderChecks] = useState<{
    keyStored: boolean;
    appliedToManagedHost: boolean;
    serviceRestarted: boolean;
    portListening: boolean;
    modelRuntimeReady: boolean;
  } | null>(null);
  const [deviceApprovalTesting, setDeviceApprovalTesting] = useState(false);
  const [deviceApprovalProbeDone, setDeviceApprovalProbeDone] = useState(false);
  const [deviceApprovalProbeResult, setDeviceApprovalProbeResult] = useState<
    | { status: "idle" }
    | { status: "ok"; message: string }
    | { status: "error"; message: string }
  >({ status: "idle" });

  useEffect(() => {
    if (!summary) return;
    setTransportMode(
      (summary.transportMode as OpenClawTransportMode) ?? "direct_ws",
    );
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
    setNeedsManagedSetup(
      managedProvisioningEnabled &&
        (summary.deploymentMode ?? "manual") === "managed",
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
    setProtocol((summary.protocol as Protocol) ?? "req");
    setClientId(summary.clientId ?? "openclaw-control-ui");
    setClientMode(summary.clientMode ?? "webchat");
    setClientPlatform(summary.clientPlatform ?? "web");
    setSubscribeOnConnect(Boolean(summary.subscribeOnConnect));
    setSubscribeMethod(summary.subscribeMethod ?? "chat.subscribe");
    setIncludeCron(Boolean(summary.includeCron));
    setHistoryPollMs(String(summary.historyPollMs ?? 5000));
    setSecurityHardeningNotes(summary.publicWssHardeningNotes ?? "");
    setTokenDraft("");
    setPasswordDraft("");
    setTestResult({ status: "idle" });
    setDeviceApprovalProbeDone(false);
    setDeviceApprovalProbeResult({ status: "idle" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistedLaunchEnabled, managedProvisioningEnabled, summary?.updatedAt]);

  useEffect(() => {
    if (!securityStatus?.securityConfirmedAt) return;
    setSecurityChecklistAck({
      allowedOrigins: true,
      deviceApproval: true,
      minimalScopes: true,
      testPass: true,
      dashboardProtection: true,
    });
  }, [securityStatus?.securityConfirmedAt]);

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

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);
  const isHttpsPage =
    typeof window !== "undefined" && window.location.protocol === "https:";
  const recommendedMode = useMemo(
    () => recommendTransportMode(wsUrl, isHttpsPage),
    [isHttpsPage, wsUrl],
  );
  const showMixedContentWarning =
    isHttpsPage && wsUrl.trim().toLowerCase().startsWith("ws://");
  const allSecurityChecksConfirmed =
    Object.values(securityChecklistAck).every(Boolean);

  const step1Done = Boolean(status?.openclawConfigured);
  const requiresProviderKey = Boolean(status?.requiresProviderKey);
  const step2Done = requiresProviderKey
    ? Boolean(status?.providerKeyReady)
    : true;
  const step3Done = Boolean(status?.mainAgentId);
  const managedSetupUiEnabled = managedProvisioningEnabled && needsManagedSetup;
  const providerOptions =
    deploymentMode === "managed" || managedSetupUiEnabled
      ? MANAGED_PROVIDER_OPTIONS
      : MODEL_PROVIDER_OPTIONS;
  const selectedProviderKeyStatus =
    providerKeyStatuses.find((row) => row.provider === providerId) ?? null;
  const canLaunchManagedProvisioning =
    selectedProviderKeyStatus?.status === "valid";
  const pairingHintVisible =
    testResult.status === "error" &&
    isPairingRequiredMessage(testResult.message);
  const latestManagedJobFailed = managedStatus?.latestJob?.status === "failed";
  const managedSetupFailed =
    managedProvisioningEnabled &&
    (managedStatus?.managedStatus === "failed" || latestManagedJobFailed);
  const currentMember = useMemo(
    () => members.find((m) => m._id === membershipId) ?? null,
    [members, membershipId],
  );
  const firstValidManagedProvider = useMemo(
    () =>
      providerKeyStatuses.find(
        (row) =>
          row.status === "valid" &&
          row.provider === providerId &&
          (row.provider === "openai" ||
            row.provider === "anthropic" ||
            row.provider === "gemini"),
      ) ??
      providerKeyStatuses.find(
        (row) =>
          row.status === "valid" &&
          (row.provider === "openai" ||
            row.provider === "anthropic" ||
            row.provider === "gemini"),
      ) ??
      null,
    [providerId, providerKeyStatuses],
  );

  useEffect(() => {
    // Prefill assisted owner contact from the current signed-in user's email.
    if (ownerContact.trim()) return;
    const email = (currentMember?.email ?? "").trim();
    if (!email) return;
    setOwnerContact(email);
  }, [currentMember?.email, ownerContact]);

  useEffect(() => {
    const shouldAutoApply =
      canAdmin &&
      managedProvisioningEnabled &&
      requiresProviderKey &&
      deploymentMode === "managed" &&
      (summary?.provisioningMode ?? "customer_vps") === "sutraha_managed" &&
      Boolean(managedStatus?.upstreamHost?.trim()) &&
      managedStatus?.providerRuntimeStatus !== "ready" &&
      Boolean(firstValidManagedProvider) &&
      !providerSaving &&
      !providerAutoApplying;
    if (!shouldAutoApply || !firstValidManagedProvider) return;

    let canceled = false;
    setProviderAutoApplying(true);
    setProviderError(null);
    setProviderMessage("Applying saved provider key to managed host...");
    void applyManagedProviderConfig({
      workspaceId,
      provider: firstValidManagedProvider.provider as
        | "openai"
        | "anthropic"
        | "gemini",
    })
      .then((result) => {
        if (canceled) return;
        setProviderChecks(result.checks ?? null);
        if (result.ok) {
          setProviderMessage(
            `Saved provider auto-applied and runtime-validated (${firstValidManagedProvider.provider} / ${result.defaultModel}).`,
          );
        } else {
          setProviderError(
            result.error ?? "Managed provider auto-apply failed.",
          );
          setProviderMessage(
            `Saved provider key found, but runtime validation failed: ${result.error ?? "Unknown error"}`,
          );
        }
      })
      .catch((error) => {
        if (canceled) return;
        setProviderError(
          error instanceof Error ? error.message : String(error),
        );
      })
      .finally(() => {
        if (!canceled) setProviderAutoApplying(false);
      });

    return () => {
      canceled = true;
    };
  }, [
    applyManagedProviderConfig,
    canAdmin,
    deploymentMode,
    firstValidManagedProvider,
    managedProvisioningEnabled,
    managedStatus?.providerRuntimeStatus,
    managedStatus?.upstreamHost,
    providerAutoApplying,
    providerSaving,
    requiresProviderKey,
    summary?.provisioningMode,
    workspaceId,
  ]);

  const probeGatewayConnection = async () => {
    let connectorOfflineWarning = false;
    if (transportMode === "connector") {
      if (!connectorId.trim()) {
        throw new Error("Connector ID is required for Private Connector.");
      }
      if (connectorStatus !== "online") {
        connectorOfflineWarning = true;
      }
      return { connectorOfflineWarning };
    }

    if (!wsUrl.trim()) throw new Error("WebSocket URL is required.");
    const client = new OpenClawBrowserGatewayClient(
      {
        wsUrl: wsUrl.trim(),
        protocol,
        authToken: tokenDraft.trim() ? tokenDraft.trim() : undefined,
        password: passwordDraft.trim() ? passwordDraft.trim() : undefined,
        forceDisableDeviceAuth: deploymentMode === "managed",
        clientId,
        clientMode,
        clientPlatform,
        role: FIXED_GATEWAY_ROLE,
        scopes: FIXED_GATEWAY_SCOPES,
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

    return { connectorOfflineWarning };
  };

  const onTestAndSave = async () => {
    setTesting(true);
    setTestResult({ status: "idle" });
    try {
      const { connectorOfflineWarning } = await probeGatewayConnection();

      await upsertOpenClaw({
        workspaceId,
        wsUrl: wsUrl.trim(),
        transportMode,
        recommendedMethod:
          recommendedMode === "direct_ws"
            ? "public_wss"
            : recommendedMode === "connector"
              ? "connector_advanced"
              : "self_hosted_local",
        deploymentMode,
        provisioningMode: "sutraha_managed",
        serviceTier,
        managedServerProfile: serverProfile,
        setupStatus,
        ownerContact,
        supportNotes,
        connectorId: connectorId.trim() || undefined,
        connectorStatus,
        connectorLastSeenAt,
        protocol,
        clientId,
        clientMode,
        clientPlatform,
        role: FIXED_GATEWAY_ROLE,
        scopes: FIXED_GATEWAY_SCOPES,
        subscribeOnConnect,
        subscribeMethod,
        includeCron,
        historyPollMs: Number(historyPollMs || "0"),
        authToken: tokenDraft.trim() ? tokenDraft.trim() : undefined,
        password: passwordDraft.trim() ? passwordDraft.trim() : undefined,
      });

      setTokenDraft("");
      setPasswordDraft("");
      if (transportMode === "direct_ws") {
        const validation = await convex.query(
          api.openclaw.validatePublicWssConfig,
          {
            workspaceId,
          },
        );
        if (!validation.ok) {
          setTestResult({
            status: "error",
            message:
              validation.errors[0] ?? "Public WSS security validation failed.",
          });
          return;
        }
        if (!allSecurityChecksConfirmed) {
          setTestResult({
            status: "error",
            message:
              "Connected and saved. Complete the Public WSS security checklist acknowledgement to mark this setup secure.",
          });
          return;
        }
        await confirmSecurityChecklist({
          workspaceId,
          checklistAck: securityChecklistAck,
          hardeningNotes: securityHardeningNotes.trim() || undefined,
        });
        setTestResult({
          status: "ok",
          message:
            "Connected, saved, and Public WSS security checklist confirmed.",
        });
        return;
      }
      setTestResult({
        status: connectorOfflineWarning ? "error" : "ok",
        message:
          transportMode === "connector"
            ? connectorOfflineWarning
              ? "Saved, but connector is offline. Start connector and run test again."
              : "Connector configuration saved."
            : "Connected and saved.",
      });
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setTestResult({
        status: "error",
        message: mapOpenClawSetupError(raw, transportMode, { deploymentMode }),
      });
    } finally {
      setTesting(false);
    }
  };

  const onRequestDeviceApproval = async () => {
    setDeviceApprovalTesting(true);
    setDeviceApprovalProbeResult({ status: "idle" });
    try {
      await probeGatewayConnection();
      setDeviceApprovalProbeDone(true);
      setSecurityChecklistAck((prev) => ({ ...prev, deviceApproval: true }));
      setDeviceApprovalProbeResult({
        status: "ok",
        message:
          "Connection probe succeeded. Device approval is now validated for this browser.",
      });
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setDeviceApprovalProbeDone(true);
      setDeviceApprovalProbeResult({
        status: "error",
        message:
          `${mapOpenClawSetupError(raw, transportMode, { deploymentMode })} ` +
          "If pairing is pending, approve this browser/device in OpenClaw and run this probe again.",
      });
    } finally {
      setDeviceApprovalTesting(false);
    }
  };

  const onCreateProvisioningJob = async () => {
    setServiceError(null);
    setServiceMessage(null);
    if (!managedProvisioningEnabled) {
      setNeedsManagedSetup(false);
      setDeploymentMode("manual");
      setServiceMessage(
        "Managed setup is private beta right now. Continue with BYO OpenClaw, or contact support for managed access.",
      );
      return;
    }
    if (!isManagedProviderId(providerId)) {
      setServiceError(
        "Managed setup supports OpenAI, Anthropic, or Gemini only.",
      );
      return;
    }
    if (!canLaunchManagedProvisioning) {
      setServiceError(
        "Save and validate a provider key (OpenAI, Anthropic, or Gemini) before launching managed setup.",
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
      setNeedsManagedSetup(true);
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

  const onRequestAssisted = async () => {
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
        `Assisted launch requested (${String(result.sessionId)}). Team follow-up will happen via owner contact.`,
      );
    } catch (e) {
      setServiceError(e instanceof Error ? e.message : String(e));
    }
  };

  const onRestartManagedSetup = async () => {
    setServiceError(null);
    setServiceMessage(null);
    if (!managedProvisioningEnabled) {
      setServiceMessage(
        "Managed setup is private beta right now. Continue with BYO OpenClaw, or contact support for managed access.",
      );
      return;
    }
    try {
      const regionChanged =
        Boolean(managedStatus?.requestedRegion) &&
        managedStatus?.requestedRegion !== requestedRegion;
      // If user changed region after a failure, start a fresh provisioning job.
      if (regionChanged || !managedStatus?.latestJob?._id) {
        await onCreateProvisioningJob();
        return;
      }
      if (managedStatus.latestJob._id) {
        const result = await retryManagedJob({
          workspaceId,
          jobId: managedStatus.latestJob._id,
        });
        setServiceMessage(
          result.fallbackApplied
            ? `Setup restarted. Requested region unavailable; retrying in nearest available region: ${managedRegionLabel(result.resolvedRegion, regionOptions)}.`
            : `Setup restarted in ${managedRegionLabel(result.resolvedRegion, regionOptions)}.`,
        );
      } else {
        await onCreateProvisioningJob();
      }
    } catch (e) {
      setServiceError(e instanceof Error ? e.message : String(e));
    }
  };

  const onSaveProviderKey = async () => {
    setProviderError(null);
    setProviderMessage(null);
    if (!providerKeyDraft.trim()) {
      setProviderError("Provider API key is required.");
      return;
    }
    setProviderSaving(true);
    try {
      setProviderChecks(null);
      await upsertWorkspaceKey({
        workspaceId,
        provider: providerId,
        key: providerKeyDraft.trim(),
      });
      const hasManagedHost = Boolean(managedStatus?.upstreamHost?.trim());
      if (
        requiresProviderKey &&
        deploymentMode === "managed" &&
        (summary?.provisioningMode ?? "customer_vps") === "sutraha_managed" &&
        hasManagedHost
      ) {
        if (!isManagedProviderId(providerId)) {
          setProviderError(
            "Managed setup supports OpenAI, Anthropic, or Gemini only.",
          );
          return;
        }
        const result = await applyManagedProviderConfig({
          workspaceId,
          provider: providerId,
        });
        setProviderChecks(result.checks ?? null);
        setProviderMessage(
          result.ok
            ? `Provider key saved, applied, and runtime-validated (${providerId} / ${result.defaultModel}).`
            : `Provider saved but managed runtime validation failed: ${result.error ?? "Unknown error"}`,
        );
        if (!result.ok) {
          setProviderError(result.error ?? "Managed provider apply failed.");
        }
      } else {
        const validation = await validateWorkspaceKeys({ workspaceId });
        const validCount = validation.results.filter(
          (r) => r.status === "valid",
        ).length;
        if (
          requiresProviderKey &&
          deploymentMode === "managed" &&
          (summary?.provisioningMode ?? "customer_vps") === "sutraha_managed" &&
          !hasManagedHost
        ) {
          setProviderMessage(
            validCount > 0
              ? "Provider key saved and validated. Launch managed OpenClaw to apply this key to your managed host."
              : "Provider key saved but validation failed. Check key and retry.",
          );
        } else {
          setProviderMessage(
            validCount > 0
              ? `Provider key saved and validated (${validCount} valid).`
              : "Provider key saved but validation failed. Check key and retry.",
          );
        }
      }
      setProviderKeyDraft("");
    } catch (e) {
      setProviderError(e instanceof Error ? e.message : String(e));
    } finally {
      setProviderSaving(false);
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
    router.replace(`/chat/${mainAgentId}`);
  };

  const continueAfterOnboarding = (mainAgentId: string) => {
    const next = searchParams.get("next")?.trim();
    if (next && next.startsWith("/") && !next.startsWith("/onboarding")) {
      router.replace(next);
      return;
    }
    goChatSetup(mainAgentId);
  };

  useEffect(() => {
    if (!canAdmin) return;
    if (!status || !status.isComplete || !status.mainAgentId) return;
    continueAfterOnboarding(String(status.mainAgentId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAdmin, status?.isComplete, status?.mainAgentId, searchParams]);

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
            Complete prerequisites, then continue in chat.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-accent-orange" />
            <h2 className="text-sm font-semibold text-text-primary">
              Need OpenClaw setup?
            </h2>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            Choose this if you don&apos;t already have an OpenClaw stack.
            Sutraha provisions and connects it automatically.
          </p>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setNeedsManagedSetup(false);
                setDeploymentMode("manual");
              }}
              className={`rounded-lg border p-3 text-left ${
                !managedSetupUiEnabled
                  ? "border-accent-orange/50 bg-accent-orange/10"
                  : "border-border-default bg-bg-primary"
              }`}
            >
              <p className="text-xs font-semibold text-text-primary">
                I already have OpenClaw
              </p>
              <p className="mt-1 text-[11px] text-text-muted">
                Continue with connection settings below.
              </p>
            </button>
            {managedSelfServeVisible ? (
              <button
                type="button"
                onClick={() => {
                  if (!managedProvisioningEnabled) {
                    setNeedsManagedSetup(false);
                    setDeploymentMode("manual");
                    setServiceError(null);
                    setServiceMessage(
                      "Managed setup is private beta right now. Continue with BYO OpenClaw, or contact support for managed access.",
                    );
                    return;
                  }
                  setServiceMessage(null);
                  setServiceError(null);
                  setNeedsManagedSetup(true);
                  setDeploymentMode("managed");
                  if (!isManagedProviderId(providerId)) {
                    setProviderId("openai");
                  }
                }}
                className={`rounded-lg border p-3 text-left ${
                  managedSetupUiEnabled
                    ? "border-accent-orange/50 bg-accent-orange/10"
                    : "border-border-default bg-bg-primary"
                }`}
              >
                <p className="text-xs font-semibold text-text-primary">
                  {managedProvisioningEnabled
                    ? "Set up OpenClaw for me"
                    : "Join managed beta"}
                </p>
                <p className="mt-1 text-[11px] text-text-muted">
                  {managedProvisioningEnabled
                    ? "Managed cloud only. You choose region, we handle the rest."
                    : "Managed self-serve is invite-only while beta stabilizes."}
                </p>
              </button>
            ) : null}
          </div>
          {!managedSetupUiEnabled && (serviceMessage || serviceError) ? (
            <div className="mt-3 space-y-1">
              {serviceMessage ? (
                <p className="text-xs text-status-active">{serviceMessage}</p>
              ) : null}
              {serviceError ? (
                <p className="text-xs text-status-blocked">{serviceError}</p>
              ) : null}
            </div>
          ) : null}

          {managedSetupUiEnabled ? (
            <div className="mt-4 space-y-3 rounded-lg border border-border-default bg-bg-primary p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-text-secondary">
                    Deployment region
                  </Label>
                  <select
                    value={requestedRegion}
                    onChange={(e) =>
                      setRequestedRegion(e.target.value as ManagedRegionCode)
                    }
                    className="h-10 w-full rounded-md border border-border-default bg-bg-secondary px-3 text-sm text-text-primary"
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
                    className="h-10 w-full rounded-md border border-border-default bg-bg-secondary px-3 text-sm text-text-primary"
                  >
                    <option value="self_serve">Guided self-serve</option>
                    {assistedLaunchEnabled ? (
                      <option value="assisted">Assisted launch</option>
                    ) : null}
                  </select>
                  <p className="text-[11px] text-text-dim">
                    {serviceTier === "assisted"
                      ? "Assisted launch creates a support request and your team is contacted for hands-on help."
                      : "Guided self-serve gives you the same managed stack with in-app guidance, without a support request."}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
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
                            : "border-border-default bg-bg-secondary"
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

              <div className="space-y-2 rounded-md border border-border-default bg-bg-tertiary p-3">
                <Label className="text-text-secondary">
                  Model provider (required before launch)
                </Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-text-secondary">Provider</Label>
                    <select
                      value={providerId}
                      onChange={(e) =>
                        setProviderId(e.target.value as ManagedProviderId)
                      }
                      className="h-10 w-full rounded-md border border-border-default bg-bg-secondary px-3 text-sm text-text-primary"
                    >
                      {MANAGED_PROVIDER_OPTIONS.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-text-secondary">API key</Label>
                    <Input
                      type="password"
                      value={providerKeyDraft}
                      onChange={(e) => setProviderKeyDraft(e.target.value)}
                      placeholder="Paste provider key"
                      className="bg-bg-secondary border-border-default text-text-primary placeholder:text-text-dim"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="h-8 bg-accent-orange hover:bg-accent-orange/90 text-white"
                    onClick={() => void onSaveProviderKey()}
                    disabled={
                      providerSaving ||
                      providerAutoApplying ||
                      !providerKeyDraft.trim()
                    }
                  >
                    {providerSaving ? "Saving..." : "Save provider key"}
                  </Button>
                  <p className="text-[11px] text-text-dim">
                    Status:{" "}
                    {selectedProviderKeyStatus
                      ? selectedProviderKeyStatus.status
                      : "not saved"}
                  </p>
                </div>
              </div>

              {assistedLaunchEnabled && serviceTier === "assisted" ? (
                <>
                  <div className="space-y-2">
                    <Label className="text-text-secondary">Owner contact</Label>
                    <Input
                      value={ownerContact}
                      onChange={(e) => setOwnerContact(e.target.value)}
                      placeholder="name@company.com or +1 phone"
                      className="bg-bg-secondary border-border-default text-text-primary placeholder:text-text-dim"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-text-secondary">Support notes</Label>
                    <Input
                      value={supportNotes}
                      onChange={(e) => setSupportNotes(e.target.value)}
                      placeholder="Timeline, security/compliance constraints..."
                      className="bg-bg-secondary border-border-default text-text-primary placeholder:text-text-dim"
                    />
                  </div>
                </>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {assistedLaunchEnabled && serviceTier === "assisted" ? (
                  <Button
                    size="sm"
                    className="h-8 bg-accent-orange hover:bg-accent-orange/90 text-white"
                    onClick={() => void onRequestAssisted()}
                  >
                    <LifeBuoy className="mr-1 h-3.5 w-3.5" />
                    Request assisted launch
                  </Button>
                ) : (
                  <>
                    {managedSetupFailed ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => void onRestartManagedSetup()}
                      >
                        Restart setup
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => void onCreateProvisioningJob()}
                        disabled={!canLaunchManagedProvisioning}
                      >
                        Launch managed OpenClaw
                      </Button>
                    )}
                  </>
                )}
              </div>
              {assistedLaunchEnabled && serviceTier === "assisted" ? (
                <p className="text-[11px] text-text-dim">
                  Assisted launch creates a support request. The team will
                  follow up using owner contact.
                </p>
              ) : managedSetupFailed ? (
                <p className="text-[11px] text-text-dim">
                  Previous managed setup failed. Restart setup to recover.
                  {managedStatus?.requestedRegion &&
                  managedStatus.requestedRegion !== requestedRegion
                    ? " You changed region, so restart will run a fresh provisioning job in the selected region."
                    : ""}
                </p>
              ) : null}

              {serviceMessage ? (
                <p className="text-xs text-status-active">{serviceMessage}</p>
              ) : null}
              {serviceError ? (
                <p className="text-xs text-status-blocked">{serviceError}</p>
              ) : null}
              {assistedLaunchEnabled ? (
                <div className="rounded-md border border-border-default bg-bg-tertiary p-2 text-[11px] text-text-secondary">
                  <p className="text-text-dim">Latest assisted request</p>
                  <p className="mt-1 text-text-primary">
                    {assistedSessions?.[0]
                      ? `${assistedSessions[0].status} · ${new Date(
                          assistedSessions[0].createdAt,
                        ).toLocaleString()}`
                      : "No request yet"}
                  </p>
                </div>
              ) : null}
              <p className="text-[11px] text-text-dim">
                Setup progress:{" "}
                {managedStatus?.latestJob
                  ? `${managedStatus.latestJob.status} · ${managedStatus.latestJob.step}`
                  : "not started"}
              </p>
              {managedStatus?.latestJob?.failureCode ? (
                <p className="text-[11px] text-status-blocked">
                  Failure code: {managedStatus.latestJob.failureCode}
                </p>
              ) : null}
              {managedStatus?.resolvedRegion ? (
                <p className="text-[11px] text-text-dim">
                  Region:{" "}
                  {managedRegionLabel(
                    managedStatus.resolvedRegion,
                    regionOptions,
                  )}
                  {managedStatus.fallbackApplied
                    ? " (nearest available fallback)"
                    : ""}
                </p>
              ) : null}
              <p className="text-[11px] text-text-dim">
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
              <div className="rounded-md border border-border-default bg-bg-tertiary p-2 text-[11px] text-text-secondary">
                <p>1. Infra provisioning</p>
                <p>2. OpenClaw bootstrap</p>
                <p>3. Gateway route config</p>
                <p>4. Health verification</p>
                <p>5. Synclaw connected</p>
              </div>
              {managedStatus?.latestJob?.logs?.length ? (
                <div className="rounded-md border border-border-default bg-bg-tertiary p-2">
                  <p className="text-[11px] font-semibold text-text-primary">
                    Live setup activity
                  </p>
                  <div className="mt-1 space-y-1 text-[11px] text-text-secondary">
                    {managedStatus.latestJob.logs
                      .slice(-6)
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
        </div>

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <StepHeader
            step={1}
            title={
              managedSetupUiEnabled
                ? "Managed setup status"
                : "Connect OpenClaw"
            }
            subtitle={
              managedSetupUiEnabled
                ? "Track managed provisioning and verify managed connection."
                : "Test gateway and save configuration."
            }
            done={step1Done}
          />

          <div className="mt-5 space-y-4">
            {managedSetupUiEnabled ? (
              <div className="rounded-xl border border-border-default bg-bg-primary p-3">
                <p className="text-xs font-semibold text-text-primary">
                  Managed OpenClaw connection
                </p>
                <p className="mt-1 text-[11px] text-text-muted">
                  Synclaw connects automatically for managed workspaces. No
                  manual wsUrl/token setup is required.
                </p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
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
                    <p className="text-[10px] text-text-dim">Status</p>
                    <p className="text-xs text-text-primary">
                      {managedStatus?.managedStatus ?? "queued"}
                    </p>
                  </div>
                  <div className="rounded-md border border-border-default bg-bg-tertiary p-2">
                    <p className="text-[10px] text-text-dim">Connected</p>
                    <p className="text-xs text-text-primary">
                      {managedStatus?.managedConnectedAt
                        ? new Date(
                            managedStatus.managedConnectedAt,
                          ).toLocaleString()
                        : "Pending"}
                    </p>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-md border border-border-default bg-bg-tertiary p-2">
                    <p className="text-[10px] text-text-dim">Server profile</p>
                    <p className="text-xs text-text-primary">
                      {
                        managedServerProfileByCode(
                          managedStatus?.serverProfile ?? serverProfile,
                        ).label
                      }
                    </p>
                  </div>
                  <div className="rounded-md border border-border-default bg-bg-tertiary p-2">
                    <p className="text-[10px] text-text-dim">Server type</p>
                    <p className="text-xs text-text-primary">
                      {managedStatus?.serverType ||
                        managedServerProfileByCode(serverProfile).serverType}
                    </p>
                  </div>
                </div>
                {managedSetupFailed ? (
                  <p className="mt-2 text-[11px] text-status-blocked">
                    Managed setup failed. Restart provisioning to recover this
                    workspace.
                  </p>
                ) : null}
                <div className="mt-3">
                  {managedSetupFailed ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => void onRestartManagedSetup()}
                    >
                      Restart setup
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() =>
                        void verifyManagedConnection({ workspaceId })
                          .then((result) => {
                            setServiceMessage(
                              result?.nextAction ??
                                (result?.ok
                                  ? "Managed connection verified."
                                  : "Managed verification failed."),
                            );
                            if (!result?.ok) {
                              setServiceError(
                                result?.error ??
                                  "Managed host appears unavailable. Restart setup.",
                              );
                            } else {
                              setServiceError(null);
                            }
                          })
                          .catch((error) => {
                            setServiceError(
                              error instanceof Error
                                ? error.message
                                : String(error),
                            );
                          })
                      }
                    >
                      Reconnect / Verify
                    </Button>
                  )}
                </div>
              </div>
            ) : null}
            {managedSetupUiEnabled ? null : (
              <>
                <div>
                  <Label className="text-text-secondary">
                    Connection method
                  </Label>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {OPENCLAW_METHOD_CARDS.filter(
                      (m) => m.mode !== "connector",
                    ).map((method) => {
                      const selected = transportMode === method.mode;
                      const recommended = recommendedMode === method.mode;
                      return (
                        <button
                          key={method.mode}
                          type="button"
                          onClick={() => setTransportMode(method.mode)}
                          className={`rounded-xl border p-3 text-left ${
                            selected
                              ? "border-accent-orange/50 bg-accent-orange/10"
                              : "border-border-default bg-bg-primary"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-text-primary">
                              {method.title}
                            </p>
                            {method.badge ? (
                              <span className="rounded-full bg-accent-orange/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-orange">
                                {method.badge}
                              </span>
                            ) : recommended ? (
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
                          <p className="mt-1 text-[11px] text-text-secondary">
                            Need: {method.needs}
                          </p>
                          <p className="mt-1 text-[11px] text-text-dim">
                            Setup: {method.setupTime}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  <details className="mt-2 rounded-lg border border-border-default bg-bg-primary p-3">
                    <summary className="cursor-pointer text-xs font-semibold text-text-primary">
                      Advanced methods
                    </summary>
                    {OPENCLAW_METHOD_CARDS.filter(
                      (m) => m.mode === "connector",
                    ).map((method) => {
                      const selected = transportMode === method.mode;
                      return (
                        <button
                          key={method.mode}
                          type="button"
                          onClick={() => setTransportMode(method.mode)}
                          className={`mt-3 w-full rounded-xl border p-3 text-left ${
                            selected
                              ? "border-accent-orange/50 bg-accent-orange/10"
                              : "border-border-default bg-bg-secondary"
                          }`}
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
                            {method.subtitle}
                          </p>
                          <p className="mt-2 text-[11px] text-text-secondary">
                            Use only if you operate private networking +
                            connector runtime.
                          </p>
                        </button>
                      );
                    })}
                  </details>
                </div>

                {transportMode === "connector" ? (
                  <div className="space-y-3 rounded-xl border border-border-default bg-bg-primary p-3">
                    <div className="space-y-2">
                      <Label className="text-text-secondary">
                        Connector ID
                      </Label>
                      <Input
                        value={connectorId}
                        onChange={(e) => setConnectorId(e.target.value)}
                        placeholder="connector-workspace-prod-01"
                        className="bg-bg-secondary border-border-default text-text-primary placeholder:text-text-dim"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="rounded-lg border border-border-default bg-bg-tertiary p-2">
                        <p className="text-[11px] text-text-dim">
                          Connector status
                        </p>
                        <p className="text-xs text-text-primary capitalize">
                          {connectorStatus}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border-default bg-bg-tertiary p-2">
                        <p className="text-[11px] text-text-dim">Last seen</p>
                        <p className="text-xs text-text-primary">
                          {connectorLastSeenAt
                            ? new Date(connectorLastSeenAt).toLocaleString()
                            : "Not reported"}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-lg border border-border-default bg-bg-tertiary p-2">
                      <p className="text-[11px] text-text-dim">
                        Run connector on private host
                      </p>
                      <pre className="mt-1 overflow-auto whitespace-pre-wrap rounded bg-bg-primary p-2 font-mono text-[11px] text-text-primary">
                        {`SUTRAHA_CONNECTOR_ID=${connectorId || "<connector-id>"}
SUTRAHA_WORKSPACE_ID=${String(workspaceId)}
OPENCLAW_PRIVATE_WS_URL=ws://127.0.0.1:8788
./sutraha-connector start`}
                      </pre>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-text-secondary">
                        Connector auth token (optional)
                      </Label>
                      <Input
                        value={tokenDraft}
                        onChange={(e) => setTokenDraft(e.target.value)}
                        placeholder="Use token auth if your upstream requires it"
                        className="bg-bg-secondary border-border-default text-text-primary placeholder:text-text-dim font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-text-secondary">
                        Connector password (optional)
                      </Label>
                      <Input
                        value={passwordDraft}
                        onChange={(e) => setPasswordDraft(e.target.value)}
                        placeholder="Use password auth (common in tailnet/private setups)"
                        className="bg-bg-secondary border-border-default text-text-primary placeholder:text-text-dim font-mono text-xs"
                      />
                      <p className="text-[11px] text-text-dim">
                        You can configure either token or password for connector
                        upstream auth.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label className="text-text-secondary">
                        WebSocket URL
                      </Label>
                      <Input
                        value={wsUrl}
                        onChange={(e) => setWsUrl(e.target.value)}
                        placeholder={
                          transportMode === "self_hosted_local"
                            ? "ws://localhost:8788"
                            : "wss://your-openclaw.example.com"
                        }
                        className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
                      />
                      {showMixedContentWarning ? (
                        <p className="text-[11px] text-status-review">
                          HTTPS pages usually block ws://. Prefer connector or
                          public wss://.
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-text-secondary">
                        Auth token (optional)
                      </Label>
                      <Input
                        value={tokenDraft}
                        onChange={(e) => setTokenDraft(e.target.value)}
                        placeholder="Paste your OpenClaw token..."
                        className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim font-mono text-xs"
                      />
                      <p className="text-[11px] text-text-dim">
                        Saved token: {summary?.hasAuthToken ? "set" : "not set"}
                        .
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-text-secondary">
                        Auth password (optional)
                      </Label>
                      <Input
                        value={passwordDraft}
                        onChange={(e) => setPasswordDraft(e.target.value)}
                        placeholder="Paste your OpenClaw password..."
                        className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim font-mono text-xs"
                      />
                      <p className="text-[11px] text-text-dim">
                        Use either token or password, based on your OpenClaw
                        gateway auth mode.
                      </p>
                      <p className="text-[11px] text-text-dim">
                        Saved password:{" "}
                        {summary?.hasPassword ? "set" : "not set"}.
                      </p>
                    </div>

                    {transportMode === "direct_ws" ? (
                      <div className="rounded-xl border border-border-default bg-bg-tertiary p-3">
                        <p className="text-xs font-semibold text-text-primary">
                          Public WSS Security Checklist
                        </p>
                        <p className="mt-1 text-[11px] text-text-muted">
                          Required baseline before production use. Current
                          Synclaw origin:
                          <span className="ml-1 font-mono">
                            {origin || "(browser origin unavailable)"}
                          </span>
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => void onRequestDeviceApproval()}
                            disabled={deviceApprovalTesting}
                          >
                            {deviceApprovalTesting
                              ? "Connecting..."
                              : "Connect to request device approval"}
                          </Button>
                          <p className="text-[11px] text-text-dim">
                            Run this once before checking device approval.
                          </p>
                        </div>
                        {deviceApprovalProbeResult.status !== "idle" ? (
                          <p
                            className={`mt-2 text-[11px] ${
                              deviceApprovalProbeResult.status === "ok"
                                ? "text-status-active"
                                : "text-status-blocked"
                            }`}
                          >
                            {deviceApprovalProbeResult.message}
                          </p>
                        ) : null}
                        <div className="mt-2 space-y-2">
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
                                disabled={
                                  item.id === "deviceApproval" &&
                                  !deviceApprovalProbeDone
                                }
                                className="mt-0.5 h-4 w-4 accent-accent-orange disabled:opacity-50"
                              />
                              {item.label}
                            </label>
                          ))}
                        </div>
                        <div className="mt-3 space-y-2">
                          <Label className="text-text-secondary">
                            Hardening notes (optional)
                          </Label>
                          <Textarea
                            value={securityHardeningNotes}
                            onChange={(e) =>
                              setSecurityHardeningNotes(e.target.value)
                            }
                            placeholder="Example: dashboard behind SSO + IP allowlist."
                            rows={2}
                            className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
                          />
                        </div>
                        {securityStatus?.securityConfirmedAt ? (
                          <p className="mt-2 text-[11px] text-status-active">
                            Previously confirmed at{" "}
                            {new Date(
                              securityStatus.securityConfirmedAt,
                            ).toLocaleString()}
                            .
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}
              </>
            )}

            {managedSetupUiEnabled ? null : (
              <>
                <div className="hidden">
                  <Input value="req" readOnly />
                  <Input
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                  />
                  <Input
                    value={clientMode}
                    onChange={(e) => setClientMode(e.target.value)}
                  />
                  <Input
                    value={clientPlatform}
                    onChange={(e) => setClientPlatform(e.target.value)}
                  />
                  <Input
                    value={subscribeMethod}
                    onChange={(e) => setSubscribeMethod(e.target.value)}
                  />
                  <Input
                    value={historyPollMs}
                    onChange={(e) => setHistoryPollMs(e.target.value)}
                  />
                  <Input
                    value={passwordDraft}
                    onChange={(e) => setPasswordDraft(e.target.value)}
                  />
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

                {pairingHintVisible && transportMode !== "connector" ? (
                  <div className="rounded-xl border border-accent-orange/30 bg-accent-orange/5 p-3">
                    <p className="text-xs font-semibold text-accent-orange">
                      Pairing approval needed
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      This browser device is not paired yet. Approve it in
                      OpenClaw, then rotate scopes.
                    </p>
                    <div className="mt-2 space-y-1.5 font-mono text-[11px] text-text-secondary">
                      <p>openclaw devices list</p>
                      <p>openclaw devices approve &lt;requestId&gt;</p>
                      <p>
                        openclaw devices rotate --device &lt;deviceId&gt;
                        --scope operator.read --scope operator.write --scope
                        operator.admin
                      </p>
                    </div>
                    <p className="mt-2 text-[11px] text-text-dim">
                      After approval and scope rotation, click{" "}
                      <span className="font-semibold">Test &amp; Save</span>{" "}
                      again.
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

        {requiresProviderKey ? (
          <div
            className={`rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6 ${
              !step1Done ? "opacity-60" : ""
            }`}
          >
            <StepHeader
              step={2}
              title="Provider setup"
              subtitle="Add and validate at least one model provider API key."
              done={step2Done}
            />

            <div className="mt-5 space-y-4">
              {!step1Done ? (
                <p className="text-xs text-text-muted">
                  Complete Step 1 first.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-text-secondary">Provider</Label>
                      <select
                        value={providerId}
                        onChange={(e) =>
                          setProviderId(e.target.value as ModelProviderId)
                        }
                        className="h-10 w-full rounded-md border border-border-default bg-bg-primary px-3 text-sm text-text-primary"
                      >
                        {providerOptions.map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {provider.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-text-secondary">API key</Label>
                      <Input
                        type="password"
                        value={providerKeyDraft}
                        onChange={(e) => setProviderKeyDraft(e.target.value)}
                        placeholder="Paste provider key"
                        className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      className="bg-accent-orange hover:bg-accent-orange/90 text-white"
                      onClick={() => void onSaveProviderKey()}
                      disabled={
                        providerSaving ||
                        providerAutoApplying ||
                        !providerKeyDraft.trim()
                      }
                    >
                      {providerSaving
                        ? "Saving..."
                        : requiresProviderKey &&
                            deploymentMode === "managed" &&
                            (summary?.provisioningMode ?? "customer_vps") ===
                              "sutraha_managed"
                          ? "Save, Apply & Validate"
                          : "Save & Validate"}
                    </Button>
                    <p className="text-xs text-text-dim">
                      Valid keys: {status?.providerKeyValidCount ?? 0}
                    </p>
                  </div>

                  {providerMessage ? (
                    <p className="text-xs text-status-active">
                      {providerMessage}
                    </p>
                  ) : null}
                  {providerError ? (
                    <p className="text-xs text-status-blocked">
                      {providerError}
                    </p>
                  ) : null}

                  <div className="rounded-md border border-border-default bg-bg-tertiary p-2 text-[11px] text-text-secondary">
                    {providerChecks ? (
                      <div className="mb-2 space-y-1">
                        <p>
                          keyStored: {providerChecks.keyStored ? "ok" : "fail"}
                        </p>
                        <p>
                          appliedToManagedHost:{" "}
                          {providerChecks.appliedToManagedHost ? "ok" : "fail"}
                        </p>
                        <p>
                          serviceRestarted:{" "}
                          {providerChecks.serviceRestarted ? "ok" : "fail"}
                        </p>
                        <p>
                          portListening:{" "}
                          {providerChecks.portListening ? "ok" : "fail"}
                        </p>
                        <p>
                          modelRuntimeReady:{" "}
                          {providerChecks.modelRuntimeReady ? "ok" : "fail"}
                        </p>
                      </div>
                    ) : null}
                    {providerKeyStatuses.length > 0 ? (
                      providerKeyStatuses.slice(0, 3).map((row) => (
                        <p key={row.provider}>
                          {row.provider}: {row.status}
                        </p>
                      ))
                    ) : (
                      <p>No provider keys configured yet.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}

        <div
          className={`rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6 ${
            !step1Done || !step2Done ? "opacity-60" : ""
          }`}
        >
          <StepHeader
            step={requiresProviderKey ? 3 : 2}
            title="Create main agent"
            subtitle='Canonical sessionKey: "agent:main:main".'
            done={step3Done}
          />

          <div className="mt-5 space-y-4">
            {!step1Done || !step2Done ? (
              <p className="text-xs text-text-muted">
                {requiresProviderKey
                  ? "Complete Step 1 and Step 2 first."
                  : "Complete Step 1 first."}
              </p>
            ) : status?.mainAgentId ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-text-muted">
                  Main agent exists. Continue in chat.
                </p>
                <Button
                  className="bg-teal hover:bg-teal/90 text-white"
                  onClick={() => goChatSetup(String(status.mainAgentId))}
                >
                  Open Agent Chat
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
                        const result = (await createAgentOneClick({
                          workspaceId,
                          name: mainName.trim(),
                          role: mainRole.trim() || "Squad Lead",
                          emoji: mainEmoji.trim() || "🦊",
                          sessionKey: "agent:main:main",
                          externalAgentId: "agent:main:main",
                          source: "onboarding_main",
                        })) as
                          | { ok: true; agentId: string }
                          | { ok: false; code?: string; message: string };
                        if (!result.ok) {
                          setCreateError(
                            mapOneClickSetupError(result.code, result.message),
                          );
                          return;
                        }
                        goChatSetup(String(result.agentId));
                      } catch (e) {
                        setCreateError(
                          e instanceof Error ? e.message : String(e),
                        );
                      } finally {
                        setCreatingAgent(false);
                      }
                    })();
                  }}
                >
                  {creatingAgent
                    ? "Creating & configuring..."
                    : "Create & Configure Agent"}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          {AGENT_SETUP_ADVANCED_ENABLED ? (
            <>
              <p className="text-xs text-text-muted">
                Need diagnostics? Open setup details for validation and
                troubleshooting.
              </p>
              <div className="mt-3">
                <Button asChild variant="outline" size="sm" className="h-8">
                  <Link
                    href={
                      status?.mainAgentId
                        ? `/agents/${status.mainAgentId}/setup`
                        : "/agents"
                    }
                  >
                    Open setup diagnostics
                  </Link>
                </Button>
              </div>
            </>
          ) : (
            <p className="text-xs text-text-muted">
              Setup is handled automatically. Continue in chat once agent
              creation completes.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
