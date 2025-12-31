# Automaker Frontend Code Review

**Review Date**: December 28, 2025
**Reviewer**: Claude (AI Code Review)
**Scope**: `apps/ui/src/` - React-based web UI frontend

---

## 1. Executive Summary

The Automaker frontend is a well-architected React 19 application demonstrating strong adherence to modern patterns and best practices. The codebase shows thoughtful consideration for security (particularly Electron IPC boundaries), performance (React memoization, Zustand shallow selectors), and maintainability (modular component structure).

### Overall Assessment: **Good** (7.5/10)

**Strengths:**

- Excellent Electron security model with minimal preload exposure
- Well-organized component architecture with clear separation of concerns
- Comprehensive TypeScript typing throughout
- Good test infrastructure with Playwright E2E tests
- Effective use of Zustand for state management with persistence
- Terminal error boundary implementation prevents crashes

**Areas for Improvement:**

- Missing global error boundary for React error handling
- HTTP API client lacks comprehensive error handling and request cancellation
- Inconsistent accessibility (ARIA) implementation across components
- WebSocket reconnection lacks exponential backoff in HTTP client
- Some large components could benefit from further decomposition

---

## 2. Critical Issues

### 2.1 Missing Global Error Boundary

**File Path**: `apps/ui/src/routes/__root.tsx`
**Category**: Code Quality / UX
**Priority**: Critical

**Description**: The application lacks a top-level error boundary to catch and gracefully handle React rendering errors. While `TerminalErrorBoundary` exists for the terminal component, a global boundary would prevent the entire app from crashing on unexpected errors.

**Impact**: Any uncaught React error will crash the entire application, showing a white screen or React's default error overlay.

**Recommendation**: Add a global error boundary wrapping the main layout:

```tsx
// apps/ui/src/components/error-boundary.tsx
import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[GlobalErrorBoundary] Application error:', error, errorInfo);
    // Consider adding telemetry here
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-background p-8">
          <AlertCircle className="w-16 h-16 text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-muted-foreground mb-4 max-w-md text-center">
            An unexpected error occurred. Please reload the application.
          </p>
          <Button onClick={this.handleReload}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reload Application
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

---

### 2.2 HTTP API Client Missing Response Status Validation

**File Path**: `apps/ui/src/lib/http-api-client.ts:166-178`
**Category**: Security / Code Quality
**Priority**: Critical

**Description**: The HTTP client methods (`post`, `get`, `put`, `httpDelete`) directly call `response.json()` without checking `response.ok` or the status code. This means non-2xx responses (4xx, 5xx) are silently parsed as JSON, potentially masking server errors.

**Impact**:

- Authentication failures (401) may not be properly detected
- Server errors (500) are not distinguished from successful responses
- Network-level errors may cause JSON parse failures

**Current Code**:

```typescript
private async post<T>(endpoint: string, body?: unknown): Promise<T> {
  const response = await fetch(`${this.serverUrl}${endpoint}`, {
    method: 'POST',
    headers: this.getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  return response.json(); // No status check!
}
```

**Recommendation**:

```typescript
private async post<T>(endpoint: string, body?: unknown): Promise<T> {
  const response = await fetch(`${this.serverUrl}${endpoint}`, {
    method: 'POST',
    headers: this.getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new ApiError(
      `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      errorBody
    );
  }

  return response.json();
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

---

### 2.3 WebSocket Missing Authentication in HTTP Client

**File Path**: `apps/ui/src/lib/http-api-client.ts:82-100`
**Category**: Security
**Priority**: Critical

**Description**: The WebSocket connection in `HttpApiClient` does not include authentication tokens, unlike the terminal WebSocket which properly passes `authToken` via query parameter.

**Impact**: In web mode with API key authentication enabled, the events WebSocket may fail authentication or expose unauthenticated event streaming.

**Recommendation**: Include API key in WebSocket connection:

```typescript
private connectWebSocket(): void {
  // ...existing guards...
  const apiKey = getApiKey();
  let wsUrl = this.serverUrl.replace(/^http/, 'ws') + '/api/events';
  if (apiKey) {
    wsUrl += `?apiKey=${encodeURIComponent(apiKey)}`;
  }
  this.ws = new WebSocket(wsUrl);
  // ...rest of implementation...
}
```

---

## 3. High Priority Issues

### 3.1 Zustand Store Size and Complexity

**File Path**: `apps/ui/src/store/app-store.ts`
**Category**: Code Quality / Maintainability
**Priority**: High

**Description**: The app store is nearly 3,000 lines with 100+ state properties and actions. This monolithic store makes it difficult to:

- Understand state dependencies
- Test individual slices
- Prevent unnecessary re-renders
- Maintain and extend

**Impact**: Developer productivity, potential performance issues from over-subscription.

**Recommendation**: Split into domain-specific slices using Zustand's slice pattern:

```typescript
// stores/project-store.ts
export const createProjectSlice = (set, get) => ({
  projects: [],
  currentProject: null,
  addProject: (project) => set((state) => ({ projects: [...state.projects, project] })),
  // ...
});

// stores/feature-store.ts
export const createFeatureSlice = (set, get) => ({
  features: [],
  loadFeatures: async () => {
    /* ... */
  },
  // ...
});

// stores/index.ts
export const useAppStore = create(
  persist(
    (...args) => ({
      ...createProjectSlice(...args),
      ...createFeatureSlice(...args),
      ...createUISlice(...args),
      ...createTerminalSlice(...args),
    }),
    { name: 'automaker-storage' }
  )
);
```

---

### 3.2 Missing Request Cancellation (AbortController)

**File Path**: `apps/ui/src/lib/http-api-client.ts`
**Category**: Performance / UX
**Priority**: High

**Description**: HTTP requests don't use `AbortController` for cancellation. When users navigate away or components unmount, pending requests continue, potentially causing:

- Memory leaks from stale closures
- State updates on unmounted components
- Wasted bandwidth

**Recommendation**: Add abort signal support:

```typescript
class HttpApiClient {
  private abortControllers = new Map<string, AbortController>();

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    requestId?: string
  ): Promise<T> {
    // Cancel previous request with same ID
    if (requestId && this.abortControllers.has(requestId)) {
      this.abortControllers.get(requestId)!.abort();
    }

    const controller = new AbortController();
    if (requestId) {
      this.abortControllers.set(requestId, controller);
    }

    try {
      const response = await fetch(`${this.serverUrl}${endpoint}`, {
        method,
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      // ...handle response
    } finally {
      if (requestId) {
        this.abortControllers.delete(requestId);
      }
    }
  }

  cancelRequest(requestId: string): void {
    this.abortControllers.get(requestId)?.abort();
    this.abortControllers.delete(requestId);
  }
}
```

---

### 3.3 Inconsistent Accessibility Implementation

**File Path**: Multiple components
**Category**: Accessibility
**Priority**: High

**Description**: Accessibility implementation is inconsistent across the codebase:

**Good Examples:**

- `kanban-card.tsx`: Uses `role="article"`, `aria-label`, `aria-describedby`
- `keyboard-shortcuts.ts`: Properly checks for input focus before triggering shortcuts
- Dialog components use Radix UI with built-in accessibility

**Missing/Incomplete:**

- `kanban-column.tsx`: Missing `role="region"` or `aria-label` for column identification
- `graph-view/`: Canvas-based visualization lacks screen reader alternatives
- `terminal-view.tsx`: Complex tab interface could benefit from `aria-selected`, `aria-controls`

**Recommendation**:

1. Add ARIA landmarks to major layout sections
2. Implement skip links for keyboard navigation
3. Add screen reader announcements for dynamic content (toast notifications already use Sonner which handles this)
4. Consider adding `aria-live` regions for auto-mode status updates

---

### 3.4 WebSocket Reconnection Strategy

**File Path**: `apps/ui/src/lib/http-api-client.ts:102-120`
**Category**: Reliability
**Priority**: High

**Description**: The WebSocket reconnection uses a fixed 3-second delay without exponential backoff. This can cause:

- Server overload during outages (thundering herd)
- Unnecessary reconnection attempts
- Poor UX during extended outages

**Current Code**:

```typescript
this.ws.onclose = () => {
  this.ws = null;
  if (this.reconnectAttempts < this.maxReconnectAttempts) {
    this.reconnectAttempts++;
    setTimeout(() => this.connectWebSocket(), 3000); // Fixed delay
  }
};
```

**Recommendation**: Implement exponential backoff with jitter:

```typescript
private getReconnectDelay(): number {
  const baseDelay = 1000;
  const maxDelay = 30000;
  const exponentialDelay = Math.min(
    baseDelay * Math.pow(2, this.reconnectAttempts),
    maxDelay
  );
  // Add jitter (±25%)
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  return exponentialDelay + jitter;
}

this.ws.onclose = () => {
  this.ws = null;
  if (this.reconnectAttempts < this.maxReconnectAttempts) {
    const delay = this.getReconnectDelay();
    this.reconnectAttempts++;
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => this.connectWebSocket(), delay);
  }
};
```

---

## 4. Medium Priority Issues

### 4.1 Large Component Files

**File Paths**:

- `apps/ui/src/components/views/terminal-view.tsx` (~1,700 lines)
- `apps/ui/src/components/views/board-view.tsx` (~1,100 lines)
- `apps/ui/src/store/app-store.ts` (~2,900 lines)

**Category**: Maintainability
**Priority**: Medium

**Description**: Several component files exceed recommended size limits, making them difficult to navigate, test, and maintain.

**Recommendation**:

- `terminal-view.tsx`: Already has good sub-component extraction (`terminal-panel.tsx`, `terminal-error-boundary.tsx`). Consider extracting:
  - Tab management logic into a custom hook
  - Drag-and-drop logic into a separate hook
  - Layout rendering into a dedicated component

- `board-view.tsx`: Good progress with `board-view/` subdirectory. Consider:
  - Moving dialog state management to a dedicated hook
  - Extracting auto-mode integration logic

---

### 4.2 Potential Memory Leak in Event Subscriptions

**File Path**: `apps/ui/src/components/views/board-view/hooks/use-board-features.ts`
**Category**: Performance
**Priority**: Medium

**Description**: Event subscriptions in `useEffect` hooks properly return cleanup functions, but the pattern could be more robust with explicit cleanup tracking.

**Current Pattern** (Good):

```typescript
useEffect(() => {
  const unsubscribe = api.features.onEvent((event) => {
    /* ... */
  });
  return unsubscribe;
}, [loadFeatures, currentProject]);
```

**Potential Issue**: If `loadFeatures` or `currentProject` changes rapidly, multiple subscriptions could briefly coexist.

**Recommendation**: Consider using a ref to track subscription state:

```typescript
const subscriptionRef = useRef<(() => void) | null>(null);

useEffect(() => {
  // Cleanup any existing subscription first
  subscriptionRef.current?.();

  const unsubscribe = api.features.onEvent((event) => {
    /* ... */
  });
  subscriptionRef.current = unsubscribe;

  return () => {
    subscriptionRef.current?.();
    subscriptionRef.current = null;
  };
}, [loadFeatures, currentProject]);
```

---

### 4.3 Hardcoded Server URL Fallback

**File Path**: `apps/ui/src/lib/http-api-client.ts:35-37`
**Category**: Configuration
**Priority**: Medium

**Description**: The server URL has a hardcoded fallback to `http://localhost:3008`:

```typescript
const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3008';
```

**Impact**: In production builds without proper environment configuration, the app will attempt to connect to localhost, which will fail silently.

**Recommendation**:

1. Make the environment variable required in production builds
2. Add validation at startup:

```typescript
const serverUrl = import.meta.env.VITE_SERVER_URL;
if (!serverUrl && import.meta.env.PROD) {
  console.error('[HttpApiClient] VITE_SERVER_URL is required in production');
  throw new Error('Server URL not configured');
}
```

---

### 4.4 Missing Loading States in Some Views

**File Path**: Various view components
**Category**: UX
**Priority**: Medium

**Description**: While `LoadingState` and `ErrorState` components exist and are used in some views (e.g., `github-issues-view.tsx`), not all views consistently implement loading states.

**Good Examples**:

- `github-issues-view.tsx`: Uses `LoadingState` component
- `github-prs-view.tsx`: Has inline loading state

**Recommendation**: Audit all views and ensure consistent loading/error state handling using the existing `LoadingState` and `ErrorState` components from `@/components/ui/`.

---

## 5. Low Priority Issues

### 5.1 Console Logging in Production

**File Paths**: Multiple files
**Category**: Code Quality
**Priority**: Low

**Description**: Extensive `console.log` and `console.error` statements throughout the codebase. While useful for debugging, these should be conditionally disabled or use a proper logging abstraction in production.

**Examples**:

```typescript
// http-api-client.ts
console.log('[HttpApiClient] Connecting to server:', serverUrl);

// use-board-features.ts
console.log(`[Terminal] Session ${content.sessionId} is invalid...`);
```

**Recommendation**:

1. Use the existing `createLogger` from `@automaker/utils` for structured logging
2. Configure log levels based on environment
3. Consider removing or reducing verbose logs in production builds

---

### 5.2 Unused Imports and Dead Code

**File Path**: Various
**Category**: Code Quality
**Priority**: Low

**Description**: Some files contain unused imports or commented-out code. ESLint should catch most of these, but a cleanup pass would be beneficial.

**Recommendation**: Run `npm run lint -- --fix` and review any remaining warnings.

---

### 5.3 Inconsistent Error Message Formatting

**File Path**: Various
**Category**: UX
**Priority**: Low

**Description**: Error messages shown to users vary in format and detail level:

- Some show technical details (stack traces)
- Some are user-friendly
- Some use toast notifications, others inline

**Recommendation**: Create a centralized error formatting utility:

```typescript
// lib/error-formatter.ts
export function formatUserError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.userMessage || 'An unexpected error occurred';
  }
  if (error instanceof Error) {
    // Strip technical details for user display
    return error.message.split('\n')[0];
  }
  return 'An unexpected error occurred';
}
```

---

## 6. Security Considerations

### 6.1 Electron Security Model (Excellent)

**File Path**: `apps/ui/electron/preload.ts`
**Assessment**: ✅ Well Implemented

The Electron preload script follows security best practices:

- Uses `contextBridge.exposeInMainWorld` for safe IPC
- Minimal API surface exposed to renderer
- No direct Node.js access in renderer
- Proper input validation on IPC calls

### 6.2 API Key Storage

**File Path**: `apps/ui/src/store/app-store.ts`
**Assessment**: ⚠️ Acceptable with Caveats

API keys are stored in Zustand's persisted state (localStorage). While this is standard for web apps, consider:

- Keys are visible in browser DevTools
- No encryption at rest
- Electron apps could use `safeStorage` for encrypted storage

**Recommendation for Electron**: Consider using Electron's `safeStorage` API for sensitive credentials.

### 6.3 XSS Prevention

**Assessment**: ✅ Good

React's JSX escaping provides default XSS protection. The codebase doesn't use `dangerouslySetInnerHTML` inappropriately. Markdown rendering (if any) should use a sanitizing library.

---

## 7. Performance Considerations

### 7.1 React Memoization (Good)

The codebase makes appropriate use of:

- `memo()` for expensive components (e.g., `KanbanColumn`, `KanbanCard`)
- `useCallback` for event handlers passed to children
- `useMemo` for computed values

### 7.2 Zustand Selector Optimization (Good)

Proper use of shallow selectors to prevent unnecessary re-renders:

```typescript
const { features, loadFeatures } = useAppStore(
  useShallow((state) => ({
    features: state.features,
    loadFeatures: state.loadFeatures,
  }))
);
```

### 7.3 Bundle Size Considerations

**Recommendation**: Consider implementing:

- Route-based code splitting (TanStack Router supports this)
- Lazy loading for heavy components (terminal, graph view)
- Tree-shaking audit for large dependencies

---

## 8. Testing Assessment

### 8.1 E2E Test Infrastructure (Good)

**File Path**: `apps/ui/tests/`

The Playwright E2E test suite is well-organized:

- Modular test utilities in `tests/utils/`
- Clear test file naming conventions
- Good coverage of critical user flows

### 8.2 Missing Unit Tests

**Observation**: The frontend lacks unit tests for:

- Custom hooks
- Utility functions
- Store actions

**Recommendation**: Add Vitest unit tests for:

- `apps/ui/src/hooks/` - Custom hooks
- `apps/ui/src/lib/` - Utility functions
- `apps/ui/src/store/` - Store actions (can test in isolation)

---

## 9. Code Style and Consistency

### 9.1 TypeScript Usage (Excellent)

- Strict TypeScript configuration
- Comprehensive type definitions
- Proper use of generics
- Minimal use of `any` (mostly in persistence layer where necessary)

### 9.2 Component Patterns (Good)

Consistent patterns observed:

- Functional components with hooks
- Props interfaces defined inline or in separate types
- Proper use of `forwardRef` where needed
- Consistent file naming (kebab-case)

### 9.3 Import Organization (Good)

Imports follow a consistent pattern:

1. React/external libraries
2. Internal components
3. Hooks
4. Utilities
5. Types

---

## 10. Recommendations Summary

### Immediate Actions (Critical)

1. Add global error boundary
2. Add HTTP response status validation
3. Add WebSocket authentication in HTTP client

### Short-term (High Priority)

1. Implement request cancellation with AbortController
2. Add exponential backoff to WebSocket reconnection
3. Audit and improve accessibility

### Medium-term

1. Split Zustand store into slices
2. Add unit tests for hooks and utilities
3. Implement consistent loading/error states

### Long-term

1. Consider route-based code splitting
2. Implement structured logging
3. Add performance monitoring

---

## 11. Positive Highlights

The codebase demonstrates several excellent practices worth maintaining:

1. **Modular Architecture**: Clear separation between views, components, hooks, and utilities
2. **Type Safety**: Comprehensive TypeScript usage with minimal escape hatches
3. **Security-First Electron**: Minimal preload exposure, proper IPC patterns
4. **Error Recovery**: Terminal error boundary prevents crashes
5. **State Management**: Zustand with persistence and migrations
6. **Testing Infrastructure**: Well-organized E2E test utilities
7. **Keyboard Accessibility**: Comprehensive keyboard shortcut system
8. **Theme Support**: Proper dark/light mode implementation

---

<!-- End of Code Review -->
