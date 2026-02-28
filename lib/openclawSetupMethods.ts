export type OpenClawTransportMode =
  | "direct_ws"
  | "connector"
  | "self_hosted_local";

export type OpenClawMethodCard = {
  mode: OpenClawTransportMode;
  title: string;
  subtitle: string;
  useWhen: string;
  needs: string;
  setupTime: string;
  badge?: string;
};

export const OPENCLAW_METHOD_CARDS: OpenClawMethodCard[] = [
  {
    mode: "direct_ws",
    title: "Public WSS",
    subtitle: "Recommended and security-hardened baseline",
    useWhen: "Your OpenClaw gateway is publicly reachable over wss://",
    needs: "Public wss:// URL + token/password + allowedOrigins + device approval",
    setupTime: "~3 min",
    badge: "Recommended",
  },
  {
    mode: "connector",
    title: "Private Connector",
    subtitle: "Advanced (Private Network)",
    useWhen: "OpenClaw stays private and only a local connector can reach it",
    needs: "Connector ID + private upstream ws:// URL on connector host",
    setupTime: "~6 min",
    badge: "Advanced",
  },
  {
    mode: "self_hosted_local",
    title: "Self-hosted Local",
    subtitle: "Advanced",
    useWhen: "Sutraha and OpenClaw run in the same local/private environment",
    needs: "Local/private ws:// URL + local deployment access",
    setupTime: "~4 min",
  },
];

export function recommendTransportMode(
  wsUrl: string,
  isHttpsPage: boolean,
): OpenClawTransportMode {
  const value = wsUrl.trim().toLowerCase();
  if (!value) return "direct_ws";
  if (value.startsWith("wss://")) return "direct_ws";
  if (value.startsWith("ws://") && isHttpsPage) return "connector";
  if (
    value.includes("localhost") ||
    value.includes("127.0.0.1") ||
    value.includes("100.")
  ) {
    return isHttpsPage ? "connector" : "self_hosted_local";
  }
  return "direct_ws";
}

export const PUBLIC_WSS_SECURITY_CHECKLIST = [
  {
    id: "allowedOrigins",
    label: "I added this Synclaw origin to OpenClaw allowedOrigins.",
  },
  {
    id: "deviceApproval",
    label: "I approved this browser/device in OpenClaw device approvals.",
  },
  {
    id: "minimalScopes",
    label:
      "I configured minimum scopes (operator.read, operator.write, operator.admin).",
  },
  {
    id: "testPass",
    label: "I ran Test and confirmed handshake/pairing succeeds.",
  },
  {
    id: "dashboardProtection",
    label:
      "I protected OpenClaw dashboard/admin endpoints (auth + network controls).",
  },
] as const;

export function mapOpenClawSetupError(
  message: string,
  mode: OpenClawTransportMode,
): string {
  const lower = message.toLowerCase();
  if (lower.includes("closed before open") || lower.includes("mixed content")) {
    return "Browser blocked insecure WebSocket from HTTPS. Use Public WSS or switch to Private Connector.";
  }
  if (lower.includes("not configured")) {
    return "OpenClaw is not configured for this workspace yet.";
  }
  if (lower.includes("pair") || lower.includes("scope")) {
    return "Pairing/scopes are incomplete. Run the checklist in Settings -> OpenClaw.";
  }
  if (mode === "connector" && lower.includes("offline")) {
    return "Connector is offline. Start the connector process and retry.";
  }
  return message;
}
