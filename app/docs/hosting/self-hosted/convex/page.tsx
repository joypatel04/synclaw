import {
  PublicDocsCallout,
  PublicDocsCard,
  PublicDocsCodeBlock,
  PublicDocsShell,
} from "@/app/docs/_components/PublicDocsShell";

export default function HostingSelfHostedConvexPage() {
  return (
    <PublicDocsShell
      title="Self-hosted: Configure Convex"
      description="Set up Convex deployments, auth, and local runtime for this project."
      iconName="Server"
    >
      <PublicDocsCard title="1) Create and link Convex project">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Create a Convex project from dashboard (dev deployment first).
          </li>
          <li>
            Copy deployment values into{" "}
            <code className="rounded bg-bg-primary px-1 py-0.5">
              .env.local
            </code>
            .
          </li>
          <li>Run local sync and wait until functions are ready.</li>
        </ol>
        <div className="mt-4 space-y-3">
          <PublicDocsCodeBlock
            title="Initial project bootstrap"
            code={`bun install
cp .env.local.example .env.local
bunx convex dev`}
          />
          <PublicDocsCodeBlock
            title="Required baseline env vars"
            code={`NEXT_PUBLIC_CONVEX_URL=https://<project>.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://<project>.convex.site
CONVEX_DEPLOYMENT=<deployment-key>
AUTH_GITHUB_ID=<github-client-id>
AUTH_GITHUB_SECRET=<github-client-secret>
AUTH_GOOGLE_ID=<google-client-id>
AUTH_GOOGLE_SECRET=<google-client-secret>`}
          />
        </div>
      </PublicDocsCard>

      <PublicDocsCard title="2) Configure auth provider">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Create/update GitHub and Google OAuth apps and set callback URLs to
            Convex auth routes.
          </li>
          <li>
            Ensure local callback and production callback are both configured
            where required.
          </li>
          <li>
            Set OAuth client id/secret in both local env and production
            deployment secrets.
          </li>
          <li>
            Verify callback returns to app domain and session persists after
            refresh.
          </li>
        </ol>
        <div className="mt-4">
          <PublicDocsCodeBlock
            title="Callback pattern to verify"
            code={`https://<your-convex-site>.convex.site/api/auth/callback/github
https://<your-convex-site>.convex.site/api/auth/callback/google`}
          />
        </div>
      </PublicDocsCard>

      <PublicDocsCard title="3) Start local stack">
        <div className="space-y-3">
          <PublicDocsCodeBlock title="Terminal A" code={`bunx convex dev`} />
          <PublicDocsCodeBlock title="Terminal B" code={`bun run dev`} />
          <PublicDocsCodeBlock
            title="After env changes"
            code={`# restart both processes so runtime picks up new values
pkill -f "convex dev" || true
pkill -f "next dev" || true
bunx convex dev
bun run dev`}
          />
        </div>
      </PublicDocsCard>

      <PublicDocsCard title="4) Verify backend health">
        <ul className="list-disc space-y-2 pl-5">
          <li>Workspace loads after login.</li>
          <li>Tasks/documents mutations persist correctly.</li>
          <li>Role checks and protected routes behave as expected.</li>
          <li>No Convex auth route mismatch errors in logs.</li>
        </ul>
        <div className="mt-4">
          <PublicDocsCodeBlock
            title="Production readiness checks"
            code={`- Login/logout cycle works on production domain
- Workspace create/switch flow works
- Mutations write successfully
- OpenClaw settings can be saved and re-read
- No 401/404 auth callback errors in production logs`}
          />
        </div>
      </PublicDocsCard>

      <PublicDocsCard title="5) Production deployment detail">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Set all required env vars in your hosting platform and Convex
            production env.
          </li>
          <li>Deploy app and Convex functions from the same commit SHA.</li>
          <li>Run smoke tests immediately after deploy.</li>
          <li>Keep rollback-ready previous deployment for fast recovery.</li>
        </ol>
        <div className="mt-4">
          <PublicDocsCallout title="Important">
            Version skew between app code and Convex function schema is a common
            source of runtime bugs. Deploy them together.
          </PublicDocsCallout>
        </div>
      </PublicDocsCard>
    </PublicDocsShell>
  );
}
