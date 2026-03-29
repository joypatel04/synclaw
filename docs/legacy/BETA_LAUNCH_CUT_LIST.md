# Synclaw Beta Launch Cut List (Founder Mode)

## Goal

Ship a **public BYO beta** fast, while keeping managed flow as **private/concierge beta** until reliability is strong.

Primary metric for beta:
- Time to first successful agent run from signup (target: under 15 minutes for BYO users)

Secondary metrics:
- Onboarding completion rate
- Week-1 retained workspaces
- Number of manual support interventions per workspace

## Product Positioning For Beta

- Public beta offer: "Bring your own OpenClaw (WSS) and get instant team workflow control."
- Managed offer: "Apply for managed setup (concierge beta)." No promise of instant one-click in public.
- Keep single-domain routing architecture in code, but do not make growth depend on automated managed provisioning yet.

## Scope Lock (What ships in beta)

### P0 (Must ship before beta launch)

1. BYO flow is the default, frictionless path.
2. Existing BYO users are never forced into managed onboarding.
3. Managed-only validations never block BYO completion.
4. Agent setup is simplified:
   - Hide low-level file complexity by default.
   - Auto-wire fs-bridge if available; show advanced controls only behind flag.
5. Landing page is replaced with one strong design direction (no theme confusion on marketing page).
6. Errors are human-readable and actionable in onboarding/settings.

### P1 (Can ship in week 2, not launch blocker)

1. Managed private beta intake flow and admin review queue.
2. Better managed telemetry dashboards (runtime create/start/apply/provider verify).
3. "One-click managed" re-enabled for a small allowlist only.

### P2 (Explicitly deferred)

1. Full zero-touch multi-cloud automation for all users.
2. Complex region/profile controls in public onboarding.
3. Advanced egress policy system.
4. Autoscaling sophistication beyond simple host capacity thresholds.

## Hard Cuts (Stop doing now)

1. Stop adding new managed automation branches for public path.
2. Stop exposing infra controls in public onboarding.
3. Stop polishing low-impact infra edge cases before BYO activation improves.

## Concrete Engineering Worklist

## Track A - Onboarding and Gating

Files to update first:
- `/Users/joypatel/sutraha-hq/components/onboarding/OnboardingWizard.tsx`
- `/Users/joypatel/sutraha-hq/lib/onboardingGate.ts`
- `/Users/joypatel/sutraha-hq/convex/onboarding.ts`
- `/Users/joypatel/sutraha-hq/convex/managedProvisioning.ts`
- `/Users/joypatel/sutraha-hq/app/settings/openclaw/page.tsx`

Tasks:
1. Make BYO/manual mode default selection.
2. In production mode, hide managed region/server profile selectors.
3. Change managed CTA to:
   - "Join managed beta" (public)
   - "Launch managed OpenClaw" (internal flag only)
4. Ensure `verifyManagedConnection` or managed provider apply errors do not surface in BYO settings path.
5. Ensure reconnect/verify for BYO checks only ws/auth health and skips managed-specific statuses.

Acceptance:
- A user with working external WSS can complete onboarding without any managed/provider runtime steps.

## Track B - Agent Setup Friction Reduction

Files to update:
- `/Users/joypatel/sutraha-hq/app/agents/[id]/setup/page.tsx`
- `/Users/joypatel/sutraha-hq/convex/agentSetup.ts`
- `/Users/joypatel/sutraha-hq/convex/openclaw_files.ts`
- `/Users/joypatel/sutraha-hq/app/filesystem/page.tsx`

Tasks:
1. Add "Simple setup" mode as default:
   - generate required starter files automatically.
   - hide advanced file edit list under "Advanced setup."
2. If fs-bridge is configured/healthy, auto-apply starter files silently and show concise success.
3. If fs-bridge missing, show one direct action:
   - "Enable file bridge" with exact next step.

Acceptance:
- New agent reaches runnable state without forcing user through large file checklist UI.

## Track C - Landing Page (Design + Messaging)

Files to update:
- `/Users/joypatel/sutraha-hq/app/page.tsx`
- `/Users/joypatel/sutraha-hq/app/layout.tsx` (if marketing-only route split is needed)
- `/Users/joypatel/sutraha-hq/components/theme-toggle.tsx` (do not show on marketing page)

Decision for beta:
- Use one fixed visual direction for marketing page (no theme toggle).
- Product app can keep theme support internally.

Recommended style direction:
- "Apple-clean structure + AI operations edge"
- Traits:
  - large calm typography
  - high whitespace, soft gradients, glass panels used sparingly
  - one accent color family only
  - meaningful motion (hero reveal + workflow line animation)
  - crisp product screenshots and trust indicators

Acceptance:
- Landing clearly communicates:
  - what Synclaw is
  - who it is for
  - one primary CTA
  - BYO beta status + managed beta waitlist

## Track D - Managed Beta Safety Rails

Files to update:
- `/Users/joypatel/sutraha-hq/lib/features.ts`
- `/Users/joypatel/sutraha-hq/lib/edition.ts`
- `/Users/joypatel/sutraha-hq/convex/lib/edition.ts`

Tasks:
1. Add explicit public flag behavior:
   - public: BYO enabled, managed concierge only
   - internal: managed automation controls visible
2. Keep container-pool work behind runtime flag and allowlist.
3. Add clear fallback:
   - if managed automation fails, user can continue on BYO.

Acceptance:
- Managed failures do not kill public beta experience.

## Launch Sequence (14 days)

### Days 1-3
1. Finish Track A (gating cleanup).
2. Fix top 5 onboarding errors by impact/frequency.

### Days 4-6
1. Finish Track B (simple agent setup default).
2. Validate fresh workspace flow end-to-end on production-like env.

### Days 7-10
1. Ship new landing page (Track C).
2. Add managed beta waitlist CTA and copy.

### Days 11-14
1. Dogfood with 5-10 real users.
2. Freeze features; fix only launch blockers.
3. Public beta launch.

## Launch Checklist (Go/No-Go)

1. BYO onboarding completion >= 70% in test cohort.
2. Median time-to-first-agent-run <= 15 minutes.
3. No managed-only error blocking BYO path.
4. Landing + docs + onboarding copy are consistent.
5. Support playbook ready for first 20 users.

## Success/Failure Triggers

If success:
1. Start expanding managed private beta with allowlist.
2. Prioritize automation based on real failure telemetry.

If failure:
1. Pause managed roadmap for one sprint.
2. Double down on BYO activation and agent setup UX.

