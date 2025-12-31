# Invariants

## Security boundaries

- Enforce auth middleware for protected routes; do not bypass without explicit approval.
- All filesystem access must be validated against allowed roots and path safety checks.
- Terminal access and file write routes must keep validation and auth intact.
- Treat settings and credential files under `DATA_DIR` as sensitive; never log secrets or return them to clients.

## Data integrity

- Project data lives under `{project}/.automaker/`; keep feature files, spec files, and settings consistent.
- Preserve stable IDs for features and worktrees; do not regenerate IDs on update.
- Long-running operations should respect per-module running state and abort controllers to avoid concurrent writes.
- Use existing helpers for reading/writing feature data; avoid ad hoc file formats.

## Logging and PII

- Use shared logger utilities where available; avoid logging tokens, secrets, or full file contents.
- Log user-provided paths and text at minimal detail; prefer debug-level logs for diagnostics.

## Performance constraints

- Keep HTTP handlers async and non-blocking; avoid sync fs and heavy CPU work in request paths.
- Git diff/status can be expensive; scope to needed paths and avoid repeated calls.
- Streaming events should remain responsive; avoid large, synchronous payload processing on the WS path.
