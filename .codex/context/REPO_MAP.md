# Repo Map

## Architecture

- apps/ui: React + Vite + Electron renderer application.
- apps/server: Express HTTP API plus WebSocket server.
- libs/types: shared TypeScript contracts.
- libs/utils: logging, error handling, fs helpers, prompt utilities, image helpers.
- libs/prompts: prompt templates for text enhancement.
- libs/platform: path security, allowed roots, subprocess helpers.
- libs/model-resolver: model alias resolution.
- libs/dependency-resolver: feature dependency ordering.
- libs/git-utils: git status, diff, and worktree helpers.
- docs: architecture and conventions.

## Key entrypoints

- apps/server/src/index.ts (server bootstrap, routes, WS)
- apps/ui/src/main.ts (app boot)
- apps/ui/src/renderer.tsx (root React render)
- apps/ui/src/preload.ts (electron bridge)
- apps/ui/index.html (Vite entry)
- apps/ui/vite.config.mts (build config)
- libs/\*/src/index.ts (public APIs)

## Data flow and storage

- UI calls server HTTP routes for features, settings, workspace, and worktrees.
- UI subscribes to server WebSocket events and terminal sessions.
- Server reads/writes project data in `{project}/.automaker/` (features, spec, context, settings).
- Server reads/writes global data in `DATA_DIR` (settings, credentials, sessions).
- Worktrees are created under the project for isolated feature execution.

## Major dependencies

- apps/ui depends on libs/types and libs/dependency-resolver.
- apps/server depends on libs/types, libs/utils, libs/prompts, libs/platform, libs/model-resolver, libs/dependency-resolver, libs/git-utils.
- libs/_ should not depend on apps/_.

## Change coupling: if you change X, also check Y

- Feature schema or shared types -> update libs/types, server routes/services, UI consumers, and tests.
- Server route payloads -> update UI API client and any related tests.
- Worktree behavior -> update libs/git-utils, server worktree routes, UI worktree panel, and git tests.
- Prompt templates -> update libs/prompts and server usage.
- Path security or allowed roots -> update libs/platform, server fs routes, and tests.
- Board view or feature lifecycle -> update UI view hooks plus server auto-mode or pipeline services.
