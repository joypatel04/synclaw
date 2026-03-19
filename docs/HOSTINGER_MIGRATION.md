# Hostinger Managed Provisioning

This guide explains how to use **Hostinger** for creating managed OpenClaw servers (default cloud provider).

**Provider choice:** Hostinger bills **monthly upfront**. If you want **usage-based (hourly)** billing for building and testing (create/destroy servers without paying for a full month), use **DigitalOcean** instead. See **[MANAGED_PROVIDERS.md](./MANAGED_PROVIDERS.md)** for comparison and `MANAGED_CLOUD_PROVIDER=digitalocean` setup.

## Overview

Hostinger uses a purchase + setup flow: you provide a **catalog item ID** (VPS plan) and **setup** parameters (including datacenter). The API may return the VM id first; we then poll for the VM’s IP until it’s ready. Region mapping (our internal codes → Hostinger datacenter IDs) is configurable; use **VPS_getDataCenterListV1** to get the actual IDs for your account.

## 1. Get Hostinger API access

1. Sign in at [hPanel](https://hpanel.hostinger.com/).
2. Go to **Profile → API** and create/copy your **API token**.
3. Use this token as `HOSTINGER_API_TOKEN` (see below).

API reference: [developers.hostinger.com](https://developers.hostinger.com).

## 2. Regions: all Hostinger datacenters in the UI

The app fetches **all available Hostinger datacenters** from the Hostinger API (`listHostingerDatacenters`) and shows them in the region dropdown when you have `HOSTINGER_API_TOKEN` set. Users can pick the region closest to them for lower latency. No manual mapping needed — the UI lists whatever Hostinger returns (e.g. Lithuania, Germany, UK, USA, Brazil, France). Optional: latency display (like Hostinger’s UI) can be added later by measuring from the browser to each region.

## 3. Get your VPS catalog item ID and build plans with margin

Hostinger provisions VPS by **catalog item ID** (price/plan), not by server type name.

### Finding catalog item IDs via API

- In Convex we expose **`listHostingerCatalogItems`** (calls Hostinger **billing_getCatalogItemListV1**). Call it (e.g. from a small admin script or dashboard) with optional `category` / `name` to list VPS plans. Each item has `id`, `name`, `priceCents`, `currency`. Use the `id` as `MANAGED_HOSTINGER_CATALOG_ITEM_ID` for the plan you want.
- Or use the [Hostinger API docs](https://developers.hostinger.com) / hPanel to find the catalog item ID for your chosen VPS plan (e.g. “KVM 1”, “KVM 2”).

### Building your own plans with margin

- **Hostinger cost**: Use `priceCents` from the catalog (prices are in cents, e.g. $17.99 → 1799).
- **Your price**: Add margin for Vercel, your time/effort, and (later) payment processing. Example: `your_price = hostinger_price + margin`; margin can be a fixed amount or a percentage. Razorpay (you have test credentials) will be integrated later for collecting payment; for now you can define plans and store the Hostinger catalog item ID per plan (e.g. “Starter” → one catalog id, “Standard” → another) and set `MANAGED_HOSTINGER_CATALOG_ITEM_ID` per deployment or map server profile to catalog id in code.
- **Multiple plans**: You can map your server profiles (starter / standard / performance) to different Hostinger catalog item IDs (e.g. via env or a small config) so each tier uses the right Hostinger plan and you apply your margin on top.

## 4. Convex environment variables

Set these in your Convex deployment (e.g. `bunx convex env set ...` for production).

### Required for Hostinger (default provider)

```bash
HOSTINGER_API_TOKEN=<your Hostinger API token>
MANAGED_HOSTINGER_CATALOG_ITEM_ID=<catalog item ID for your VPS plan>
```

**Get catalog item ID with curl:** The Hostinger API base URL is **`https://developers.hostinger.com`** (not api.hostinger.com). Use your API token to list catalog items (VPS plans):

```bash
# List catalog (replace YOUR_HOSTINGER_TOKEN with your token)
curl -s -H "Authorization: Bearer YOUR_HOSTINGER_TOKEN" \
  "https://developers.hostinger.com/api/billing/v1/catalog" | jq .
```

In the response, each VPS product has an **id** (e.g. `hostingercom-vps-kvm1`) and a **prices** array. For provisioning you must use a **price id** (e.g. `hostingercom-vps-kvm1-usd-1m` for KVM 1 billed monthly). Pick the `id` from the chosen entry in **prices**, not the product `id`. Then:

```bash
bunx convex env set MANAGED_HOSTINGER_CATALOG_ITEM_ID "hostingercom-vps-kvm1-usd-1m"
```

Convex defaults to **`https://developers.hostinger.com`** and **`/api/billing/v1/catalog`**; override with `MANAGED_HOSTINGER_API_BASE_URL` and `MANAGED_HOSTINGER_CATALOG_PATH` if needed.

### Optional Hostinger settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MANAGED_HOSTINGER_API_BASE_URL` | `https://developers.hostinger.com` | Official API host (Hostinger OpenAPI). |
| `MANAGED_HOSTINGER_PURCHASE_PATH` | `/api/vps/v1/virtual-machines` | POST path for “purchase new VM”. |
| `MANAGED_HOSTINGER_VM_LIST_PATH` | `/api/vps/v1/virtual-machines` | GET path to list VMs (poll for IP after purchase). |
| `MANAGED_HOSTINGER_TEMPLATE_ID` | `1130` | VPS template ID (OS image). Override if your plan uses a different template. |
| `MANAGED_HOSTINGER_SETUP_JSON` | (none) | JSON merged into `setup` (e.g. `{"post_install_script_id": 123}`). `data_center_id` and `template_id` are set from region and `MANAGED_HOSTINGER_TEMPLATE_ID`. |
| `MANAGED_HOSTINGER_DEFAULT_REGION` | `lt` | Default Hostinger datacenter id when none is selected (must match an id from `listHostingerDatacenters`). |
| `MANAGED_HOSTINGER_IP_POLL_TIMEOUT_MS` | `120000` | Max time (ms) to wait for VM IP after purchase. |
| `MANAGED_HOSTINGER_IP_POLL_INTERVAL_MS` | `10000` | Poll interval (ms) when waiting for VM IP. |
| `MANAGED_HOSTINGER_SERVER_TYPE` | (from server profile) | Label for logs (e.g. `kvm1`). |

If the Hostinger API uses different paths or request/response shapes, adjust the paths above or the defaults in `convex/managedProvisioning.ts` to match the [official API documentation](https://developers.hostinger.com).

## 5. 1-click style: Deploy OpenClaw via Hostinger Docker API (no SSH)

Hostinger’s API supports **deploying a Docker Compose project** on an existing VPS (**VPS_createNewProjectV1**). You can use this to install and run OpenClaw on the new VM **without SSH** and without the traditional bootstrap script.

### What you can avoid

When Docker deploy is enabled for Hostinger:

- **No `MANAGED_BOOTSTRAP_SSH_PRIVATE_KEY`** – the control plane never SSHs into the VM.
- **No cloud-init for SSH keys** – the VM only needs to run Docker (Hostinger’s VPS images typically have Docker / Docker Manager).
- **No `/control/bootstrap` SSH step** – Convex calls the Hostinger API to create the project (compose + env vars) instead of asking the gateway to SSH and run a script.

You still need: purchase VM (existing flow), then **create project** (one API call with compose URL or raw YAML + env vars), then gateway route config and healthcheck as today.

### Enable Docker deploy

Set in Convex:

```bash
MANAGED_HOSTINGER_DOCKER_DEPLOY_ENABLED=true
```

Then provide the compose that runs OpenClaw (and optionally the files bridge) in one of two ways:

- **URL**: set `MANAGED_HOSTINGER_DOCKER_COMPOSE_URL` to a URL that returns a `docker-compose.yaml` (e.g. raw GitHub, or your own host). Hostinger will pull it and run it with the env vars we pass.
- **Inline**: set `MANAGED_HOSTINGER_DOCKER_COMPOSE_RAW` to the raw YAML string of the compose (e.g. base64-decode at runtime if you store it encoded). We send this as the `content` in the create-project request.

We inject **environment variables** (e.g. `OPENCLAW_GATEWAY_TOKEN`, `OPENCLAW_GATEWAY_PORT`, `OPENCLAW_WORKSPACE_ID`, `FS_BRIDGE_TOKEN`, `FS_BRIDGE_PORT`) into the project via the Hostinger API’s `environment` parameter so the containers start with the correct tokens and ports.

### Compose requirements

The compose must:

- Run the **OpenClaw gateway** (e.g. `openclaw gateway run`) listening on the port you use for the upstream WebSocket (default `18789`).
- Use **env vars** for token, port, workspace id, and (if you use the files bridge) `FS_BRIDGE_*` so we can pass them from Convex.

You can use the minimal template in `packages/managed-gateway/docker-openclaw-managed.yaml` (or host it elsewhere and set `MANAGED_HOSTINGER_DOCKER_COMPOSE_URL` to that URL). Hostinger does **not** ship a pre-made “OpenClaw” 1-click app; this flow uses their **API** to deploy your own compose as a one-step setup.

### Optional Hostinger Docker deploy vars

| Variable | Required when Docker deploy enabled | Description |
|----------|-------------------------------------|-------------|
| `MANAGED_HOSTINGER_DOCKER_DEPLOY_ENABLED` | – | Set to `true` to use Hostinger createNewProject instead of SSH bootstrap. |
| `MANAGED_HOSTINGER_DOCKER_COMPOSE_URL` | One of URL or RAW | URL that returns `docker-compose.yaml` (e.g. raw GitHub link). |
| `MANAGED_HOSTINGER_DOCKER_COMPOSE_RAW` | One of URL or RAW | Raw YAML string for the compose (used as `content` if URL not set). |
| `MANAGED_HOSTINGER_PROJECT_NAME` | No | Docker project name (default `openclaw-managed`). |
| `MANAGED_HOSTINGER_PROJECT_CREATE_PATH` | No | API path for create project (default `/v1/vps/projects`). |

## 6. Keep existing control-plane and bootstrap vars

When **not** using Hostinger Docker deploy, all other managed provisioning vars stay the same (bootstrap, gateway, healthcheck, etc.). When using Hostinger Docker deploy, you do **not** need `MANAGED_BOOTSTRAP_SSH_PRIVATE_KEY` or SSH-related bootstrap vars for the new VM.

Examples (unchanged):

```bash
MANAGED_CONTROL_PLANE_BASE_URL=https://synclaw.in/control
MANAGED_BOOTSTRAP_API_BASE_URL=https://synclaw.in/control
MANAGED_BOOTSTRAP_API_TOKEN=...
MANAGED_BOOTSTRAP_USER=root
MANAGED_BOOTSTRAP_SSH_PRIVATE_KEY=...
MANAGED_GATEWAY_API_BASE_URL=https://synclaw.in/control
MANAGED_GATEWAY_API_TOKEN=...
MANAGED_OPENCLAW_WSS_TEMPLATE=wss://synclaw.in/ws/{workspaceId}
# ... etc.
```

## 7. Run the gateway itself on Hostinger

The **control plane / gateway** (the server that runs `packages/managed-gateway` and reverse-proxies `/control/*` and `/ws/*`) can also run on Hostinger. See **[HOSTINGER_GATEWAY_SETUP.md](HOSTINGER_GATEWAY_SETUP.md)** for creating the Hostinger VPS, installing Docker, deploying the gateway, configuring Caddy, and the reverse proxy checklist.

## 8. Deploy and test

1. Deploy Convex (e.g. `bunx convex deploy`).
2. Trigger a **new** managed OpenClaw provisioning from the app (e.g. from OpenClaw settings).
3. Check Convex logs and your Hostinger hPanel to confirm the VPS is created and gets an IP; bootstrap and gateway steps should run as before.

## Troubleshooting

- **“VM id is missing in response”**: The Hostinger API response shape may differ. Check [developers.hostinger.com](https://developers.hostinger.com) and, if needed, update the response parsing in `convex/managedProvisioning.ts` (`provisionWithHostinger`) to match the real payload (e.g. `virtual_machine.id`, `data.id`, etc.).
- **“Hostinger API error (4xx)”**: Verify `HOSTINGER_API_TOKEN`, `MANAGED_HOSTINGER_CATALOG_ITEM_ID`, and (if used) `MANAGED_HOSTINGER_SETUP_JSON`. Ensure the catalog item is a VPS plan and that your account has a valid payment method if required.
- **IP never appears**: Increase `MANAGED_HOSTINGER_IP_POLL_TIMEOUT_MS` or check in hPanel that the VPS is created and has an IP; adjust `MANAGED_HOSTINGER_VM_LIST_PATH` and the parsing of the list response if the API format differs.
