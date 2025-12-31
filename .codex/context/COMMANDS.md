# Commands

## Setup

- Install deps (root `package.json`): `npm install`
- Build shared packages (root `package.json`): `npm run build:packages`

## Run

- Interactive dev launcher (root `package.json`): `npm run dev`
- UI dev (root `package.json`): `npm run dev:web`
- Electron dev (root `package.json`): `npm run dev:electron`
- Server dev (root `package.json`): `npm run dev:server`
- Full dev (root `package.json`): `npm run dev:full`

## Build

- UI build (root `package.json`): `npm run build`
- Server build (root `package.json`): `npm run build:server`
- Electron build (root `package.json`): `npm run build:electron`

## Lint

- UI lint (root `package.json`): `npm run lint`
- Server lint (apps/server `package.json`): `npm run lint --workspace=apps/server`

## Format

- Format all (root `package.json`): `npm run format`
- Check formatting (root `package.json`): `npm run format:check`

## Tests

- UI e2e (root `package.json`): `npm run test`
- UI unit (apps/ui `package.json`): `npm run test:unit --workspace=apps/ui`
- Server tests (root `package.json`): `npm run test:server`
- Shared packages (root `package.json`): `npm run test:packages`
- All (root `package.json`): `npm run test:all`

## Typecheck

- Server typecheck uses `npm run build --workspace=apps/server` (tsc)
- UI typecheck runs as part of Vite build: `npm run build --workspace=apps/ui`
