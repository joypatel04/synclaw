# Managed Gateway Manual Setup

This guide is for phase 1: manually creating and running the managed gateway VM.

**Using Hostinger for the gateway server?** See **[HOSTINGER_GATEWAY_SETUP.md](HOSTINGER_GATEWAY_SETUP.md)** for step-by-step Hostinger setup and reverse proxy checklist.

## Goal

Stand up one always-on VM that serves:
- `https://<gateway-domain>/control/*` (control plane API)
- `wss://<gateway-domain>/ws/<workspaceId>` (WebSocket routing)

Recommended initial domain: `managed.synclaw.in`.

## 1) Create the gateway server (manual)

Create a VM with any provider (e.g. Hostinger, AWS, or another VPS). Use:

1. Location: closest region to your users (e.g. EU if your managed workspaces are in EU).
2. Image: `Ubuntu 24.04` (recommended).
3. Type: at least 2 vCPU / 4 GB RAM for low traffic.
4. Networking: Public IPv4 enabled.
5. SSH: Add your SSH public key (recommended).
6. Firewall: Inbound TCP `22` (your IP), `80` and `443` from `0.0.0.0/0`.

Notes:
- This VM is only for gateway/control-plane in phase 1.
- Managed workspace servers are created separately by your Convex flow (Hostinger by default).

## 2) Point DNS

Create DNS records:
- `A managed.synclaw.in -> <gateway-vm-ipv4>`

## 3) Install Docker + Compose on gateway VM

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

## 4) Deploy managed-gateway

On your local machine:

```bash
scp -r packages/managed-gateway root@<gateway-vm-ip>:/opt/
```

On the gateway VM:

```bash
cd /opt/managed-gateway
cp docker-compose.yml docker-compose.override.yml
```

Set executable permissions on the hardened bootstrap script:

```bash
chmod 700 /opt/managed-gateway/bootstrap/openclaw-bootstrap.sh
```

Edit `docker-compose.override.yml` and set:
- `MANAGED_GATEWAY_API_TOKEN=<strong-random-token>`
- `MANAGED_UPSTREAM_WS_PORT=18789`
- `MANAGED_UPSTREAM_WS_PATH=/`
- `MANAGED_REQUIRE_CUSTOM_BOOTSTRAP_SCRIPT=true`
- `MANAGED_BOOTSTRAP_SCRIPT_FILE=/opt/managed-gateway/bootstrap/openclaw-bootstrap.sh`

Edit `Caddyfile` to use your gateway domain (example `managed.synclaw.in`).

Start:

```bash
docker compose up -d --build
docker compose logs -f
```

Health check:

```bash
curl -i https://managed.synclaw.in/control/health
```

## 5) Configure Convex env vars

Set in Convex (dev first):

```bash
bunx convex env set MANAGED_CONTROL_PLANE_BASE_URL https://managed.synclaw.in/control --dev
bunx convex env set MANAGED_GATEWAY_API_TOKEN <same-token> --dev
bunx convex env set MANAGED_BOOTSTRAP_API_TOKEN <same-token> --dev
bunx convex env set MANAGED_OPENCLAW_WSS_TEMPLATE wss://managed.synclaw.in/ws/{workspaceId} --dev
```

Also ensure Hostinger (or your provider) env vars are set in Convex — see [HOSTINGER_MIGRATION.md](HOSTINGER_MIGRATION.md) for `HOSTINGER_API_TOKEN`, `MANAGED_HOSTINGER_CATALOG_ITEM_ID`, etc.

## 6) SSH/bootstrap prerequisite for managed created servers (when not using Hostinger Docker deploy)

When using SSH bootstrap (not Hostinger 1-click Docker), you must inject your bootstrap public key into newly created servers (e.g. via cloud-init). Convex sends `MANAGED_BOOTSTRAP_SSH_PRIVATE_KEY` to `/control/bootstrap`. If using Hostinger with `MANAGED_HOSTINGER_DOCKER_DEPLOY_ENABLED=true`, SSH is not required for new VMs.

## 7) Real bootstrap requirement (important)

`managed-gateway` now requires a real `MANAGED_BOOTSTRAP_SCRIPT` by default.
It receives template placeholders (including `{{OPENCLAW_GATEWAY_TOKEN}}` and
`{{UPSTREAM_PORT}}`) and must install/start OpenClaw on the provisioned host.

If `MANAGED_BOOTSTRAP_SCRIPT` is not set, `/control/bootstrap` fails fast with
an explicit error.

## Quick answers

- Which image: `Ubuntu 24.04`.
- Need volume: No, not for initial beta.
- Firewall: Yes, definitely.
- Backups: Optional for beta, recommended once production traffic starts.
