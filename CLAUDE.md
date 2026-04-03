# Synclaw HQ — CLAUDE.md

## Project Overview

**Synclaw HQ** is a Next.js + Convex full-stack dashboard for managing an OpenClaw-powered AI agent workspace. It serves as mission control for AI agents with multi-tenant support, billing, provisioning, and real-time orchestration.

- **Codename**: Synclaw
- **Stack**: Next.js 16 (App Router) + Convex + React 19 + Tailwind CSS 4 + Shadcn/ui
- **Package Manager**: Bun
- **Linter/Formatter**: Biome 2.2.0

---

## Dev Commands

```bash
bun install           # Install dependencies
bunx convex dev       # Start Convex backend
bun run dev           # Start Next.js dev server (port 3000)
bun run build         # Production build
bun run lint          # Biome check
bun run format        # Biome format --write
```

---

## Edition System

The project ships two editions controlled by env vars:

| Env Var | Values |
|---|---|
| `SYNCLAW_EDITION` | `commercial` or `core` (server-side) |
| `NEXT_PUBLIC_SYNCLAW_EDITION` | `commercial` or `core` (client-side) |

- **Core (OSS)**: Manual/BYO OpenClaw, basic features
- **Commercial**: Managed provisioning, assisted launch, billing (Razorpay), managed gateway automation

Edition capability gates live in:
- `lib/edition.ts` — client-side capability checks
- `convex/lib/edition.ts` — server-side capability checks

Commercial capabilities: `managedProvisioning`, `assistedLaunch`, `billing`, `prioritySupport`, `managedGatewayAutomation`

---

## Project Structure

```
/app                     # Next.js App Router pages
  /agents                # Agent management
  /chat                  # WebSocket chat with OpenClaw
  /settings              # Workspace settings
    /openclaw            # Gateway configuration
    /billing             # Razorpay billing
    /api-keys            # API key management
    /members             # Member management
    /webhooks            # Webhook CRUD
  /tasks                 # Task list view
  /broadcasts            # Broadcast center
  /documents             # Document library
  /filesystem            # File browser
  /onboarding            # Setup wizard
  /help                  # Help pages
  /page.tsx              # Main 3-column dashboard

/convex                  # Convex backend (queries, mutations, actions)
  schema.ts              # 23-table database schema
  auth.ts / auth.config.ts  # GitHub + Google OAuth
  agents.ts              # Agent CRUD & telemetry
  tasks.ts               # Task lifecycle
  documents.ts           # Document management
  broadcasts.ts          # Broadcast messaging
  messages.ts            # Task comments & @mentions
  activities.ts          # Audit log & event stream
  webhooks.ts            # Webhook CRUD
  webhooks_internal.ts   # Webhook payload processing
  openclaw.ts            # OpenClaw gateway config (729 lines)
  openclaw_files.ts      # File bridge integration
  apiKeys.ts             # API key management
  apiKeys_internal.ts    # Internal API auth / JWT exchange
  modelKeys.ts           # LLM provider key storage
  billing_razorpay.ts    # Billing queries & subscriptions
  billing_razorpay_internal.ts  # Razorpay webhook handling
  agentSetup.ts          # Agent setup flows (982 lines)
  managedProvisioning.ts # Cloud provisioning orchestration (2554 lines)
  provisioning.ts        # OpenClaw provisioning queue
  onboarding.ts          # Workspace onboarding status
  notifications.ts       # Agent notification queue
  support.ts             # Support features
  http.ts                # HTTP endpoints: JWT exchange, Razorpay webhook
  workspaces.ts          # Workspace CRUD & membership
  /lib
    permissions.ts       # RBAC helpers
    billing.ts           # Billing models & feature gates
    secretCrypto.ts      # AES-GCM encryption
    webhooks.ts          # Webhook utilities
    edition.ts           # Edition checks (server)
    apiAuth.ts           # API key hashing & validation

/components              # React UI components
  /ui                    # Shadcn/Radix primitives
  /dashboard             # KanbanBoard, AgentPanel, LiveFeed, TaskCard
  /chat                  # ChatInterface (50KB), ChatMessage, ChatInput, etc.
  /layout                # AppLayout, Header, BillingBanner
  /settings              # Settings page components
  /openclaw              # OpenClaw config UI
  /providers             # convex-provider, theme-provider
  /onboarding            # Setup wizard components
  /broadcast             # Broadcast UI
  /filesystem            # File browser components
  /shared                # Reusable utilities

/lib                     # Client-side utilities
  brand.ts               # Branding/marketing copy config
  analytics.ts           # Umami analytics
  edition.ts             # Client-side edition checks
  features.ts            # Feature flag utilities
  openclaw-gateway-client.ts  # WebSocket OpenClaw client (1800+ lines)
  openclaw/device-auth-v3.ts  # Device pairing flow (crypto)
  openclawSetupMethods.ts     # Setup method selection
  agentRecipes.ts         # Agent template recipes
  agentManifest.ts        # Agent capability manifests
  playbooks.ts            # Operational playbooks
  onboardingTemplates.ts  # Setup templates
  taskSpawnPrompt.ts      # Task generation prompts
  synclawProtocol.ts      # Synclaw protocol spec
  managedServerProfiles.ts    # Server tier definitions
  managedRegions.ts       # Geographic regions
  utils.ts                # Common utilities

/packages                # Monorepo packages
  /mcp-server            # MCP server (@synclaw/mcp-server npm package)
  /core                  # Core edition package
  /commercial            # Commercial edition package
  /managed-gateway       # Managed gateway orchestration
  /host-agent            # Container agent for managed deployments
  /fs-bridge             # File system bridge

/config
  brand.default.json     # Default branding config
```

---

## Database Schema (23 Convex Tables)

### Auth
- `users` — User profiles (email, name, image)
- `authSessions` — OAuth sessions

### Workspace
- `workspaces` — Workspace metadata, plan, billing status
- `workspaceMembers` — Membership with roles: `owner` > `admin` > `member` > `viewer`
- `workspaceInvites` — Pending email invitations
- `workspaceApiKeys` — SHA-256 hashed server-to-server API keys
- `workspaceModelProviderKeys` — AES-GCM encrypted LLM provider keys

### Core Features
- `agents` — AI agents (status, telemetry, sessionKey, heartbeat)
- `tasks` — Kanban tasks (inbox → assigned → in_progress → review → done | blocked)
- `documents` — Knowledge base (types: deliverable/research/protocol/note/journal; status: draft/final/archived)
- `folders` — Document organization
- `messages` — Task comments with @mentions
- `broadcasts` — Multi-agent notifications
- `activities` — Audit log (7-day UI retention)
- `activitySeenByAgent` — Agent activity acknowledgment tracking
- `notifications` — Agent notification queue

### OpenClaw Integration
- `openclawGatewayConfigs` — Per-workspace WSS URL, auth tokens (encrypted)
- `openclawProvisioningJobs` — Infrastructure provisioning state machine
- `provisioning` — Provisioning queue

### Billing & Webhooks
- `workspaceWebhooks` — Webhook endpoints (secret, event filters, action templates)
- `webhookPayloads` — Webhook event log (max 1 MB, 100 req/min rate limit)
- `razorpayEvents` — Billing webhook events

---

## RBAC (Role-Based Access Control)

Roles (highest to lowest): `owner` (4) → `admin` (3) → `member` (2) → `viewer` (1)

| Role | Permissions |
|---|---|
| owner | Everything + delete workspace, transfer ownership |
| admin | Delete tasks, manage agents, invite/remove members |
| member | Create/update tasks, comment, chat, create broadcasts |
| viewer | Read-only |

Key helpers in `convex/lib/permissions.ts`:
- `requireAuth()` — verify logged in
- `requireMember()` — verify workspace membership
- `requireRole()` — verify minimum role level

---

## Authentication

- **Provider**: Convex Auth with GitHub OAuth + Google OAuth
- **No** custom password auth
- **No** server-side middleware auth (Next.js middleware is intentionally minimal; auth is client-side)
- `convex/auth.ts` + `convex/auth.config.ts`

**API Key Auth** (`convex/apiKeys_internal.ts`):
- SHA-256 hashed keys in `workspaceApiKeys`
- `POST /api/v1/auth/token` (header: `Authorization: Bearer <api-key>`) → JWT valid 1 hour
- Scoped to roles: admin/member/viewer

---

## HTTP Endpoints (`convex/http.ts`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v1/auth/token` | POST | JWT exchange for API key auth |
| `/api/v1/billing/razorpay/webhook` | POST | Razorpay billing events (HMAC validated) |

---

## Key Patterns & Conventions

### Agent Session Keys
- Every agent has a `sessionKey` (e.g., `agent:main:main`)
- Used as stable identity instead of database IDs
- Enables reliable cross-deploy agent references

### Encryption
- AES-GCM encryption for secrets at rest (OpenClaw tokens, provider keys, file bridge tokens)
- Key: `OPENCLAW_TOKEN_ENCRYPTION_KEY_HEX` env var (32 bytes hex)
- Implementation: `convex/lib/secretCrypto.ts`

### Activity Feed Filtering
- `agent_status` and `webhook_event` activity types are filtered out of UI feeds to reduce noise
- Full retention in database; 7-day window for UI

### Edition Gating
- Use `canUseCapability()` from `lib/edition.ts` (client) or `convex/lib/edition.ts` (server)
- Never hardcode edition-specific logic; always go through capability checks

### Telemetry Object (Agents)
- Agents report: `currentModel`, `openclawVersion`, `totalTokensUsed`, `lastRunDurationMs`, `lastRunCost`
- Updated via `agentPulse()` mutation

### Workspace Folder Paths
- Default derived from agent name: "My Agent" → `workspace-my-agent`
- Overridable via `setWorkspaceFolderPath()` mutation

---

## OpenClaw Gateway Integration

- WebSocket client: `lib/openclaw-gateway-client.ts` (1800+ lines)
- Connection modes: `direct_ws`, `connector`, `self_hosted_local`
- Auth: Device Auth v3 (`lib/openclaw/device-auth-v3.ts`) — cryptographic pairing + challenge-response
- Protocol: JSON-RPC over WebSocket
- Client mode negotiation: `webchat` or `operator`
- Config stored encrypted in `openclawGatewayConfigs` table

---

## Managed Provisioning

- File: `convex/managedProvisioning.ts` (2554 lines — largest file in the project)
- Cloud providers: Hostinger, DigitalOcean, AWS
- Server profiles (in `lib/managedServerProfiles.ts`): `starter`, `standard`, `performance`
- Bootstrap steps: `infra → host → openclaw → runtime → gateway → health check`
- Setup status: `not_started → infra_ready → openclaw_ready → agents_ready → verified`
- Control plane: `MANAGED_CONTROL_PLANE_BASE_URL` env var

---

## Billing (Razorpay)

- Plans: Free / Starter / Pro
- Currencies: INR, USD
- Trial: 14 days; Grace period: 7 days
- Feature gates: `api_keys` (Starter+), `more_than_three_agents` (Starter+), `priority_support` (Pro)
- Lifecycle: `trialing → active → past_due → canceled → incomplete`
- Checkout + portal flows in `convex/billing_razorpay.ts`

---

## Webhooks

- Create with event filters + action templates (`create_task`, `create_document`, `log_activity`, `task_and_nudge_main`)
- HMAC-SHA256 secret validation
- Rate limit: 100 req/min per webhook
- Payload max size: 1 MB
- History + reprocessing support

---

## MCP Server (`/packages/mcp-server`)

- Published: `@synclaw/mcp-server@0.1.2`
- Exposes 30+ tools for AI agent integration via Model Context Protocol
- Key tools: `synclaw_list_agents`, `synclaw_create_agent`, `synclaw_agent_heartbeat`, `synclaw_agent_pulse`, `synclaw_start_task_session`, `synclaw_end_task_session`, `synclaw_create_task`, `synclaw_create_document`, etc.

---

## External Integrations

| Service | Purpose |
|---|---|
| Razorpay | Billing & subscriptions |
| GitHub OAuth | Authentication |
| Google OAuth | Authentication |
| Umami | Analytics (website ID: `f7ff4521-6a76-4885-9932-44c7802db117`) |
| OpenClaw Gateway | AI agent WebSocket orchestration |
| Hostinger / DigitalOcean / AWS | Managed cloud provisioning |

---

## Environment Variables Reference

```bash
# Convex
NEXT_PUBLIC_CONVEX_URL=
NEXT_PUBLIC_CONVEX_SITE_URL=
CONVEX_DEPLOYMENT=

# Auth
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# Encryption (required)
OPENCLAW_TOKEN_ENCRYPTION_KEY_HEX=   # 32-byte hex string

# Billing (Razorpay)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
RAZORPAY_PLAN_STARTER_MONTHLY_INR=
RAZORPAY_PLAN_PRO_MONTHLY_INR=

# Edition
SYNCLAW_EDITION=commercial|core
NEXT_PUBLIC_SYNCLAW_EDITION=commercial|core

# Feature Flags (optional)
SYNCLAW_MANAGED_BETA_ENABLED=false
SYNCLAW_ASSISTED_LAUNCH_ENABLED=false
NEXT_PUBLIC_MANAGED_BETA_ENABLED=false
NEXT_PUBLIC_ASSISTED_LAUNCH_BETA_ENABLED=false
NEXT_PUBLIC_BILLING_ENABLED=false
NEXT_PUBLIC_WEBHOOKS_ENABLED=true
NEXT_PUBLIC_OPENCLAW_FILES_ENABLED=false
NEXT_PUBLIC_AGENT_SETUP_ADVANCED_ENABLED=false

# Managed Provisioning (cloud providers)
MANAGED_CLOUD_PROVIDER=digitalocean|hostinger|aws
MANAGED_DO_TOKEN=
MANAGED_HOSTINGER_API_TOKEN=
MANAGED_DEFAULT_SERVER_PROFILE=starter
MANAGED_CONTROL_PLANE_BASE_URL=https://synclaw.in/control

# Analytics
NEXT_PUBLIC_UMAMI_WEBSITE_ID=
```

---

## Known Notes

- **No automated tests** — no Jest/Vitest configured; no test files exist
- **React Compiler** is enabled in `next.config.ts` (automatic memoization)
- **Middleware** (`middleware.ts`) is intentionally minimal — auth is purely client-side
- **Compound DB indexes** on `(workspaceId, status)`, `(workspaceId, agentId)` etc. for query performance
- **Provider key validation** is basic (length >= 16 chars only, no API call validation)
- `managedProvisioning.ts` at 2554 lines is the largest and most complex file — use caution
