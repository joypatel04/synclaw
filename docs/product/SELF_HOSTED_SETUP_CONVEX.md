# Self-hosted Setup: Convex

## 1) Create project and env

1. Create a Convex project.
2. Configure deployment environments (dev/prod).
3. Set required environment variables.

## 2) Configure local app env

1. Copy `.env.local.example` to `.env.local`.
2. Fill Convex deployment values.
3. Add auth OAuth client credentials.

## 3) Run local stack

In terminal A:

```bash
bunx convex dev
```

In terminal B:

```bash
bun run dev
```

## 4) Verify baseline

- Login works.
- Workspace loads.
- Tasks and activity operations persist.

## 5) Production deployment

Deploy Convex functions and app using your standard CI/CD flow.

