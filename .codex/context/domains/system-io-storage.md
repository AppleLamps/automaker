# System IO and storage

## Owns

- File-based storage for project and global data
- Context files and images for agent use
- Secure filesystem access and path validation
- Terminal session lifecycle and streaming

## Does not own

- Agent orchestration logic (auto-mode/pipeline)
- Git worktree operations

## Key files

- apps/server/src/routes/fs/\*\*
- apps/server/src/routes/context/\*\*
- apps/server/src/routes/settings/\*\*
- apps/server/src/routes/workspace/\*\*
- apps/server/src/routes/terminal/\*\*
- apps/server/src/services/terminal-service.ts
- apps/server/src/lib/secure-fs.ts
- apps/server/src/lib/settings-helpers.ts
- libs/platform/src/secure-fs.ts
- libs/platform/src/security.ts
- libs/platform/src/paths.ts

## Invariants

- File operations must validate paths against ALLOWED_ROOT_DIRECTORY via secureFs
- DATA_DIR is always allowed even when ALLOWED_ROOT_DIRECTORY is set
- Project data lives under {projectPath}/.automaker/ (features, context, spec)
- Terminal WS requires valid sessionId and optional auth token

## Common mistakes and risks

- Path traversal or unvalidated user-supplied paths
- Writing outside allowed roots or bypassing secureFs
- Terminal session leaks, unbounded output, or unsafe input handling
- Large file reads/writes without size checks
