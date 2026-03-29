/**
 * Convex client wrapper with API key → JWT auto-refresh auth.
 */
import { ConvexHttpClient } from "convex/browser";

interface TokenResponse {
  token: string;
  expiresAt: number;
}

export class SynclawClient {
  private client: ConvexHttpClient;
  private siteUrl: string;
  private apiKey: string;
  public workspaceId: string;
  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(config: {
    convexUrl: string;
    convexSiteUrl: string;
    apiKey: string;
    workspaceId: string;
  }) {
    this.client = new ConvexHttpClient(config.convexUrl);
    this.siteUrl = config.convexSiteUrl;
    this.apiKey = config.apiKey;
    this.workspaceId = config.workspaceId;
  }

  /** Ensure we have a valid token, refreshing if needed. */
  private async ensureAuth(): Promise<void> {
    // Refresh if token expires in less than 5 minutes
    if (this.token && this.tokenExpiresAt > Date.now() + 5 * 60 * 1000) {
      return;
    }

    const res = await fetch(`${this.siteUrl}/api/v1/auth/token`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Token exchange failed (${res.status}): ${body}`);
    }

    const data: TokenResponse = await res.json();
    this.token = data.token;
    this.tokenExpiresAt = data.expiresAt;
    this.client.setAuth(data.token);
  }

  /** Execute a Convex query with auto-auth. */
  async query(functionRef: any, args: Record<string, any> = {}): Promise<any> {
    await this.ensureAuth();
    return this.client.query(functionRef, {
      workspaceId: this.workspaceId,
      ...args,
    });
  }

  /** Execute a Convex mutation with auto-auth. */
  async mutation(
    functionRef: any,
    args: Record<string, any> = {},
  ): Promise<any> {
    await this.ensureAuth();
    return this.client.mutation(functionRef, {
      workspaceId: this.workspaceId,
      ...args,
    });
  }

  /** Execute a Convex mutation WITHOUT auto-adding workspaceId.
   *  Use for functions that don't take workspaceId (e.g., updateHeartbeat). */
  async rawMutation(
    functionRef: any,
    args: Record<string, any> = {},
  ): Promise<any> {
    await this.ensureAuth();
    return this.client.mutation(functionRef, args);
  }
}

/** Create a client from environment variables. */
export function createClientFromEnv(): SynclawClient {
  const convexUrl = process.env.CONVEX_URL;
  const convexSiteUrl = process.env.CONVEX_SITE_URL;
  const apiKey = process.env.SYNCLAW_API_KEY;
  const workspaceId = process.env.SYNCLAW_WORKSPACE_ID;

  if (!convexUrl) throw new Error("Missing CONVEX_URL env var");
  if (!convexSiteUrl) throw new Error("Missing CONVEX_SITE_URL env var");
  if (!apiKey) throw new Error("Missing SYNCLAW_API_KEY env var");
  if (!workspaceId) throw new Error("Missing SYNCLAW_WORKSPACE_ID env var");

  return new SynclawClient({ convexUrl, convexSiteUrl, apiKey, workspaceId });
}
