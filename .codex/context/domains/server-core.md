# Server core (API, auth, events)

## Owns

- Express app boot, middleware, and route registration
- Authentication gates for API routes
- Event emitter and WebSocket fan-out
- Health and monitoring endpoints

## Does not own

- UI rendering or Electron IPC
- Git worktree logic or agent decision making (delegated to services)

## Key files

- apps/server/src/index.ts
- apps/server/src/lib/auth.ts
- apps/server/src/lib/events.ts
- apps/server/src/middleware/validate-paths.ts
- apps/server/src/routes/\*\*/index.ts

## Invariants

- /api/health is unauthenticated; all other /api routes are behind authMiddleware
- initAllowedPaths() runs before serving requests
- WebSocket upgrades are handled for /api/events and /api/terminal/ws only
- JSON body size limit is 50mb

## Common mistakes and risks

- Adding new routes without auth or path validation
- Emitting events with inconsistent type/payload shapes
- Introducing new WS endpoints without upgrade routing
