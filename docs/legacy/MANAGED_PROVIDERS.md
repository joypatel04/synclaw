# Managed OpenClaw: Cloud provider choice

You can run managed OpenClaw servers on **Hostinger**, **DigitalOcean**, or **AWS**. Set `MANAGED_CLOUD_PROVIDER` in Convex to choose.

## Billing: monthly upfront vs usage-based

| Provider       | Billing model              | Best for                          |
|----------------|----------------------------|-----------------------------------|
| **Hostinger**  | **Monthly upfront**        | Production when you want 1-click Docker deploy and fixed monthly cost. |
| **DigitalOcean** | **Hourly (usage-based)** | **Building, testing, dev** – create/destroy droplets; pay only for hours used. No monthly commitment. |
| **AWS**       | Per-second (usage-based)   | When you already use AWS and have AMIs/keys. |

- **Hostinger**: You pay for the full billing period (e.g. month) when you order. Creating multiple VPSes for testing means paying for each for the whole period.
- **DigitalOcean**: Droplets are billed **hourly**. Billing starts when the droplet is created and **stops when you destroy it**. Ideal for trying things out or running short-lived dev/test instances without committing to a full month.
- **AWS**: Similar to DigitalOcean (usage-based); requires your own AMI and EC2 setup.

**Recommendation:** Use **DigitalOcean** (`MANAGED_CLOUD_PROVIDER=digitalocean`) for development and testing so you can spin up and tear down servers without paying for unused time. Use **Hostinger** for production if you prefer their 1-click Docker API and fixed monthly plans.

---

## DigitalOcean (usage-based)

### Requirements

- **Token**: Create at [DigitalOcean API Tokens](https://cloud.digitalocean.com/account/api/tokens). Needs **Read + Write** for Droplets.
- **SSH bootstrap**: DigitalOcean has no “deploy Docker project” API like Hostinger. The control plane uses **SSH + bootstrap script** to install and run OpenClaw (same as AWS). So you need `MANAGED_BOOTSTRAP_SSH_PRIVATE_KEY` and a key that’s injected into the droplet (via `MANAGED_DO_SSH_KEY_IDS` or a key in your image/user_data).

### Convex env vars

```bash
# Use DigitalOcean as the managed cloud provider
bunx convex env set MANAGED_CLOUD_PROVIDER digitalocean

# Required: API token (create at https://cloud.digitalocean.com/account/api/tokens)
bunx convex env set MANAGED_DO_TOKEN "<your-token>"
# Or use DIGITALOCEAN_TOKEN if you prefer.

# Optional: defaults below
# MANAGED_DO_SIZE=s-1vcpu-1gb
# MANAGED_DO_IMAGE=ubuntu-22-04-x64
# MANAGED_DO_DEFAULT_REGION=nyc3
# MANAGED_DO_SSH_KEY_IDS=12345,67890   # DO SSH key IDs for root login
# MANAGED_DO_USER_DATA=...              # Cloud-init script
# MANAGED_DO_DROPLET_NAME_PREFIX=openclaw
# MANAGED_DO_IP_POLL_TIMEOUT_MS=120000
# MANAGED_DO_IP_POLL_INTERVAL_MS=5000
```

### Region

- Set **`MANAGED_DO_REGION`** to fix a single region (e.g. `nyc3`, `sfo3`, `sgp1`).
- Or set **`MANAGED_DO_DEFAULT_REGION`**; the UI “region” is then mapped to DO slugs when they match (e.g. `nyc3`, `sfo3`, `sgp1`, `ams3`, `lon1`, `fra1`, `blr1`). Otherwise the default region is used.

### SSH key (required for bootstrap)

DigitalOcean can inject an SSH key when creating the droplet so the control plane can run the bootstrap script:

1. Add your **public** key in [DigitalOcean → Security → SSH Keys](https://cloud.digitalocean.com/account/security).
2. Copy the key’s **ID** (e.g. from the URL or API).
3. Set **`MANAGED_DO_SSH_KEY_IDS`** to that ID (or comma-separated IDs). The **private** key must be in **`MANAGED_BOOTSTRAP_SSH_PRIVATE_KEY`** in Convex (same as for Hostinger when not using Docker deploy).

### Sizes (examples)

- `s-1vcpu-1gb` – 1 vCPU, 1 GB RAM (cheapest; good for testing).
- `s-1vcpu-2gb` – 1 vCPU, 2 GB RAM.
- `s-2vcpu-2gb` – 2 vCPU, 2 GB RAM.

List sizes: `doctl compute size list` or [DigitalOcean Pricing](https://www.digitalocean.com/pricing/droplets).

### Destroying droplets

To stop billing, **destroy** the droplet (Control Panel, API, or `doctl compute droplet delete <id>`). The app does not auto-destroy; you manage lifecycle yourself or add automation.

---

## Hostinger (monthly upfront)

See **[HOSTINGER_MIGRATION.md](./HOSTINGER_MIGRATION.md)** for:

- API token and catalog item ID
- Optional 1-click Docker deploy (no SSH required when enabled)
- Regions from Hostinger API

---

## Switching provider

1. Set **`MANAGED_CLOUD_PROVIDER`** to `digitalocean` or `hostinger` (or `aws`).
2. Configure the chosen provider’s env vars (see above and HOSTINGER_MIGRATION.md).
3. For DigitalOcean (and AWS), **`MANAGED_BOOTSTRAP_SSH_PRIVATE_KEY`** is required; for Hostinger it’s only required if you are **not** using Docker deploy.

Existing managed instances are unchanged; new provisions use the new provider.
