# Synclaw Documentation Overview

Synclaw is a workspace control plane for OpenClaw-based agent operations.

## What Synclaw does today

- Connects one workspace to one OpenClaw gateway configuration.
- Supports one-click agent creation with automatic setup file generation.
- Tracks tasks, documents, broadcasts, and activity in Convex.
- Streams chat directly from OpenClaw through WebSocket.
- Optionally enables remote file editing through the Files Bridge.

## Deployment choices

### Cloud (recommended for beta users)

Use Cloud when you want fast activation and minimal infrastructure work.

### Self-hosted

Use self-hosted when you need infrastructure ownership and can maintain:

- Convex project + environment variables
- OAuth providers
- OpenClaw gateway availability and policy
- Optional Files Bridge runtime

## Canonical user flow

1. Complete onboarding.
2. Configure OpenClaw connection for the workspace.
3. Create an agent with one-click setup.
4. Continue work in chat.

## Documentation map

- Cloud runbook: `docs/product/CLOUD_GET_STARTED.md`
- Self-hosted runbook: `docs/product/SELF_HOSTED_GUIDE.md`
- Pricing positioning: `docs/product/PRICING.md`
- FAQ: `docs/product/FAQ.md`
