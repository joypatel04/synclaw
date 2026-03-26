# Documentation Index

This repository contains two documentation layers:

## 1) Public product docs (canonical for users)

- Source: `app/docs/**`
- Runtime route: `/docs`
- Scope: current OSS/Public WSS + self-hosted setup guidance

If you are updating user-facing setup docs, update `app/docs/**` first.

## 2) Repository reference docs (internal/history)

- Source: `docs/**` markdown files
- Scope: architecture notes, migration experiments, internal decisions, legacy managed/commercial runbooks

Some files in `docs/**` are historical and may describe older flows. Treat them as reference material unless they are linked from the current `/docs` navigation.

## Current direction

- Public launch path: **Public WSS + BYO OpenClaw**
- Managed/commercial flows: maintained separately from OSS launch docs
