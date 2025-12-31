# Agent orchestration and planning

## Owns

- AgentService lifecycle and session management
- Auto-mode execution, planning, and approval flow
- Pipeline and backlog plan generation
- Provider integration (Claude) and prompt templates

## Does not own

- UI rendering and client state
- Low-level filesystem or git operations (delegated to other domains)

## Key files

- apps/server/src/services/agent-service.ts
- apps/server/src/services/auto-mode-service.ts
- apps/server/src/services/pipeline-service.ts
- apps/server/src/routes/agent/\*\*
- apps/server/src/routes/auto-mode/\*\*
- apps/server/src/routes/backlog-plan/\*\*
- apps/server/src/routes/app-spec/\*\*
- apps/server/src/providers/\*\*
- libs/prompts/\*\*
- libs/model-resolver/\*\*
- libs/dependency-resolver/\*\*

## Invariants

- Agent execution is provider-based (ProviderFactory); Claude is the current provider
- Plan approval gates are enforced in auto-mode/pipeline flows
- Agent output and progress are emitted through the shared event stream
- Types and prompt templates must stay aligned with agent expectations

## Common mistakes and risks

- Breaking state transitions (run, pause, resume, verify)
- Mismatching prompt formats with server parsers
- Failing to emit events expected by the UI
- Ignoring sandbox/path validation when selecting working directories
