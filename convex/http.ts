import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { importPKCS8, SignJWT } from "jose";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

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

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function sha256Hex(payload: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(payload),
  );
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

http.route({
  path: "/api/v1/billing/razorpay/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      return new Response(
        JSON.stringify({ error: "RAZORPAY_WEBHOOK_SECRET is not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const rawBody = await request.text();
    const signature = request.headers.get("X-Razorpay-Signature");
    if (!signature) {
      return new Response(
        JSON.stringify({ error: "Missing X-Razorpay-Signature header" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const computed = await hmacSha256Hex(secret, rawBody);
    if (!timingSafeEqualHex(signature, computed)) {
      return new Response(
        JSON.stringify({ error: "Invalid Razorpay webhook signature" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const eventType = String(payload?.event ?? "");
    const headerEventId = request.headers.get("X-Razorpay-Event-Id");
    const payloadEventId =
      payload?.payload?.payment?.entity?.id ??
      payload?.payload?.subscription?.entity?.id ??
      payload?.contains?.entity ??
      null;
    const providerEventId = String(headerEventId ?? payloadEventId ?? "");
    if (!eventType || !providerEventId) {
      return new Response(
        JSON.stringify({ error: "Invalid Razorpay event payload" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const payloadDigest = await sha256Hex(rawBody);
    try {
      const result = await ctx.runMutation(
        internal.billing_razorpay_internal.processWebhookEvent,
        {
          providerEventId,
          eventType,
          payloadDigest,
          payload,
        },
      );
      return new Response(JSON.stringify({ received: true, ...result }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      return new Response(
        JSON.stringify({
          error: error?.message ?? "Webhook processing failed",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  }),
});

http.route({
  path: "/api/v1/billing/razorpay/webhook",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, X-Razorpay-Signature, X-Razorpay-Event-Id",
        "Access-Control-Max-Age": "86400",
      },
    });
  }),
});

export default http;
