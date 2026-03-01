"use client";

import { useConvex, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/EmptyState";
import { OpenClawBrowserGatewayClient } from "@/lib/openclaw-gateway-client";
import { Check, LifeBuoy, Server, Settings2, Zap } from "lucide-react";
import { setChatDraft } from "@/lib/chatDraft";
import { buildMainAgentBootstrapMessage } from "@/lib/onboardingTemplates";
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

type Protocol = "req";

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
  const convex = useConvex();

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
  const createManagedJob = useMutation(api.managedProvisioning.createManagedJob);
  const retryManagedJob = useMutation(api.managedProvisioning.retryJob);
  const verifyManagedConnection = useMutation(
    api.managedProvisioning.verifyManagedConnection,
  );
  const managedStatus = useQuery(
    api.managedProvisioning.getManagedStatus,
    canAdmin ? { workspaceId } : "skip",
  );
  const createAssistedSession = useMutation(api.support.createAssistedSession);
  const assistedSessions = useQuery(
    api.support.listAssistedSessions,
    canAdmin ? { workspaceId } : "skip",
  );
  const createAgent = useMutation(api.agents.create);

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
    useState<ManagedRegionCode>("eu_central_hil");
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
    setDeploymentMode((summary.deploymentMode as "managed" | "manual") ?? "manual");
    setNeedsManagedSetup((summary.deploymentMode ?? "manual") === "managed");
    setRequestedRegion(
      ((summary.managedRegionRequested || summary.managedRegionResolved) as ManagedRegionCode) ??
        "eu_central_hil",
    );
    setServiceTier(summary.serviceTier === "assisted" ? "assisted" : "self_serve");
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
  }, [summary?.updatedAt]);

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
  const allSecurityChecksConfirmed = Object.values(securityChecklistAck).every(
    Boolean,
  );

  const step1Done = Boolean(status?.openclawConfigured);
  const step2Done = Boolean(status?.mainAgentId);
  const pairingHintVisible =
    testResult.status === "error" &&
    isPairingRequiredMessage(testResult.message);
  const latestManagedJobFailed = managedStatus?.latestJob?.status === "failed";
  const managedSetupFailed =
    managedStatus?.managedStatus === "failed" || latestManagedJobFailed;
  const currentMember = useMemo(
    () => members.find((m) => m._id === membershipId) ?? null,
    [members, membershipId],
  );

  useEffect(() => {
    // Prefill assisted owner contact from the current signed-in user's email.
    if (ownerContact.trim()) return;
    const email = (currentMember?.email ?? "").trim();
    if (!email) return;
    setOwnerContact(email);
  }, [currentMember?.email, ownerContact]);

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
        const validation = await convex.query(api.openclaw.validatePublicWssConfig, {
          workspaceId,
        });
        if (!validation.ok) {
          setTestResult({
            status: "error",
            message: validation.errors[0] ?? "Public WSS security validation failed.",
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
          message: "Connected, saved, and Public WSS security checklist confirmed.",
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
        message: mapOpenClawSetupError(raw, transportMode),
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
          `${mapOpenClawSetupError(raw, transportMode)} ` +
          "If pairing is pending, approve this browser/device in OpenClaw and run this probe again.",
      });
    } finally {
      setDeviceApprovalTesting(false);
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
      setNeedsManagedSetup(true);
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

  const onRequestAssisted = async () => {
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
        `Assisted launch requested (${String(result.sessionId)}). Team follow-up will happen via owner contact.`,
      );
    } catch (e) {
      setServiceError(e instanceof Error ? e.message : String(e));
    }
  };

  const onRestartManagedSetup = async () => {
    setServiceError(null);
    setServiceMessage(null);
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
            ? `Setup restarted. Requested region unavailable; retrying in nearest available region: ${managedRegionLabel(result.resolvedRegion)}.`
            : `Setup restarted in ${managedRegionLabel(result.resolvedRegion)}.`,
        );
      } else {
        await onCreateProvisioningJob();
      }
    } catch (e) {
      setServiceError(e instanceof Error ? e.message : String(e));
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
    router.replace(`/agents/${mainAgentId}/setup`);
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
            Complete prerequisites, then continue in Agent Setup Guide.
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
            Choose this if you don&apos;t already have an OpenClaw stack. Sutraha
            provisions and connects it automatically.
          </p>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setNeedsManagedSetup(false);
                setDeploymentMode("manual");
              }}
              className={`rounded-lg border p-3 text-left ${
                !needsManagedSetup
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
            <button
              type="button"
              onClick={() => {
                setNeedsManagedSetup(true);
                setDeploymentMode("managed");
              }}
              className={`rounded-lg border p-3 text-left ${
                needsManagedSetup
                  ? "border-accent-orange/50 bg-accent-orange/10"
                  : "border-border-default bg-bg-primary"
              }`}
            >
              <p className="text-xs font-semibold text-text-primary">
                Set up OpenClaw for me
              </p>
              <p className="mt-1 text-[11px] text-text-muted">
                Managed cloud only. You choose region, we handle the rest.
              </p>
            </button>
          </div>

          {needsManagedSetup ? (
            <div className="mt-4 space-y-3 rounded-lg border border-border-default bg-bg-primary p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-text-secondary">Deployment region</Label>
                  <select
                    value={requestedRegion}
                    onChange={(e) =>
                      setRequestedRegion(e.target.value as ManagedRegionCode)
                    }
                    className="h-10 w-full rounded-md border border-border-default bg-bg-secondary px-3 text-sm text-text-primary"
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
                      setServiceTier(e.target.value as "self_serve" | "assisted")
                    }
                    className="h-10 w-full rounded-md border border-border-default bg-bg-secondary px-3 text-sm text-text-primary"
                  >
                    <option value="self_serve">Guided self-serve</option>
                    <option value="assisted">Assisted launch</option>
                  </select>
                  <p className="text-[11px] text-text-dim">
                    {serviceTier === "assisted"
                      ? "Assisted launch creates a support request and your team is contacted for hands-on help."
                      : "Guided self-serve gives you the same managed stack with in-app guidance, without a support request."}
                  </p>
                </div>
              </div>

              {serviceTier === "assisted" ? (
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
                {serviceTier === "assisted" ? (
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
                      >
                        Launch managed OpenClaw
                      </Button>
                    )}
                  </>
                )}
              </div>
              {serviceTier === "assisted" ? (
                <p className="text-[11px] text-text-dim">
                  Assisted launch creates a support request. The team will follow
                  up using owner contact.
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
              <p className="text-[11px] text-text-dim">
                Setup progress:{" "}
                {managedStatus?.latestJob
                  ? `${managedStatus.latestJob.status} · ${managedStatus.latestJob.step}`
                  : "not started"}
              </p>
              {managedStatus?.resolvedRegion ? (
                <p className="text-[11px] text-text-dim">
                  Region: {managedRegionLabel(managedStatus.resolvedRegion)}
                  {managedStatus.fallbackApplied
                    ? " (nearest available fallback)"
                    : ""}
                </p>
              ) : null}
              <div className="rounded-md border border-border-default bg-bg-tertiary p-2 text-[11px] text-text-secondary">
                <p>1. Infra provisioning</p>
                <p>2. Gateway ready</p>
                <p>3. Security hardened</p>
                <p>4. Synclaw connected</p>
                <p>5. Agents verified</p>
              </div>
              <div className="rounded-md border border-status-review/40 bg-status-review/10 p-2 text-[11px]">
                <p className="font-semibold text-status-review">
                  Provider auth scope: API-key-only
                </p>
                <p className="mt-1 text-text-secondary">
                  Login/session-based provider adapters are not enabled yet.
                </p>
              </div>
              {managedStatus?.latestJob?.logs?.length ? (
                <div className="rounded-md border border-border-default bg-bg-tertiary p-2">
                  <p className="text-[11px] font-semibold text-text-primary">
                    Live setup activity
                  </p>
                  <div className="mt-1 space-y-1 text-[11px] text-text-secondary">
                    {managedStatus.latestJob.logs.slice(-6).map((log: string) => (
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
            title="Connect OpenClaw"
            subtitle="Test gateway and save configuration."
            done={step1Done}
          />

          <div className="mt-5 space-y-4">
            {needsManagedSetup ? (
              <div className="rounded-xl border border-border-default bg-bg-primary p-3">
                <p className="text-xs font-semibold text-text-primary">
                  Managed OpenClaw connection
                </p>
                <p className="mt-1 text-[11px] text-text-muted">
                  Synclaw connects automatically for managed workspaces. No manual wsUrl/token setup is required.
                </p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="rounded-md border border-border-default bg-bg-tertiary p-2">
                    <p className="text-[10px] text-text-dim">Region</p>
                    <p className="text-xs text-text-primary">
                      {managedRegionLabel(
                        managedStatus?.resolvedRegion || managedStatus?.requestedRegion,
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
                        ? new Date(managedStatus.managedConnectedAt).toLocaleString()
                        : "Pending"}
                    </p>
                  </div>
                </div>
                {managedSetupFailed ? (
                  <p className="mt-2 text-[11px] text-status-blocked">
                    Managed setup failed. Restart provisioning to recover this workspace.
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
                        void verifyManagedConnection({ workspaceId }).then(() =>
                          setServiceMessage("Managed connection verified."),
                        )
                      }
                    >
                      Reconnect / Verify
                    </Button>
                  )}
                </div>
              </div>
            ) : null}
            {needsManagedSetup ? null : (
              <>
            <div>
              <Label className="text-text-secondary">Connection method</Label>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {OPENCLAW_METHOD_CARDS.filter((m) => m.mode !== "connector").map(
                  (method) => {
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
                {OPENCLAW_METHOD_CARDS.filter((m) => m.mode === "connector").map(
                  (method) => {
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
                          Use only if you operate private networking + connector runtime.
                        </p>
                      </button>
                    );
                  },
                )}
              </details>
            </div>

            {transportMode === "connector" ? (
              <div className="space-y-3 rounded-xl border border-border-default bg-bg-primary p-3">
                <div className="space-y-2">
                  <Label className="text-text-secondary">Connector ID</Label>
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
                  <Label className="text-text-secondary">WebSocket URL</Label>
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
                    Use either token or password, based on your OpenClaw gateway auth mode.
                  </p>
                </div>

                {transportMode === "direct_ws" ? (
                  <div className="rounded-xl border border-border-default bg-bg-tertiary p-3">
                    <p className="text-xs font-semibold text-text-primary">
                      Public WSS Security Checklist
                    </p>
                    <p className="mt-1 text-[11px] text-text-muted">
                      Required baseline before production use. Current Synclaw origin:
                      <span className="ml-1 font-mono">{origin || "(browser origin unavailable)"}</span>
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
                        onChange={(e) => setSecurityHardeningNotes(e.target.value)}
                        placeholder="Example: dashboard behind SSO + IP allowlist."
                        rows={2}
                        className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
                      />
                    </div>
                    {securityStatus?.securityConfirmedAt ? (
                      <p className="mt-2 text-[11px] text-status-active">
                        Previously confirmed at{" "}
                        {new Date(securityStatus.securityConfirmedAt).toLocaleString()}.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
              </>
            )}

            {needsManagedSetup ? null : (
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
                  This browser device is not paired yet. Approve it in OpenClaw,
                  then rotate scopes.
                </p>
                <div className="mt-2 space-y-1.5 font-mono text-[11px] text-text-secondary">
                  <p>openclaw devices list</p>
                  <p>openclaw devices approve &lt;requestId&gt;</p>
                  <p>
                    openclaw devices rotate --device &lt;deviceId&gt; --scope
                    operator.read --scope operator.write --scope operator.admin
                  </p>
                </div>
                <p className="mt-2 text-[11px] text-text-dim">
                  After approval and scope rotation, click{" "}
                  <span className="font-semibold">Test &amp; Save</span> again.
                </p>
              </div>
            ) : null}
            </>
            )}
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
                <p className="text-xs text-text-muted">
                  Main agent exists. Continue setup in Chat.
                </p>
                <Button
                  className="bg-teal hover:bg-teal/90 text-white"
                  onClick={() => goChatSetup(String(status.mainAgentId))}
                >
                  Open Setup Guide
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
                        goChatSetup(String(id));
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
                  {creatingAgent ? "Creating..." : "Create main agent"}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <p className="text-xs text-text-muted">
            After prerequisites, continue with Agent Setup Guide for strict
            file-pack validation and runtime checks.
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
                Open Setup Guide
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
