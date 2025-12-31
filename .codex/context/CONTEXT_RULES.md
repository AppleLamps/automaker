# Context Rules

## Context selection algorithm

1. Global orientation: read `README.md`, `.codex/context/REPO_MAP.md`, and relevant docs.
2. Local module: read the target module folder (routes, services, components, or shared libs).
3. Direct dependencies: read imports and shared package entrypoints used by the module.
4. Tests and call sites: read the closest tests and key call sites that drive behavior.
5. If comments conflict with tests or call sites, trust tests and call sites.

## Minimum context set by change type

### Bugfix

- The failing code path and its immediate callers.
- Related types in `libs/types`.
- Closest tests under `apps/**/tests` or `libs/**/tests`.

### Refactor (no behavior change)

- All files being refactored plus direct callers.
- Public entrypoints in `libs/*/src/index.ts` if shared packages are touched.
- Tests that cover the refactored code.

### New endpoint or route behavior

- `apps/server/src/routes/**` module (handler + common + business logic).
- `apps/server/src/services/**` used by the route.
- Client usage in `apps/ui/src/lib/http-api-client.ts` and related views.
- Types in `libs/types`.

### Schema or contract change

- `libs/types/src/**`.
- Server route handlers and services that read/write the schema.
- UI consumers and tests that serialize/deserialize the schema.

## Confidence gating

- If you have not read the module entrypoint or the tests that assert behavior, stop and request more context.
- If a change crosses app boundaries (UI <-> server or server <-> shared libs), stop and confirm expected contract.
- If storage format changes are unclear, stop and request examples of existing data files.
- Every proposed change should include a confidence statement plus an invalidation checklist.

## Negative rules

- Do not edit generated or runtime data: `**/.automaker/**`, `data/**`, `**/dist/**`, `node_modules/**`.
- Do not extend legacy paths marked in `.codex/context/FILE_ROLES.yml`.
- Do not add new shared utilities in app code when a shared package exists.
- Avoid large refactors unless explicitly requested.

## Invalidation checklist template

- Contract files: `libs/types/src/...`
- Entry points: `apps/server/src/index.ts`, `apps/ui/src/main.ts`
- Route handlers/services touched: `apps/server/src/routes/...`, `apps/server/src/services/...`
- UI usage: `apps/ui/src/lib/http-api-client.ts`, `apps/ui/src/components/...`
- Tests: `apps/**/tests/...`, `libs/**/tests/...`

## Verification rules

- UI-only changes: `npm run lint --workspace=apps/ui` and relevant UI tests.
- Server-only changes: `npm run lint --workspace=apps/server` and relevant server tests.
- Shared libs: `npm run build:packages` plus `npm run test:packages`.
- Contract changes: run both server and UI test tiers that read the contract.
- Identify relevant tests before editing; run them after changes or state why not.
