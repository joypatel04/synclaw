# Managed Gateway Manual Setup (Hetzner)

This guide is for phase 1: manually creating and running the managed gateway VM.

## Goal

Stand up one always-on VM that serves:
- `https://<gateway-domain>/control/*` (control plane API)
- `wss://<gateway-domain>/ws/<workspaceId>` (WebSocket routing)

Recommended initial domain: `managed.synclaw.in`.

## 1) Create the Hetzner server (manual)

Use these values in Hetzner Cloud Console:

1. Location: `Nuremberg (nbg1)` or closest region to your users.
2. Image: `Ubuntu 24.04` (recommended).
3. Type: `cx22` (good starter for low traffic).
4. Networking: Public IPv4 enabled (default).
5. SSH: Add your SSH public key (recommended, no password emails).
6. Volumes: None for now.
7. Firewall: Attach one with minimum rules:
- Inbound TCP `22` from your IP only.
- Inbound TCP `80` from `0.0.0.0/0`.
- Inbound TCP `443` from `0.0.0.0/0`.
8. Backups: Optional for beta; recommended once stable.

Notes:
- This VM is only for gateway/control-plane in phase 1.
- Managed workspace servers are created separately by your Convex flow.

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

Also ensure:
- `HETZNER_API_TOKEN` is set.
- `MANAGED_HETZNER_SERVER_TYPE=cx22`
- `MANAGED_HETZNER_FALLBACK_SERVER_TYPE=cx22`

## 6) SSH/bootstrap prerequisite for managed created servers

You must inject your bootstrap public key into newly created servers via cloud-init:
- Convex uses `MANAGED_HETZNER_CLOUD_INIT` for this.
- Convex sends `MANAGED_BOOTSTRAP_SSH_PRIVATE_KEY` to `/control/bootstrap`.

If this is missing, provisioning reaches create-server but fails at bootstrap SSH step.

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
