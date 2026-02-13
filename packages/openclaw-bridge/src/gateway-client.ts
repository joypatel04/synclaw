import WebSocket from "ws";
import type { BridgeConfig } from "./config.js";

export type GatewayMessage = Record<string, unknown>;

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

export class GatewayClient {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<string, PendingRequest>();

  constructor(
    private config: BridgeConfig,
    private onEvent: (event: GatewayMessage) => Promise<void>,
  ) {}

  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    await new Promise<void>((resolve, reject) => {
      const headers: Record<string, string> = {};
      if (this.config.gatewayAuthToken) {
        headers.Authorization = `Bearer ${this.config.gatewayAuthToken}`;
      }
      if (this.config.gatewayOrigin) {
        headers.Origin = this.config.gatewayOrigin;
      }

      const ws = new WebSocket(this.config.gatewayWsUrl, { headers });
      this.ws = ws;

      ws.on("open", async () => {
        try {
          await this.request("connect", {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: this.config.gatewayClientId,
              version: "0.1.0",
              mode: this.config.gatewayClientMode,
              platform: this.config.gatewayClientPlatform,
            },
            role: this.config.gatewayRole,
            scopes: this.config.gatewayScopes,
            locale: "en-US",
            auth: {
              token: this.config.gatewayAuthToken,
              password: this.config.gatewayPassword,
            },
          });
          if (this.config.subscribeOnConnect) {
            try {
              await this.request("chat.subscribe", {});
            } catch (error) {
              const message =
                error instanceof Error ? error.message : String(error);
              // Some gateway builds don't expose chat.subscribe. Keep connection alive.
              if (message.includes("unknown method: chat.subscribe")) {
                console.warn(
                  "Gateway does not support chat.subscribe; continuing without explicit subscription.",
                );
              } else {
                throw error;
              }
            }
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      ws.on("message", async (raw) => {
        try {
          const data = JSON.parse(raw.toString()) as GatewayMessage;
          const responseId = this.extractResponseId(data);
          if (
            responseId &&
            (data.result !== undefined ||
              data.error !== undefined ||
              data.ok !== undefined)
          ) {
            const pending = this.pending.get(responseId);
            if (!pending) return;
            clearTimeout(pending.timeout);
            this.pending.delete(responseId);
            if (data.error || data.ok === false) {
              pending.reject(new Error(JSON.stringify(data.error)));
            } else {
              pending.resolve(data.result ?? data);
            }
            return;
          }

          await this.onEvent(data);
        } catch (error) {
          // Keep bridge alive for malformed events.
          console.warn("Gateway event parse/handler error:", error);
        }
      });

      ws.on("error", (err) => reject(err));
      ws.on("close", () => {
        this.ws = null;
        for (const [id, pending] of this.pending.entries()) {
          clearTimeout(pending.timeout);
          pending.reject(new Error(`Gateway socket closed (request ${id})`));
        }
        this.pending.clear();
      });
    });
  }

  async disconnect(): Promise<void> {
    if (!this.ws) return;
    await new Promise<void>((resolve) => {
      this.ws?.once("close", () => resolve());
      this.ws?.close();
    });
  }

  async request(method: string, params: Record<string, unknown>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Gateway socket not connected");
    }

    const id = String(this.nextId++);
    const payload =
      this.config.gatewayProtocol === "jsonrpc"
        ? { jsonrpc: "2.0", id, method, params }
        : { type: "req", id, method, params };

    return await new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Gateway request timeout: ${method}`));
      }, 20_000);

      this.pending.set(id, { resolve, reject, timeout });
      this.ws?.send(JSON.stringify(payload), (err) => {
        if (err) {
          clearTimeout(timeout);
          this.pending.delete(id);
          reject(err);
        }
      });
    });
  }

  private extractResponseId(data: GatewayMessage): string | null {
    if (typeof data.id === "string") return data.id;
    if (typeof data.id === "number") return String(data.id);
    return null;
  }

  async sendChat(params: {
    sessionKey: string;
    content: string;
    clientMessageId: string;
  }) {
    return await this.request("chat.send", {
      sessionKey: params.sessionKey,
      content: params.content,
      clientMessageId: params.clientMessageId,
    });
  }

  async abortChat(params: {
    sessionKey: string;
    runId: string;
    clientMessageId: string;
  }) {
    return await this.request("chat.abort", {
      sessionKey: params.sessionKey,
      runId: params.runId,
      clientMessageId: params.clientMessageId,
    });
  }
}
