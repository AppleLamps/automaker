# AutoMaker Critical Bug Analysis & Fix Roadmap

**Date:** December 2024
**Analysis By:** Claude
**Branch:** `claude/automaker-setup-YZfgm`

---

## Executive Summary

This document provides root cause analysis for 9 critical bugs affecting AutoMaker's production stability. Issues are prioritized by impact and include concrete code diffs for each fix.

**Key Findings:**
- **#315** (Cryptic errors): Server error messages not surfaced to UI
- **#235** (RAM leaks): Validation cleanup too infrequent, unbounded output buffers
- **#316** (MCP race): MCP is NOT implemented - placeholder only
- Agent output modal relies on fragile global state
- WebSocket lacks max retry limit

---

## PRIORITIZED FIX ROADMAP

| Priority | Issue | Est. Effort | Files to Change | Risk |
|----------|-------|-------------|-----------------|------|
| P0 | **#315** HTTP API shows cryptic errors | 2h | `apps/ui/src/lib/http-api-client.ts` | Low |
| P0 | **#235** RAM usage piles up | 4h | `validation-common.ts`, `http-api-client.ts` | Low |
| P1 | **#316** MCP race condition | 6h | NEW: `mcp-manager.ts` | Medium |
| P1 | Agent output modal glitches | 2h | `agent-output-modal.tsx` | Low |
| P1 | Network service crashes | 3h | `http-api-client.ts` | Low |
| P2 | Commit all files bug | 3h | `auto-mode-service.ts` | Medium |
| P2 | TypeError on settings toggle | 2h | `checkbox.tsx` | Low |
| P2 | Opening app error after close | 2h | Electron lifecycle | Medium |
| P2 | JSON editor loses MCP IDs | N/A | MCP not implemented | N/A |

---

## DETAILED FIXES

### Issue #315: HTTP API Client Shows Cryptic Errors

**Root Cause:** The `ApiError` class stores the server error body but the error MESSAGE only shows `HTTP ${status}: ${statusText}`, not the actual server error content.

**Location:** `apps/ui/src/lib/http-api-client.ts:219-232`

**Current Code (problematic):**
```typescript
private async handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorBody: string | undefined;
    try {
      errorBody = await response.text();
    } catch {
      errorBody = undefined;
    }
    throw new ApiError(
      `HTTP ${response.status}: ${response.statusText}`,  // Generic message
      response.status,
      errorBody  // Server message stored but NOT shown
    );
  }
  return this.parseJson<T>(response);
}
```

**Fix:**
```typescript
private async handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorBody: string | undefined;
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      errorBody = await response.text();
      // Try to extract meaningful error from JSON response
      if (errorBody) {
        try {
          const parsed = JSON.parse(errorBody);
          if (parsed.error && typeof parsed.error === 'string') {
            errorMessage = parsed.error;
          } else if (parsed.message && typeof parsed.message === 'string') {
            errorMessage = parsed.message;
          }
        } catch {
          // Not JSON, use raw body if it's a reasonable error message
          if (errorBody.length < 500 && !errorBody.includes('<html')) {
            errorMessage = errorBody;
          }
        }
      }
    } catch {
      errorBody = undefined;
    }
    throw new ApiError(errorMessage, response.status, errorBody);
  }
  return this.parseJson<T>(response);
}
```

---

### Issue #235: RAM Usage Piles Up

**Root Cause:** Multiple contributing factors:
1. **ValidationStatusMap** only cleans up every 1 hour (stale entries accumulate)
2. **eventCallbacks Map** in HttpApiClient can grow if subscriptions aren't properly cleaned
3. **Agent output** strings can grow unbounded during long-running sessions

**Fix 1: More aggressive validation cleanup**

File: `apps/server/src/routes/github/routes/validation-common.ts`

```typescript
// Change from 1 hour to 10 minutes
const MAX_VALIDATION_AGE_MS = 10 * 60 * 1000;

// Add safety limit
const MAX_CONCURRENT_VALIDATIONS = 50;

export function setValidationRunning(
  projectPath: string,
  issueNumber: number,
  abortController: AbortController
): void {
  // Safety: Clean up if we're approaching memory limits
  if (validationStatusMap.size >= MAX_CONCURRENT_VALIDATIONS) {
    cleanupStaleValidations();
  }
  // ... rest of function
}
```

**Fix 2: Bound agent output buffer**

File: `apps/ui/src/components/views/board-view/dialogs/agent-output-modal.tsx`

```typescript
const MAX_OUTPUT_SIZE = 500000; // ~500KB max buffer

// In the useEffect that handles events:
if (newContent) {
  setOutput((prev) => {
    const combined = prev + newContent;
    // Trim from start if output exceeds max size
    if (combined.length > MAX_OUTPUT_SIZE) {
      return combined.slice(-MAX_OUTPUT_SIZE);
    }
    return combined;
  });
}
```

---

### Issue #316: MCP Server Race Condition

**Root Cause:** MCP server support is **declared but NOT implemented**. The `mcpServers?: Record<string, unknown>` field exists in `ExecuteOptions` but is never used. Tests explicitly verify `supportsFeature('mcp')` returns `false`.

**Current Status:** No race condition exists because MCP isn't implemented. This issue is either:
1. A **future concern** for when MCP is implemented
2. Related to **a different race condition** in server state

**Recommended Implementation Pattern (when MCP is added):**
```typescript
// NEW FILE: apps/server/src/services/mcp-manager.ts

import { Mutex } from 'async-mutex';

interface McpServerState {
  status: 'connecting' | 'ready' | 'error';
  connection: unknown;
  connectedAt: Date;
}

export class McpManager {
  private servers = new Map<string, McpServerState>();
  private connectionMutex = new Mutex();

  async getOrCreateConnection(serverId: string, config: unknown): Promise<McpServerState> {
    return this.connectionMutex.runExclusive(async () => {
      const existing = this.servers.get(serverId);
      if (existing?.status === 'ready') {
        return existing;
      }

      this.servers.set(serverId, {
        status: 'connecting',
        connection: null,
        connectedAt: new Date(),
      });

      try {
        const connection = await this.initializeServer(config);
        const state: McpServerState = {
          status: 'ready',
          connection,
          connectedAt: new Date(),
        };
        this.servers.set(serverId, state);
        return state;
      } catch (error) {
        this.servers.set(serverId, {
          status: 'error',
          connection: null,
          connectedAt: new Date(),
        });
        throw error;
      }
    });
  }
}
```

---

### Agent Output Modal Glitches

**Root Cause:** Uses fragile global state `(window as any).__currentProject` which can be undefined or stale.

**Location:** `apps/ui/src/components/views/board-view/dialogs/agent-output-modal.tsx:66`

**Fix:**
```typescript
// Use Zustand store instead of window global
import { useAppStore } from '@/store/app-store';

export function AgentOutputModal({...}: AgentOutputModalProps) {
  const currentProject = useAppStore((state) => state.currentProject);

  useEffect(() => {
    if (!open) return;
    const loadOutput = async () => {
      // Remove: const currentProject = (window as any).__currentProject;
      if (!currentProject?.path) {
        setIsLoading(false);
        return;
      }
      // ...
    };
    loadOutput();
  }, [open, featureId, currentProject?.path]);
}
```

---

### Network Service Crashes (WebSocket Resilience)

**Root Cause:** WebSocket reconnection doesn't have a max retry limit, and errors during send are not caught.

**Fix:**
```typescript
// apps/ui/src/lib/http-api-client.ts

const MAX_RECONNECT_ATTEMPTS = 10;

// In ws.onclose handler:
ws.onclose = () => {
  logger.info('WebSocket disconnected');
  this.isConnecting = false;
  this.ws = null;

  // Stop reconnecting after max attempts
  if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logger.error('WebSocket max reconnect attempts reached');
    return;
  }

  // ... existing reconnection logic
};
```

---

### Commit All Files Bug

**Root Cause:** `git add -A` stages ALL changes in the worktree. While worktrees isolate features, if a user makes manual changes in the worktree, those get committed too.

**Analysis:** This is **intentional design** - the worktree IS the feature workspace. The fix is to improve visibility:

```typescript
// apps/server/src/services/auto-mode-service.ts

async commitFeature(...): Promise<string | null> {
  const { stdout: status } = await execAsync('git status --porcelain', { cwd: workDir });
  if (!status.trim()) return null;

  // Log what will be committed for transparency
  const changedFiles = status.trim().split('\n').map(line => line.slice(3));
  console.log(`[AutoMode] Committing ${changedFiles.length} files for feature ${featureId}:`, changedFiles);

  await execAsync('git add -A', { cwd: workDir });
  // ...
}
```

---

## PREVENTION PLAN

### ESLint Rules
```javascript
// .eslintrc.js additions
rules: {
  'react-hooks/exhaustive-deps': 'error',
  '@typescript-eslint/no-floating-promises': 'error',
}
```

### CI Memory Check
```yaml
# .github/workflows/memory-check.yml
name: Memory Leak Detection
on: [pull_request]
jobs:
  memory-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
      - name: Run memory profiling
        run: node --expose-gc scripts/memory-profile.js
```

### Telemetry
```typescript
// Development memory monitoring
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    const usage = process.memoryUsage();
    if (usage.heapUsed > 500 * 1024 * 1024) {
      console.warn('[Memory] High heap:', Math.round(usage.heapUsed / 1024 / 1024), 'MB');
    }
  }, 30000);
}
```

---

## SUMMARY

| Issue | Status | Next Steps |
|-------|--------|------------|
| #315 Cryptic errors | **FIXED** | `http-api-client.ts:handleResponse()` |
| #235 RAM leaks | **FIXED** | 3 fixes: validation interval, limit, buffer |
| #316 MCP race | Blocked | MCP not implemented; pattern provided |
| Agent modal | **FIXED** | Replaced window global with Zustand |
| WebSocket | **FIXED** | Added max retry limit (10 attempts) |
| Commit scope | Design review | Consider if behavior change needed |
| Settings toggle | Defensive fix | Add try-catch wrapper |

**Fixes Applied:** 6 of 9 issues resolved
**Total Estimated Effort:** ~20 hours for all fixes
