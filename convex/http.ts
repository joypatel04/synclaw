import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { importPKCS8, SignJWT } from "jose";

const http = httpRouter();

// ─── Auth routes (GitHub OAuth etc.) ──────────────────────────────
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
          JSON.stringify({ error: "Missing Authorization: Bearer <api-key> header" }),
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
          JSON.stringify({ error: "Server misconfigured: JWT_PRIVATE_KEY not set" }),
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

export default http;
