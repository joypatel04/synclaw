import { Cloud } from "lucide-react";
import {
  PublicDocsCallout,
  PublicDocsCard,
  PublicDocsCodeBlock,
  PublicDocsShell,
} from "@/app/docs/_components/PublicDocsShell";

export default function HostingCloudPage() {
  return (
    <PublicDocsShell
      title="Public WSS Hosting"
      description="Rapid onboarding path for OSS launch with BYO OpenClaw over secure WSS."
      icon={Cloud}
    >
      <PublicDocsCard title="Prerequisites">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            A stable app domain for production and a staging domain for
            validation.
          </li>
          <li>
            Authentication provider configured for the exact domain and callback
            URL.
          </li>
          <li>Workspace onboarding flow tested end to end.</li>
          <li>
            OpenClaw gateway URL/token/scopes decided for each workspace type.
          </li>
        </ul>
      </PublicDocsCard>

      <PublicDocsCard title="Detailed setup steps">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Create a fresh workspace and complete the onboarding wizard as
            owner.
          </li>
          <li>
            Open{" "}
            <code className="rounded bg-bg-primary px-1 py-0.5">
              Settings -&gt; OpenClaw
            </code>
            , set gateway URL, auth token, and scopes.
          </li>
          <li>
            Create one agent from recipe and one manually to test both paths.
          </li>
          <li>
            Create a task, move it across stages, and validate activity emission
            at each transition.
          </li>
          <li>
            Invite one member and one viewer, then validate permissions and UI
            restrictions.
          </li>
          <li>
            Re-login on a second browser profile to verify session continuity
            and workspace persistence.
          </li>
        </ol>
        <div className="mt-4 space-y-3">
          <PublicDocsCodeBlock
            title="Acceptance checks"
            code={`- Login redirect returns to app root
- Workspace switcher state persists after refresh
- Agent panel shows expected status updates
- Live feed receives task/document events
- Unauthorized actions are blocked by role`}
          />
        </div>
      </PublicDocsCard>

      <PublicDocsCard title="Operational verification checklist">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            OAuth callback is deterministic (no unexpected provider-host landing
            page).
          </li>
          <li>
            Onboarding lock only applies where intended and does not block
            public pages.
          </li>
          <li>
            OpenClaw settings are saved per workspace and survive restarts.
          </li>
          <li>
            Agent setup workflow generates expected heartbeat and protocol
            artifacts.
          </li>
          <li>API key and role-based controls are enforced server-side.</li>
        </ul>
      </PublicDocsCard>

      <PublicDocsCard title="Go-live notes">
        <ul className="list-disc space-y-2 pl-5">
          <li>Ship Public WSS onboarding and core workflow first.</li>
          <li>
            Keep OpenClaw origin allowlist aligned with your app domains before
            opening signups.
          </li>
          <li>
            Verify reconnect and scope checks for each workspace before launch.
          </li>
          <li>
            Publish support boundaries clearly: response windows, channels, and
            paid escalation options.
          </li>
        </ul>
        <div className="mt-4">
          <PublicDocsCallout title="Recommended launch policy">
            Start with a small private cohort, monitor for 72 hours, then open
            public signups.
          </PublicDocsCallout>
        </div>
      </PublicDocsCard>
    </PublicDocsShell>
  );
}
