import {
  PublicDocsCallout,
  PublicDocsCard,
  PublicDocsCodeBlock,
  PublicDocsShell,
} from "@/app/docs/_components/PublicDocsShell";

export default function HostingEnvironmentReferencePage() {
  return (
    <PublicDocsShell
      title="Environment Variable Reference"
      description="Current env variables for OSS Public WSS mode and self-hosted deployment."
      iconName="Settings2"
    >
      <PublicDocsCard title="Core Convex variables">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <code className="rounded bg-bg-primary px-1 py-0.5">
              NEXT_PUBLIC_CONVEX_URL
            </code>
            : client URL used by frontend to connect to Convex.
          </li>
          <li>
            <code className="rounded bg-bg-primary px-1 py-0.5">
              NEXT_PUBLIC_CONVEX_SITE_URL
            </code>
            : Convex site URL used by auth callback flow.
          </li>
          <li>
            <code className="rounded bg-bg-primary px-1 py-0.5">
              CONVEX_DEPLOYMENT
            </code>
            : deployment key mapping app to correct Convex environment.
          </li>
        </ul>
      </PublicDocsCard>

      <PublicDocsCard title="Auth variables">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <code className="rounded bg-bg-primary px-1 py-0.5">
              AUTH_GITHUB_ID
            </code>
            : GitHub OAuth client id.
          </li>
          <li>
            <code className="rounded bg-bg-primary px-1 py-0.5">
              AUTH_GITHUB_SECRET
            </code>
            : GitHub OAuth client secret.
          </li>
          <li>
            <code className="rounded bg-bg-primary px-1 py-0.5">
              AUTH_GOOGLE_ID
            </code>
            : Google OAuth client id.
          </li>
          <li>
            <code className="rounded bg-bg-primary px-1 py-0.5">
              AUTH_GOOGLE_SECRET
            </code>
            : Google OAuth client secret.
          </li>
        </ul>
      </PublicDocsCard>

      <PublicDocsCard title="Edition and feature flags">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <code className="rounded bg-bg-primary px-1 py-0.5">
              SYNCLAW_EDITION
            </code>{" "}
            and{" "}
            <code className="rounded bg-bg-primary px-1 py-0.5">
              NEXT_PUBLIC_SYNCLAW_EDITION
            </code>
            : set to{" "}
            <code className="rounded bg-bg-primary px-1 py-0.5">core</code> for
            OSS/public mode.
          </li>
          <li>
            <code className="rounded bg-bg-primary px-1 py-0.5">
              SYNCLAW_MANAGED_BETA_ENABLED
            </code>{" "}
            and{" "}
            <code className="rounded bg-bg-primary px-1 py-0.5">
              NEXT_PUBLIC_MANAGED_BETA_ENABLED
            </code>
            : keep{" "}
            <code className="rounded bg-bg-primary px-1 py-0.5">false</code> for
            OSS public WSS launch.
          </li>
          <li>
            <code className="rounded bg-bg-primary px-1 py-0.5">
              SYNCLAW_ASSISTED_LAUNCH_ENABLED
            </code>{" "}
            and{" "}
            <code className="rounded bg-bg-primary px-1 py-0.5">
              NEXT_PUBLIC_ASSISTED_LAUNCH_BETA_ENABLED
            </code>
            : internal/testing only.
          </li>
          <li>
            <code className="rounded bg-bg-primary px-1 py-0.5">
              NEXT_PUBLIC_OPENCLAW_FILES_ENABLED
            </code>
            : enables remote filesystem bridge UI.
          </li>
          <li>
            <code className="rounded bg-bg-primary px-1 py-0.5">
              NEXT_PUBLIC_AGENT_SETUP_ADVANCED_ENABLED
            </code>
            : controls advanced setup UI exposure.
          </li>
        </ul>
      </PublicDocsCard>

      <PublicDocsCard title="OpenClaw token encryption key (Convex env)">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <code className="rounded bg-bg-primary px-1 py-0.5">
              OPENCLAW_TOKEN_ENCRYPTION_KEY_HEX
            </code>
            : hex key used for encrypting gateway tokens at rest.
          </li>
        </ul>
        <div className="mt-4">
          <PublicDocsCodeBlock
            title="Generate and set key"
            code={`openssl rand -hex 32
bunx convex env set OPENCLAW_TOKEN_ENCRYPTION_KEY_HEX <generated-hex-value>`}
          />
        </div>
      </PublicDocsCard>

      <PublicDocsCard title="Recommended OSS Public WSS profile">
        <PublicDocsCodeBlock
          code={`SYNCLAW_EDITION=core
NEXT_PUBLIC_SYNCLAW_EDITION=core
SYNCLAW_MANAGED_BETA_ENABLED=false
SYNCLAW_ASSISTED_LAUNCH_ENABLED=false
NEXT_PUBLIC_MANAGED_BETA_ENABLED=false
NEXT_PUBLIC_ASSISTED_LAUNCH_BETA_ENABLED=false
NEXT_PUBLIC_OPENCLAW_FILES_ENABLED=true
NEXT_PUBLIC_AGENT_SETUP_ADVANCED_ENABLED=false`}
        />
        <div className="mt-4">
          <PublicDocsCallout title="Current launch profile">
            Keep assisted-launch flags disabled in OSS Public WSS mode.
          </PublicDocsCallout>
        </div>
      </PublicDocsCard>
    </PublicDocsShell>
  );
}
