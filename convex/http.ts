import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { importPKCS8, SignJWT } from "jose";
import { auth } from "./auth";
import {
  parseWebhookPayload,
  sanitizeWebhookHeaders,
  verifyWebhookSecret,
  WEBHOOK_MAX_PAYLOAD_BYTES,
  WEBHOOK_RATE_LIMIT_MAX_REQUESTS,
  WEBHOOK_RATE_LIMIT_WINDOW_MS,
} from "./lib/webhooks";

const http = httpRouter();

auth.addHttpRoutes(http);

const webhookRateState = new Map<string, number[]>();

function isWebhookRateLimited(webhookId: string): boolean {
  const now = Date.now();
  const windowStart = now - WEBHOOK_RATE_LIMIT_WINDOW_MS;
  const current = webhookRateState.get(webhookId) ?? [];
  const trimmed = current.filter((ts) => ts >= windowStart);
  trimmed.push(now);
  webhookRateState.set(webhookId, trimmed);
  return trimmed.length > WEBHOOK_RATE_LIMIT_MAX_REQUESTS;
}

// ─── Token Exchange: API Key → JWT ────────────────────────────────
//
// POST /api/v1/auth/token
// Header: Authorization: Bearer sk_xxx
// Returns: { token: "eyJ...", expiresAt: 1234567890 }
//
http.route({
  path: "/api/v1/auth/token",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // CORS headers
    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    };

    try {
      // 1. Extract API key from Authorization header
      const authHeader = request.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({
            error: "Missing Authorization: Bearer <api-key> header",
          }),
          { status: 401, headers },
        );
      }
      const apiKey = authHeader.slice(7);

      // 2. Hash the key and validate
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(apiKey),
      );
      const keyHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const keyRecord = await ctx.runMutation(internal.apiKeys.validateByHash, {
        keyHash,
      });

      if (!keyRecord) {
        return new Response(
          JSON.stringify({ error: "Invalid or revoked API key" }),
          { status: 401, headers },
        );
      }

      // 3. Create/refresh an auth session for the bot user
      const expirationTime = Date.now() + 60 * 60 * 1000; // 1 hour

      const sessionId = await ctx.runMutation(
        internal.apiKeys_internal.createSession,
        {
          userId: keyRecord.botUserId,
          expirationTime,
        },
      );

      // 4. Sign a JWT using the private key
      const privateKeyPem = process.env.JWT_PRIVATE_KEY;
      if (!privateKeyPem) {
        return new Response(
          JSON.stringify({
            error: "Server misconfigured: JWT_PRIVATE_KEY not set",
          }),
          { status: 500, headers },
        );
      }

      const privateKey = await importPKCS8(privateKeyPem, "RS256");

      const token = await new SignJWT({
        sub: `${keyRecord.botUserId}`,
      })
        .setProtectedHeader({ alg: "RS256" })
        .setIssuedAt()
        .setIssuer(process.env.CONVEX_SITE_URL!)
        .setAudience("convex")
        .setExpirationTime(Math.floor(expirationTime / 1000))
        .sign(privateKey);

      return new Response(
        JSON.stringify({ token, expiresAt: expirationTime }),
        { status: 200, headers },
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message || "Internal server error" }),
        { status: 500, headers },
      );
    }
  }),
});

// CORS preflight for the token endpoint
http.route({
  path: "/api/v1/auth/token",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }),
});

http.route({
  path: "/api/v1/workspaces/webhooks/ingest",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const jsonHeaders = { "Content-Type": "application/json" };
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    const webhookId = url.searchParams.get("webhookId");

    if (!workspaceId || !webhookId) {
      return new Response(
        JSON.stringify({
          error:
            "Missing workspaceId or webhookId query param. Expected /ingest?workspaceId=...&webhookId=...",
        }),
        { status: 400, headers: jsonHeaders },
      );
    }

    if (isWebhookRateLimited(webhookId)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: jsonHeaders,
      });
    }

    // Accept both new and legacy header names for backward compatibility.
    const providedSecret =
      request.headers.get("X-Synclaw-Webhook-Secret") ??
      request.headers.get("X-Sutraha-Webhook-Secret");
    if (!providedSecret) {
      return new Response(
        JSON.stringify({ error: "Missing X-Synclaw-Webhook-Secret header" }),
        { status: 401, headers: jsonHeaders },
      );
    }

    const webhook = await ctx.runMutation(
      internal.webhooks_internal.getWebhookSecretHash,
      {
        workspaceId: workspaceId as any,
        webhookId: webhookId as any,
      },
    );
    if (!webhook) {
      return new Response(JSON.stringify({ error: "Webhook not found" }), {
        status: 404,
        headers: jsonHeaders,
      });
    }

    const isValidSecret = await verifyWebhookSecret(
      providedSecret,
      webhook.secretHash,
    );
    if (!isValidSecret) {
      return new Response(JSON.stringify({ error: "Invalid webhook secret" }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    const rawBody = await request.text();
    const bodySize = new TextEncoder().encode(rawBody).byteLength;
    if (bodySize > WEBHOOK_MAX_PAYLOAD_BYTES) {
      return new Response(
        JSON.stringify({
          error: `Payload too large. Max ${WEBHOOK_MAX_PAYLOAD_BYTES} bytes`,
        }),
        { status: 413, headers: jsonHeaders },
      );
    }

    const contentType = request.headers.get("Content-Type") ?? "application/json";
    const payload = parseWebhookPayload(rawBody, contentType);
    const providerEventId = request.headers.get("X-Provider-Event-Id") ?? undefined;
    const headers = sanitizeWebhookHeaders(request.headers);

    try {
      const result = await ctx.runMutation(internal.webhooks_internal.ingestPayload, {
        workspaceId: workspaceId as any,
        webhookId: webhookId as any,
        providerEventId,
        headers,
        payload,
        contentType,
      });
      return new Response(
        JSON.stringify({
          received: true,
          ...result,
        }),
        { status: 202, headers: jsonHeaders },
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error?.message ?? "Webhook processing failed" }),
        { status: 500, headers: jsonHeaders },
      );
    }
  }),
});

http.route({
  path: "/api/v1/workspaces/webhooks/ingest",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, X-Synclaw-Webhook-Secret, X-Sutraha-Webhook-Secret, X-Provider-Event-Id",
        "Access-Control-Max-Age": "86400",
      },
    });
  }),
});

export default http;
