import { ConvexHttpClient } from "convex/browser";

interface TokenResponse {
  token: string;
  expiresAt: number;
}

type RuntimeConvexClient = {
  query: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
  mutation: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
};

export class BridgeConvexClient {
  private client: ConvexHttpClient;
  private runtimeClient: RuntimeConvexClient;
  private siteUrl: string;
  private apiKey: string;
  private workspaceId: string;
  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(config: {
    convexUrl: string;
    convexSiteUrl: string;
    apiKey: string;
    workspaceId: string;
  }) {
    this.client = new ConvexHttpClient(config.convexUrl);
    this.runtimeClient = this.client as unknown as RuntimeConvexClient;
    this.siteUrl = config.convexSiteUrl;
    this.apiKey = config.apiKey;
    this.workspaceId = config.workspaceId;
  }

  private async ensureAuth(): Promise<void> {
    if (this.token && this.tokenExpiresAt > Date.now() + 5 * 60 * 1000) return;

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

    const data = (await res.json()) as TokenResponse;
    this.token = data.token;
    this.tokenExpiresAt = data.expiresAt;
    this.client.setAuth(data.token);
  }

  async query(functionName: string, args: Record<string, unknown> = {}) {
    await this.ensureAuth();
    return this.runtimeClient.query(functionName, {
      workspaceId: this.workspaceId,
      ...args,
    });
  }

  async mutation(functionName: string, args: Record<string, unknown> = {}) {
    await this.ensureAuth();
    return this.runtimeClient.mutation(functionName, {
      workspaceId: this.workspaceId,
      ...args,
    });
  }
}
