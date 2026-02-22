import { internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { decryptSecretFromHex } from "./lib/secretCrypto";

export const getBridgeConfig = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    if (!row || !row.filesBridgeEnabled) return null;

    const token =
      row.filesBridgeTokenCiphertextHex && row.filesBridgeTokenIvHex
        ? await decryptSecretFromHex(
            row.filesBridgeTokenCiphertextHex,
            row.filesBridgeTokenIvHex,
          )
        : null;

    return {
      baseUrl: (row.filesBridgeBaseUrl ?? "").trim(),
      rootPath: (row.filesBridgeRootPath ?? "").trim(),
      token,
    };
  },
});

