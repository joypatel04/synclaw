# FAQ

## Is self-hosted intentionally hard?

No. It is a real infrastructure path, so it includes operational tasks by design (auth, runtime, and deployment ownership).

## Which option should non-technical users choose?

Cloud. It minimizes setup and support burden.

## Can users start in Cloud and move later?

Yes. Keep workspace behavior consistent so migration paths stay straightforward.

## Why does OpenClaw connection fail with "origin not allowed"?

OpenClaw gateway policy does not allow your Synclaw domain yet. Add the exact app origin to `gateway.controlUi.allowedOrigins` and restart gateway service.

## Is one-click agent setup fully automatic?

Yes for normal user flow. Setup files are generated and written automatically. If setup fails, creation is rolled back instead of leaving a partially configured agent.

## Can users still edit files manually?

Yes. Use `/filesystem` to inspect and edit agent files after creation (when Files Bridge is enabled and configured).
