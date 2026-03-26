# Public WSS Setup (Current OSS Path)

Use this path when you want the fastest onboarding and least infrastructure work.

## Recommended for

- Solo operators testing workflow quickly.
- Small teams that want BYO OpenClaw with minimal setup.
- Early beta customers evaluating product fit.

## Setup checklist

1. Sign in and create/select a workspace.
2. Complete onboarding owner steps.
3. Open `Settings -> OpenClaw` and save a valid gateway URL + token.
4. In onboarding, create your first agent with one-click setup.
5. Open chat and run one real task.

## Validation checklist

- OpenClaw connection test succeeds.
- Agent creation completes without manual file editing.
- Chat responds and activity appears in dashboard surfaces.
- Task/document updates persist in Convex.

## Recommended first-run task

Ask the new agent to complete a deterministic task (for example: summarize a fixed input and output a markdown checklist) so you can verify repeatability.

## Operational notes

- Keep production and development workspaces separate.
- Rotate OpenClaw tokens periodically.
- Keep the OpenClaw origin allowlist aligned with your app domains.
