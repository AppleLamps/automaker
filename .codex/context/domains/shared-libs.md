# Shared libraries

## Owns

- Cross-app types and utilities
- Platform-specific path/security helpers
- Prompt and model/dependency resolvers
- Git helpers used by server

## Does not own

- Application-specific UI or server routing
- Persistent storage or network transport

## Key files

- libs/types/\*\*
- libs/platform/\*\*
- libs/utils/\*\*
- libs/prompts/\*\*
- libs/model-resolver/\*\*
- libs/dependency-resolver/\*\*
- libs/git-utils/\*\*

## Invariants

- libs/types is a leaf package with no internal dependencies
- libs/platform depends only on libs/types
- libs/utils depends on libs/platform and libs/types
- libs/git-utils depends on libs/utils and libs/types
- Packages are built with tsc and published as dist/

## Common mistakes and risks

- Adding Node-only dependencies to libs used in the UI
- Breaking public APIs consumed across apps
- Forgetting to update build outputs or package exports
