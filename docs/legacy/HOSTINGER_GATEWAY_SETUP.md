# Setup managed-gateway on a Hostinger server (reverse proxy)

Use this guide when your **gateway/control plane** (the server that runs `packages/managed-gateway`) is on Hostinger — for example after moving from Hetzner or another provider. The gateway is the single VM that handles `/control/*` (bootstrap, routes) and `wss://.../ws/<workspaceId>` (WebSocket routing). Managed **workspace** VPS are created separately by Convex (also on Hostinger by default).

## What you need

- A **Hostinger VPS** (create one in hPanel; any region, e.g. closest to you).
- **SSH** access to that VPS (root or a user with sudo).
- A **domain** (e.g. `managed.synclaw.in`) pointed at the VPS IP.
- **Docker** and **Docker Compose** on the VPS (installed below).

## 1. Create the Hostinger VPS (gateway server)

In Hostinger hPanel:

1. Create a **VPS** (not shared hosting). Pick a plan with at least **2 vCPU / 4 GB RAM** for the control plane.
2. Choose **Ubuntu 24.04** (or another image that supports Docker).
3. Enable **public IPv4**.
4. Add your **SSH public key** (or set a root password and use it to SSH).
5. Open firewall for: **22** (SSH), **80** (HTTP), **443** (HTTPS). Restrict SSH to your IP if possible.

Note the **public IP** of the VPS.

## 2. Point DNS

Create an **A** record:

- **Name**: your gateway subdomain (e.g. `managed` for `managed.synclaw.in`).
- **Value**: the VPS public IP.
- **TTL**: 300–3600.

Wait for DNS to propagate (a few minutes).

## 3. SSH and install Docker + Compose

From your machine:

```bash
ssh root@<gateway-vps-ip>
```

On the VPS:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

Verify:

```bash
docker --version
docker compose version
```

## 4. Deploy managed-gateway

**From your local machine** (from the repo root):

```bash
scp -r packages/managed-gateway root@<gateway-vps-ip>:/opt/
```

**On the gateway VPS**:

```bash
cd /opt/managed-gateway
cp docker-compose.yml docker-compose.override.yml
chmod 700 bootstrap/openclaw-bootstrap.sh
```

Create a `.env` (or set vars in `docker-compose.override.yml`):

```bash
# Required
MANAGED_GATEWAY_API_TOKEN=<generate-a-strong-random-token>
MANAGED_UPSTREAM_WS_PORT=18789
MANAGED_UPSTREAM_WS_PATH=/
MANAGED_REQUIRE_CUSTOM_BOOTSTRAP_SCRIPT=true
MANAGED_BOOTSTRAP_SCRIPT_FILE=/app/bootstrap/openclaw-bootstrap.sh
```

Generate a token (example):

```bash
openssl rand -hex 32
```

## 5. Configure Caddy (reverse proxy)

Edit the **Caddyfile** so the domain matches your gateway:

```bash
nano /opt/managed-gateway/Caddyfile
```

Use your domain (e.g. `managed.synclaw.in`):

```
managed.synclaw.in {
  @ws path /ws/*
  reverse_proxy @ws managed-gateway:8788

  @control path /control/*
  reverse_proxy @control managed-gateway:8788
}
```

So:

- **`/control/*`** → reverse-proxied to the `managed-gateway` container on port **8788** (control plane API: bootstrap, routes, health).
- **`/ws/*`** → same container, port **8788** (WebSocket routing by workspace).

Caddy listens on **80** and **443** (and obtains TLS via Let’s Encrypt). The gateway app does **not** need to be exposed directly; only Caddy is on 80/443.

## 6. Start the stack

On the VPS:

```bash
cd /opt/managed-gateway
docker compose up -d --build
docker compose logs -f
```

Check that both **managed-gateway** and **caddy** are running. Exit logs with Ctrl+C.

## 7. Reverse proxy checklist

Confirm the following:

| Check | How |
|-------|-----|
| Caddy listens 80/443 | `ss -tlnp \| grep -E ':80|:443'` or `curl -I http://localhost` |
| `/control/*` → gateway:8788 | `curl -s -o /dev/null -w "%{http_code}" http://localhost/control/health` (expect 401 without auth or 200 with correct `Authorization`) |
| `/ws/*` → gateway:8788 | From outside: connect to `wss://<your-domain>/ws/<workspaceId>` (e.g. from Synclaw UI after Convex is configured) |
| TLS for your domain | Browse `https://<your-domain>/control/health` — Caddy should have issued a cert |
| No proxy loop | Gateway domain must **not** proxy catch‑all back to itself; only `/control/*` and `/ws/*` go to the gateway |

If `/control/health` returns 401, the reverse proxy is working and the gateway is replying (it requires auth for most routes). If you get 502/503, Caddy cannot reach `managed-gateway:8788` — check `docker compose ps` and that both services are on the same Docker network.

## 8. Configure Convex

Set Convex env vars so the app and Convex use **your** gateway URL (replace with your domain and token):

```bash
bunx convex env set MANAGED_CONTROL_PLANE_BASE_URL https://managed.synclaw.in/control
bunx convex env set MANAGED_BOOTSTRAP_API_BASE_URL https://managed.synclaw.in/control
bunx convex env set MANAGED_GATEWAY_API_BASE_URL https://managed.synclaw.in/control
bunx convex env set MANAGED_BOOTSTRAP_API_TOKEN <same-token-as-MANAGED_GATEWAY_API_TOKEN>
bunx convex env set MANAGED_GATEWAY_API_TOKEN <same-token-as-on-vps>
bunx convex env set MANAGED_OPENCLAW_WSS_TEMPLATE wss://managed.synclaw.in/ws/{workspaceId}
```

Use **production** or **dev** as needed (e.g. `--dev` for development).

## 9. Verify end-to-end

1. **Health**:  
   `curl -i https://<your-domain>/control/health`  
   You should get a response (e.g. 200 or 401 with a body). 5xx means Caddy or the gateway is misconfigured.

2. **From the app**: In Synclaw, go to **Settings → OpenClaw** and start a **managed** provisioning. The Convex backend will call your gateway at `MANAGED_CONTROL_PLANE_BASE_URL` for bootstrap and routes; the browser will connect to `wss://<your-domain>/ws/<workspaceId>`.

3. **Logs**: On the VPS, `docker compose logs -f managed-gateway` to see incoming requests and any errors.

## 10. Optional: bootstrap script and SSH (for non–Docker-deploy workspace VMs)

If you **do not** use Hostinger Docker deploy for workspace VMs (`MANAGED_HOSTINGER_DOCKER_DEPLOY_ENABLED=true`), then Convex will call `/control/bootstrap` and the gateway will **SSH** into the newly created workspace VPS. For that you must:

- Set **`MANAGED_BOOTSTRAP_SSH_PRIVATE_KEY`** in Convex (private key that can log in to the workspace VPS).
- Ensure the workspace VPS (created by Hostinger) has that key (e.g. via cloud-init or Hostinger’s key injection) so the gateway can SSH and run the bootstrap script.

If you **do** use Hostinger Docker deploy for workspace VMs, you can skip SSH/bootstrap key setup for those VMs; the gateway is still required for **routing** and **health checks**.

---

**Summary**: One Hostinger VPS runs `managed-gateway` + Caddy. Caddy reverse-proxies `/control/*` and `/ws/*` to the gateway. Convex and the app point to your gateway URL and token. After that, managed provisioning (and optional Hostinger Docker deploy for workspace VPS) works end-to-end.
