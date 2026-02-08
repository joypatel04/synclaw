import { action } from "./_generated/server";
import { v } from "convex/values";

export const sendToAgent = action({
  args: {
    sessionKey: v.string(),
    message: v.string(),
  },
  handler: async (_ctx, args) => {
    const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL;
    if (!gatewayUrl) {
      console.warn("OPENCLAW_GATEWAY_URL not configured, skipping agent send");
      return { success: false, error: "Gateway URL not configured" };
    }

    try {
      const response = await fetch(
        `${gatewayUrl}/api/sessions/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionKey: args.sessionKey,
            message: args.message,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenClaw send failed:", errorText);
        return { success: false, error: errorText };
      }

      return { success: true, data: await response.json() };
    } catch (error) {
      console.error("OpenClaw send error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
