# Build, release, and tooling

## Owns

- Dev launcher and setup scripts
- Build and packaging configuration (Electron, server bundle)
- CI workflows and formatting rules

## Does not own

- Runtime business logic
- Feature or agent orchestration behavior

## Key files

- init.mjs
- package.json
- scripts/\*\*
- apps/ui/scripts/\*\*
- apps/ui/package.json (electron-builder config)
- docker-compose.yml
- .github/workflows/\*\*

## Invariants

- Dev launcher coordinates ports 3007 (UI) and 3008 (server)
- Shared libs are built before app builds
- Electron build bundles server artifacts via extraResources

## Common mistakes and risks

- Cross-platform process management assumptions in init.mjs
- Packaging paths that miss server assets or .env
- CI changes that diverge from local scripts
