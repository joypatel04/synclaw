"use client";

import { useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  extractDisplayMessagesFromHistory,
  extractExecTracesFromHistory,
  mapGatewayEventForIngest,
  OpenClawBrowserGatewayClient,
  type OpenClawConnectionStatus,
} from "@/lib/openclaw-gateway-client";
import type { UpsertPartial } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const parseRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseChatGatewayParams {
  sessionKey: string;
  workspaceId: Id<"workspaces">;
  canEdit: boolean;
  upsertLocal: (partial: UpsertPartial) => void;
  hasSimilarUserMessage: (content: string, ts: number) => boolean;
  makeClientMessageId: () => string;
  resetPendingSlot: () => void;
  includeCronOverride?: boolean;
}

export function useChatGateway({
  sessionKey,
  workspaceId,
  canEdit,
  upsertLocal,
  hasSimilarUserMessage,
  makeClientMessageId,
  resetPendingSlot,
}: UseChatGatewayParams) {
  const gatewayRef = useRef<OpenClawBrowserGatewayClient | null>(null);
  const connectRef = useRef<Promise<void> | null>(null);

  const [connectionBlock, setConnectionBlock] =
    useState<OpenClawConnectionStatus | null>(null);
  const [gatewayDefaultModel, setGatewayDefaultModel] = useState<string | null>(
    null,
  );
  const [gatewayModelProvider, setGatewayModelProvider] = useState<
    string | null
  >(null);
  const [gatewayChannels, setGatewayChannels] = useState<string[]>([]);
  const [gatewayAgentCount, setGatewayAgentCount] = useState<number | null>(
    null,
  );
  const [showGatewayPanel, setShowGatewayPanel] = useState(false);

  // Config from Convex.
  const openclawConfig = useQuery(
    api.openclaw.getClientConfig,
    canEdit ? { workspaceId } : "skip",
  );

  const isConnectorMode =
    (openclawConfig?.transportMode ?? "direct_ws") === "connector";
  const useDirectWs = !isConnectorMode;
  const includeCron = openclawConfig?.includeCron ?? false;
  const historyPollMs = openclawConfig?.historyPollMs ?? 0;

  const canChatBase = Boolean(
    canEdit &&
      openclawConfig &&
      (isConnectorMode
        ? Boolean(openclawConfig.connectorStatus === "online")
        : Boolean(openclawConfig.wsUrl)),
  );

  const gatewayBlocked = Boolean(
    connectionBlock &&
      connectionBlock.state !== "CONNECTED" &&
      (connectionBlock.state === "PAIRING_REQUIRED" ||
        connectionBlock.state === "PAIRING_PENDING" ||
        connectionBlock.state === "SCOPES_INSUFFICIENT" ||
        connectionBlock.state === "INVALID_CONFIG"),
  );

  const canChat = canChatBase && !gatewayBlocked && !isConnectorMode;

  const gatewayConfigKey = useMemo(
    () => (openclawConfig ? JSON.stringify(openclawConfig) : ""),
    [openclawConfig],
  );

  // Cleanup on session key change.
  useEffect(
    () => () => {
      void gatewayRef.current?.disconnect();
      gatewayRef.current = null;
      connectRef.current = null;
      resetPendingSlot();
    },
    [sessionKey, resetPendingSlot],
  );

  // Reset gateway when config changes.
  useEffect(() => {
    void gatewayRef.current?.disconnect();
    gatewayRef.current = null;
    connectRef.current = null;
    resetPendingSlot();
    setGatewayDefaultModel(null);
    setGatewayModelProvider(null);
    setGatewayChannels([]);
    setGatewayAgentCount(null);
    setConnectionBlock(null);
  }, [gatewayConfigKey, resetPendingSlot]);

  // ------------------------------------------------------------------
  // Ensure connection + attach event handler
  // ------------------------------------------------------------------
  const ensureConnected = useCallback(async () => {
    if (!openclawConfig) {
      throw new Error(
        "OpenClaw is not configured for this workspace. Go to Settings → OpenClaw.",
      );
    }
    if ((openclawConfig.transportMode ?? "direct_ws") === "connector") {
      throw new Error(
        "Connector mode chat relay is not available in this client yet.",
      );
    }
    if (!openclawConfig.wsUrl) {
      throw new Error("OpenClaw wsUrl is missing.");
    }

    if (!gatewayRef.current) {
      gatewayRef.current = new OpenClawBrowserGatewayClient(
        {
          wsUrl: openclawConfig.wsUrl,
          protocol: openclawConfig.protocol,
          authToken: openclawConfig.authToken,
          password: openclawConfig.password,
          forceDisableDeviceAuth:
            (openclawConfig.deploymentMode ?? "manual") === "managed",
          clientId: openclawConfig.clientId,
          clientMode: openclawConfig.clientMode,
          clientPlatform: openclawConfig.clientPlatform,
          role: openclawConfig.role,
          scopes: openclawConfig.scopes,
          subscribeOnConnect: openclawConfig.subscribeOnConnect,
          subscribeMethod: openclawConfig.subscribeMethod,
        },
        async (event) => {
          // --- Health events ---
          const ev = event as Record<string, unknown>;
          if (ev?.type === "event" && ev?.event === "health") {
            const payload = parseRecord(ev?.payload);
            if (payload) {
              const channelOrder = Array.isArray(payload.channelOrder)
                ? payload.channelOrder.filter(
                    (v): v is string => typeof v === "string",
                  )
                : [];
              const labelsRec = parseRecord(payload.channelLabels);
              if (channelOrder.length > 0 && labelsRec) {
                const labels = channelOrder.map((id) => {
                  const label = labelsRec[id];
                  return typeof label === "string" ? label : id;
                });
                setGatewayChannels(labels);
              }
              if (Array.isArray(payload.agents)) {
                setGatewayAgentCount(payload.agents.length);
              }

              const defaults = parseRecord(payload.defaults);
              const sessions = parseRecord(payload.sessions);
              const sessionDefaults = sessions
                ? parseRecord(sessions.defaults)
                : null;
              const modelFromHealth =
                (defaults &&
                  typeof defaults.model === "string" &&
                  defaults.model) ||
                (sessionDefaults &&
                  typeof sessionDefaults.model === "string" &&
                  sessionDefaults.model) ||
                null;
              const providerFromHealth =
                (defaults &&
                  typeof defaults.modelProvider === "string" &&
                  defaults.modelProvider) ||
                (sessionDefaults &&
                  typeof sessionDefaults.modelProvider === "string" &&
                  sessionDefaults.modelProvider) ||
                null;
              if (modelFromHealth) setGatewayDefaultModel(modelFromHealth);
              if (providerFromHealth)
                setGatewayModelProvider(providerFromHealth);
            }
          }

          // --- Chat / streaming events ---
          const mapped = mapGatewayEventForIngest(event, makeClientMessageId());
          if (!mapped?.message) return;

          const isPrimary = mapped.sessionKey === sessionKey;
          const isCron =
            includeCron && mapped.sessionKey.startsWith(`${sessionKey}:cron:`);
          if (!isPrimary && !isCron) return;

          const resolvedSession = isCron ? sessionKey : mapped.sessionKey;
          if (resolvedSession !== sessionKey) return;

          const msg = mapped.message;
          if (!msg.externalMessageId) return;
          if (msg.fromUser) return;
          if (msg.role === "tool") return;

          const externalMessageId =
            msg.role === "assistant" && msg.externalRunId
              ? `${msg.externalRunId}:assistant`
              : msg.externalMessageId;

          upsertLocal({
            id: externalMessageId,
            externalMessageId,
            externalRunId: msg.externalRunId,
            fromUser: msg.fromUser,
            role: msg.role,
            content: msg.content ?? "",
            append: msg.append,
            state: msg.state,
            createdAt: mapped.eventAt ?? Date.now(),
            errorMessage: msg.errorMessage,
          });
        },
      );
    }

    if (!connectRef.current) {
      connectRef.current = gatewayRef.current.connect().catch((error) => {
        const status = gatewayRef.current?.getConnectionStatus() ?? null;
        if (status) setConnectionBlock(status);
        gatewayRef.current = null;
        throw error;
      });
    }
    await connectRef.current;

    const status = gatewayRef.current?.getConnectionStatus() ?? null;
    if (status?.state === "CONNECTED") {
      setConnectionBlock(null);
    } else if (status) {
      setConnectionBlock(status);
    }
  }, [
    openclawConfig,
    sessionKey,
    includeCron,
    upsertLocal,
    makeClientMessageId,
  ]);

  // ------------------------------------------------------------------
  // Background history sync
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!useDirectWs) return;
    if (!canChat) return;

    const hydrateHistory = async () => {
      try {
        await ensureConnected();
        const history = await gatewayRef.current?.getChatHistory({
          sessionKey,
          limit: 50,
        });

        // Tool traces.
        const traces = extractExecTracesFromHistory(history);
        for (const t of traces) {
          const toolCallId = t.toolCallId;
          if (!toolCallId) continue;
          upsertLocal({
            id: toolCallId,
            externalMessageId: toolCallId,
            fromUser: false,
            role: "tool",
            content: t.command ?? `${t.toolName} (missing command)`,
            state:
              t.status === "error" || t.resultText?.includes("Server Error")
                ? "failed"
                : "completed",
            errorMessage: t.resultText,
            createdAt: t.timestamp ?? t.resultTimestamp ?? Date.now(),
          });
        }

        // Display messages.
        const display = extractDisplayMessagesFromHistory(history);
        for (const m of display) {
          if (!m.externalMessageId) continue;
          if (
            m.role === "user" &&
            hasSimilarUserMessage(m.content, m.eventAt ?? Date.now())
          ) {
            continue;
          }
          upsertLocal({
            id: m.externalMessageId,
            externalMessageId: m.externalMessageId,
            fromUser: m.fromUser,
            role: m.role,
            content: m.content,
            state: "completed",
            createdAt: m.eventAt ?? Date.now(),
          });
        }
      } catch {
        // Ignore; next tick will retry.
      }
    };

    if (!historyPollMs || Number.isNaN(historyPollMs) || historyPollMs < 1000) {
      void hydrateHistory();
      return;
    }

    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await hydrateHistory();
    };
    const interval = setInterval(() => void tick(), historyPollMs);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    useDirectWs,
    canChat,
    historyPollMs,
    sessionKey,
    gatewayConfigKey,
    ensureConnected,
    upsertLocal,
    hasSimilarUserMessage,
  ]);

  // ------------------------------------------------------------------
  // Gateway feature badges
  // ------------------------------------------------------------------
  const gatewayFeatures = useMemo(() => {
    const features = ["Live stream", "History hydration", "Abort run"];
    if (includeCron) features.push("Cron mirroring");
    if (historyPollMs >= 1000) {
      features.push(`Recovery ${historyPollMs}ms`);
    }
    if (gatewayAgentCount && gatewayAgentCount > 0) {
      features.push(`${gatewayAgentCount} agents`);
    }
    if (gatewayChannels.length > 0) {
      features.push(`Channels: ${gatewayChannels.join(", ")}`);
    }
    if (gatewayDefaultModel) {
      const suffix = gatewayModelProvider ? ` (${gatewayModelProvider})` : "";
      features.push(`Model: ${gatewayDefaultModel}${suffix}`);
    }
    return features;
  }, [
    includeCron,
    historyPollMs,
    gatewayAgentCount,
    gatewayChannels,
    gatewayDefaultModel,
    gatewayModelProvider,
  ]);

  return {
    gateway: gatewayRef,
    ensureConnected,
    connectionBlock,
    canChat,
    canChatBase,
    isConnectorMode,
    openclawConfig,
    gatewayFeatures,
    gatewayBlocked,
    showGatewayPanel,
    setShowGatewayPanel,
  };
}
