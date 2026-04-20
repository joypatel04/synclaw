import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Synclaw",
  description: "How Synclaw collects, uses, and protects your personal data.",
};

export default function PrivacyPage() {
  const lastUpdated = "2026-03-23";

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <div className="mx-auto max-w-3xl px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/"
            className="text-xs text-text-muted hover:text-text-primary mb-6 inline-block"
          >
            &larr; Back to Synclaw
          </Link>
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-text-muted">
            Last updated: {lastUpdated}
          </p>
        </div>

        <div className="prose prose-sm prose-invert max-w-none space-y-8 text-text-secondary">
          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">
              1. Who We Are
            </h2>
            <p>
              Synclaw (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;)
              provides a mission-control dashboard for AI agent workspaces. Our
              registered email for privacy matters is{" "}
              <a
                href="mailto:privacy@synclaw.in"
                className="text-text-secondary underline"
              >
                privacy@synclaw.in
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">
              2. Data We Collect
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Account data:</strong> Name, email address, and profile
                image from your GitHub or Google OAuth provider.
              </li>
              <li>
                <strong>Workspace data:</strong> Agents, tasks, documents,
                messages, and activity logs you create within the product.
              </li>
              <li>
                <strong>Configuration data:</strong> OpenClaw gateway URLs and
                encrypted API credentials stored at rest.
              </li>
              <li>
                <strong>Technical data:</strong> IP addresses and HTTP headers
                from webhook ingestion endpoints, retained for 90 days.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">
              3. How We Use Your Data
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide and operate the Synclaw service.</li>
              <li>
                To authenticate you and authorise access to your workspaces.
              </li>
              <li>
                To send transactional emails (invite notifications, setup
                confirmations).
              </li>
              <li>
                We do <strong>not</strong> sell your data to third parties.
              </li>
              <li>
                We do <strong>not</strong> use third-party analytics or ad
                tracking.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">
              4. Data Retention
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Activity logs are retained for 90 days and then purged.</li>
              <li>Webhook payload records are retained for 90 days.</li>
              <li>
                Pending workspace invites expire after 30 days if not accepted.
              </li>
              <li>
                Your account data is retained until you delete your account.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">
              5. Your Rights (GDPR)
            </h2>
            <p>
              If you are located in the European Economic Area, you have the
              following rights:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                <strong>Access (Art. 15):</strong> Request a copy of your
                personal data.
              </li>
              <li>
                <strong>Portability (Art. 20):</strong> Download your data in
                machine-readable JSON format from{" "}
                <Link
                  href="/settings/account"
                  className="text-text-secondary underline"
                >
                  Settings &rarr; Account
                </Link>
                .
              </li>
              <li>
                <strong>Erasure (Art. 17):</strong> Delete your account and
                workspace data from{" "}
                <Link
                  href="/settings/account"
                  className="text-text-secondary underline"
                >
                  Settings &rarr; Account
                </Link>
                .
              </li>
              <li>
                <strong>Rectification (Art. 16):</strong> Update your name or
                email via your OAuth provider (GitHub / Google).
              </li>
              <li>
                <strong>Object / Restrict (Art. 21-22):</strong> Contact us at{" "}
                <a
                  href="mailto:privacy@synclaw.in"
                  className="text-text-secondary underline"
                >
                  privacy@synclaw.in
                </a>
                .
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">
              6. Security
            </h2>
            <p>
              Credentials and gateway tokens are encrypted at rest using
              AES-256-GCM. Access is protected by OAuth 2.0 and role-based
              access controls. We do not store plaintext passwords.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">
              7. Third-Party Services
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Convex:</strong> Our backend database and serverless
                infrastructure provider. Data is processed in their
                infrastructure under their data processing agreement.
              </li>
              <li>
                <strong>GitHub / Google OAuth:</strong> Used for authentication
                only. We receive only the profile scopes you approve.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">
              8. Contact
            </h2>
            <p>
              For privacy requests or questions, email{" "}
              <a
                href="mailto:privacy@synclaw.in"
                className="text-text-secondary underline"
              >
                privacy@synclaw.in
              </a>
              . We aim to respond within 30 days.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
