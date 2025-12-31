# UI and Electron

## Owns

- React UI, routes, views, and state management
- Electron main and preload processes
- HTTP/WebSocket client for server API
- UI theming and Playwright E2E tests

## Does not own

- Server-side business logic or agent execution
- Git and filesystem operations beyond UI requests

## Key files

- apps/ui/src/main.ts
- apps/ui/src/preload.ts
- apps/ui/src/renderer.tsx
- apps/ui/src/app.tsx
- apps/ui/src/utils/router.ts
- apps/ui/src/routes/\*\*
- apps/ui/src/components/\*\*
- apps/ui/src/store/\*\*
- apps/ui/src/lib/http-api-client.ts
- apps/ui/playwright.config.ts
- apps/ui/tests/\*\*

## Invariants

- Preload exposes a minimal window.electronAPI; most operations go through HTTP API
- Router uses memory history in Electron and browser history in web mode
- Event stream is consumed from /api/events WebSocket
- E2E tests expect UI on port 3007 and server on port 3008

## Common mistakes and risks

- Assuming Electron APIs are available in web mode
- Changing IPC contracts without updating preload and UI callers
- Breaking TanStack Router generation or routeTree usage
- Diverging event type names from server-emitted events
