# Architecture Review: Context-Aware Spec Generation & Metrics-Based Refactoring

**Review Date:** December 2024
**Scope:** AI suggestion systems, spec generation, context handling, and refactoring improvements

---

## Executive Summary

Automaker has solid foundations for AI-powered feature suggestions but lacks two capabilities that would significantly improve output quality:

1. **Context-Aware Spec Generation**: Current spec generation creates new specs from scratch. It should merge with existing specs and infer constraints from actual code patterns.

2. **Metrics-Grounded Refactoring**: Current refactoring suggestions are purely LLM-driven intuition. Adding objective code metrics would reduce hallucinations and prioritize actionable improvements.

**Recommended Investment:** 3-5 days for MVP of both features.

---

## Step 1: Repository Understanding

### Current Architecture

```
automaker/
├── apps/
│   ├── server/           # Express + WebSocket backend
│   │   ├── routes/
│   │   │   ├── suggestions/      # Feature/refactoring suggestions
│   │   │   ├── app-spec/         # Spec generation/regeneration
│   │   │   ├── backlog-plan/     # AI-assisted planning
│   │   │   └── enhance-prompt/   # Prompt enhancement
│   │   ├── services/
│   │   │   ├── auto-mode-service.ts  # Feature execution (111KB core)
│   │   │   └── agent-service.ts      # Conversation management
│   │   └── lib/
│   │       ├── sdk-options.ts        # Claude SDK configuration
│   │       └── app-spec-format.ts    # XML spec format
│   └── ui/               # React + Electron frontend
└── libs/
    ├── utils/src/context-loader.ts   # Context file loading
    ├── prompts/src/enhancement.ts    # Enhancement prompts
    └── types/src/spec.ts             # Spec schema definitions
```

### AI Suggestion Implementation Locations

| System | Location | Purpose |
|--------|----------|---------|
| Feature/Refactoring Suggestions | `apps/server/src/routes/suggestions/generate-suggestions.ts` | Generates 3-5 suggestions per category |
| Spec Generation | `apps/server/src/routes/app-spec/generate-spec.ts` | Creates/regenerates project specs |
| Prompt Enhancement | `libs/prompts/src/enhancement.ts` | Improves user-written descriptions |
| Backlog Planning | `apps/server/src/routes/backlog-plan/generate-plan.ts` | AI-assisted feature planning |

### Context Gathering Mechanisms

**Current Flow:**
```
.automaker/context/*.md  →  loadContextFiles()  →  ContextFilesResult
                                    ↓
                         filterClaudeMdFromContext()
                                    ↓
                         Combined System Prompt  →  Claude Agent SDK
```

**Key Files:**
- `libs/utils/src/context-loader.ts`: Loads `.md` and `.txt` files from `.automaker/context/`
- `apps/server/src/lib/settings-helpers.ts`: Filters CLAUDE.md to prevent duplication
- `apps/server/src/lib/sdk-options.ts`: Configures SDK with `settingSources` for auto-loading

**What's Loaded:**
- Context files from `.automaker/context/` (ARCHITECTURE.md, CODE_QUALITY.md, etc.)
- CLAUDE.md via SDK's `settingSources` (when enabled)
- Conversation history for continuity

**What's NOT Loaded:**
- Existing `app_spec.txt` during spec regeneration
- Code metrics or static analysis results
- Actual pattern examples from the codebase

### Spec Handling

**Storage:** `.automaker/app_spec.txt` (XML format)

**Schema:** Defined in `libs/types/src/spec.ts`:
```typescript
interface SpecOutput {
  project_name: string;
  overview: string;
  technology_stack: string[];
  core_capabilities: string[];
  implemented_features: Array<{
    name: string;
    description: string;
    file_locations?: string[];
  }>;
  additional_requirements?: string[];
  development_guidelines?: string[];
  implementation_roadmap?: Array<{
    phase: string;
    status: 'completed' | 'in_progress' | 'pending';
    description: string;
  }>;
}
```

**Conversion:** `specToXml()` in `apps/server/src/lib/app-spec-format.ts` converts JSON → XML

---

## Current Strengths

1. **Structured Output**: Uses Claude's JSON schema output format (`specOutputSchema`) for reliable parsing
2. **Deduplication Logic**: Suggestions system reads existing features to avoid duplicates (`generate-suggestions.ts:50-95`)
3. **Context Loading**: Clean abstraction in `loadContextFiles()` with metadata support
4. **XML Specification**: Well-defined spec format with TypeScript types
5. **Event-Driven Streaming**: Real-time progress updates via WebSocket

---

## Current Blind Spots & Risks

### Blind Spot 1: Spec Regeneration Destroys History
**Location:** `apps/server/src/routes/app-spec/generate-spec.ts:249`

The current implementation overwrites `app_spec.txt` completely:
```typescript
await secureFs.writeFile(specPath, xmlContent);
```

**Risk:** Manual additions, corrections, or refinements are lost on regeneration.

### Blind Spot 2: No Pattern Inference
**Location:** `generate-spec.ts:48-53`

Analysis instructions are vague:
```typescript
analysisInstructions = `Based on this overview, analyze the project directory...
- Existing technologies and frameworks
- Project structure and architecture
- Current features and capabilities
- Code patterns and conventions`;
```

**Risk:** The agent explores but doesn't extract concrete patterns (naming conventions, error handling style, import patterns).

### Blind Spot 3: Refactoring Suggestions Lack Grounding
**Location:** `generate-suggestions.ts:133-138`

```typescript
const typePrompts: Record<string, string> = {
  refactoring: 'Analyze this project and identify refactoring opportunities.',
  // ...
};
```

**Risk:** Pure LLM intuition leads to:
- False positives (suggesting "refactoring" where code is fine)
- Vague suggestions ("improve error handling" with no specifics)
- Missing actual problems (large files, high complexity, duplication)

### Blind Spot 4: No Objective Metrics
**Location:** `apps/ui/eslint.config.mjs`

ESLint config has minimal rules:
```javascript
rules: {
  '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  '@typescript-eslint/no-explicit-any': 'warn',
}
```

**Missing:**
- Cyclomatic complexity limits
- File/function length warnings
- Duplication detection

---

## Step 2: Context-Aware Spec Generation Analysis

### What's Missing Today

1. **Existing Spec Not Loaded**: `generate-spec.ts` doesn't read current `app_spec.txt` before generating
2. **No Merge Strategy**: Complete replacement instead of section-by-section updates
3. **Pattern Extraction Missing**: Agent explores but doesn't capture patterns as spec constraints
4. **No Version History**: No tracking of spec changes over time

### Minimal Changes to Unlock Context-Aware Spec Generation

#### Change 1: Load Existing Spec Before Generation

**File:** `apps/server/src/routes/app-spec/generate-spec.ts`

Add before prompt construction:
```typescript
// Load existing spec if present
let existingSpec = '';
try {
  existingSpec = await secureFs.readFile(getAppSpecPath(projectPath), 'utf-8');
} catch {
  // No existing spec - starting fresh
}
```

Modify prompt to include:
```typescript
const prompt = `You are helping to update a software project specification.

${existingSpec ? `EXISTING SPECIFICATION:
${existingSpec}

IMPORTANT: Preserve existing content where accurate. Only update sections that need changes based on your analysis. Do not remove valid information.` : 'No existing specification - create from scratch.'}

Project Overview:
${projectOverview}
...
```

#### Change 2: Add Pattern Extraction Instructions

Enhance the analysis prompt:
```typescript
analysisInstructions = `Based on this overview, analyze the project directory to understand:
- Existing technologies and frameworks
- Project structure and architecture
- Current features and capabilities
- Code patterns and conventions

EXTRACT CONCRETE PATTERNS:
- Naming conventions (files, functions, variables, CSS classes)
- Import organization (order, grouping, aliases)
- Error handling patterns (try/catch style, error types)
- Testing patterns (file naming, describe blocks, mock strategies)
- Component patterns (functional vs class, hooks usage, prop patterns)

Include these patterns in development_guidelines.`;
```

#### Change 3: Section-Scoped Updates

**Recommendation:** Use diff-based updates for spec sections.

Create `libs/utils/src/spec-merger.ts`:
```typescript
interface SpecDiff {
  section: keyof SpecOutput;
  action: 'add' | 'update' | 'remove';
  oldValue?: unknown;
  newValue: unknown;
  reason: string;
}

function mergeSpecs(existing: SpecOutput, updated: SpecOutput): {
  merged: SpecOutput;
  diffs: SpecDiff[];
}
```

**Prompt modification:**
```typescript
Instead of returning a complete spec, return a structured diff:

{
  "diffs": [
    {
      "section": "implemented_features",
      "action": "add",
      "newValue": { "name": "Dark Mode", "description": "..." },
      "reason": "Found implementation in src/theme/*"
    }
  ]
}
```

### Should Specs Be Appended, Diff-Based, or Section-Scoped?

**Recommendation: Section-scoped with diff tracking**

| Approach | Pros | Cons |
|----------|------|------|
| **Full Replace** | Simple | Loses manual additions |
| **Append Only** | Preserves history | Creates duplicates, grows unbounded |
| **Diff-Based** | Precise, auditable | More complex to implement |
| **Section-Scoped** | Balanced, preserves structure | Requires section identification |

**Best approach:** Diff-based within sections:
1. Load existing spec as `SpecOutput`
2. AI produces `SpecDiff[]` with additions/updates/removals per section
3. Apply diffs with human review option
4. Store diff history in `.automaker/spec-history.json`

---

## Step 3: Refactoring with Metrics Review

### Current Refactoring Suggestion Production

**Location:** `apps/server/src/routes/suggestions/generate-suggestions.ts:133-138`

```typescript
const typePrompts: Record<string, string> = {
  refactoring: 'Analyze this project and identify refactoring opportunities.',
  // ...
};
```

The agent receives:
- The prompt above
- Access to Read, Glob, Grep tools
- Existing context files

**Problem:** No objective signals guide the analysis.

### Available Objective Signals

| Signal | Current Status | Implementation Path |
|--------|----------------|---------------------|
| **ESLint errors/warnings** | Configured but minimal rules | Run `eslint --format=json`, parse output |
| **TypeScript errors** | Build checks exist | Run `tsc --noEmit`, parse diagnostics |
| **Cyclomatic complexity** | Not configured | Add `eslint-plugin-sonarjs` with complexity rules |
| **File length** | Not tracked | Simple file stats from glob |
| **Function length** | Not tracked | AST analysis or ESLint rule |
| **Duplication** | Not configured | Add `jscpd` as dev dependency |
| **Test coverage** | Vitest configured | Parse coverage JSON output |

### Highest ROI Tools

**Tier 1 (Implement First):**
1. **ESLint with complexity rules** - Already in stack, just add rules
2. **File size analysis** - Trivial to implement, high signal

**Tier 2 (High Value):**
3. **jscpd (duplication)** - Easy to add, finds real issues
4. **Coverage gaps** - Already have Vitest coverage

**Tier 3 (Nice to Have):**
5. **Custom AST analysis** - Expensive to build, limited value over ESLint

### Where False Positives Are Likely

| Tool | False Positive Risk | Mitigation |
|------|---------------------|------------|
| **Complexity** | High for legitimately complex business logic | Set threshold at 15+, not default 10 |
| **Duplication** | High for boilerplate (tests, similar components) | Ignore test files, set minimum 50 tokens |
| **File length** | Medium - some files are legitimately large | Flag only >500 lines, context matters |
| **Coverage** | Low | Use as informational, not prescriptive |

### How Metrics Should Be Summarized for LLM

**Create:** `apps/server/src/lib/metrics-collector.ts`

```typescript
interface CodeMetrics {
  summary: {
    totalFiles: number;
    avgComplexity: number;
    maxComplexity: { file: string; function: string; score: number };
    duplicationPercent: number;
    coveragePercent: number;
  };
  hotspots: Array<{
    file: string;
    issues: Array<{
      type: 'complexity' | 'duplication' | 'size' | 'coverage';
      severity: 'high' | 'medium' | 'low';
      detail: string;
    }>;
  }>;
  eslintSummary: {
    errorCount: number;
    warningCount: number;
    topRules: Array<{ rule: string; count: number }>;
  };
}
```

**Prompt injection:**
```typescript
const prompt = `Analyze this project for refactoring opportunities.

CODE METRICS ANALYSIS:
${JSON.stringify(metrics, null, 2)}

Based on these metrics, prioritize:
1. Files with high complexity scores (>${COMPLEXITY_THRESHOLD})
2. Files with duplication above ${DUPLICATION_THRESHOLD}%
3. Large files (>${SIZE_THRESHOLD} lines)

For each suggestion:
- Reference specific metrics that justify it
- Propose concrete refactoring steps
- Estimate impact (lines affected, complexity reduction)
`;
```

---

## Step 4: Best-Fix Proposal

### 1. Architecture Changes

#### New Module: `libs/utils/src/metrics-collector.ts`

Purpose: Collect and format code metrics for LLM consumption

```typescript
// Key functions
export async function collectProjectMetrics(projectPath: string): Promise<CodeMetrics>
export async function runEslintAnalysis(projectPath: string): Promise<EslintSummary>
export async function runDuplicationAnalysis(projectPath: string): Promise<DuplicationReport>
export function formatMetricsForPrompt(metrics: CodeMetrics): string
```

#### New Module: `libs/utils/src/spec-merger.ts`

Purpose: Merge spec updates without losing manual additions

```typescript
// Key functions
export function parseXmlSpec(xml: string): SpecOutput
export function diffSpecs(existing: SpecOutput, updated: SpecOutput): SpecDiff[]
export function applyDiffs(spec: SpecOutput, diffs: SpecDiff[]): SpecOutput
export function formatDiffsForReview(diffs: SpecDiff[]): string
```

#### ESLint Config Enhancement

**File:** `eslint.config.mjs` (root level, shared)

```javascript
// Add these plugins and rules
import sonarjs from 'eslint-plugin-sonarjs';

{
  plugins: { sonarjs },
  rules: {
    'sonarjs/cognitive-complexity': ['warn', 15],
    'sonarjs/no-duplicate-string': ['warn', { threshold: 5 }],
    'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
    'max-lines-per-function': ['warn', { max: 100, skipBlankLines: true, skipComments: true }],
  }
}
```

### 2. Prompt/Interface Changes

#### Enhanced Suggestion Prompt

**File:** `apps/server/src/routes/suggestions/generate-suggestions.ts`

```typescript
import { collectProjectMetrics, formatMetricsForPrompt } from '@automaker/utils';

export async function generateSuggestions(/* ... */) {
  // Collect metrics for refactoring type
  let metricsContext = '';
  if (suggestionType === 'refactoring') {
    const metrics = await collectProjectMetrics(projectPath);
    metricsContext = formatMetricsForPrompt(metrics);
  }

  const typePrompts: Record<string, string> = {
    refactoring: `Analyze this project for refactoring opportunities.

${metricsContext}

REQUIREMENTS:
- Each suggestion MUST reference specific metrics or code locations
- Include concrete before/after examples
- Estimate complexity reduction numerically`,
    // ... other types
  };
}
```

#### Enhanced Spec Generation

**File:** `apps/server/src/routes/app-spec/generate-spec.ts`

```typescript
import { parseXmlSpec, diffSpecs, applyDiffs } from '@automaker/utils';

export async function generateSpec(/* ... */) {
  // Load existing spec
  let existingSpec: SpecOutput | null = null;
  try {
    const existingXml = await secureFs.readFile(getAppSpecPath(projectPath), 'utf-8');
    existingSpec = parseXmlSpec(existingXml);
  } catch {
    // Starting fresh
  }

  // Include existing spec in prompt
  const prompt = existingSpec
    ? `Update the existing specification. Preserve accurate information, update outdated sections.

EXISTING SPEC:
${JSON.stringify(existingSpec, null, 2)}

Project Overview: ${projectOverview}
...`
    : `Create a new project specification...`;

  // After generation, if we had existing spec, compute diffs
  if (existingSpec && structuredOutput) {
    const diffs = diffSpecs(existingSpec, structuredOutput);
    // Emit diffs for UI review
    events.emit('spec-regeneration:event', {
      type: 'spec_diffs',
      diffs,
      requiresApproval: true,
    });
  }
}
```

### 3. Structured Output Formats

#### Refactoring Suggestion Schema

```json
{
  "type": "object",
  "properties": {
    "suggestions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "category": { "type": "string" },
          "description": { "type": "string" },
          "priority": { "type": "number", "minimum": 1, "maximum": 3 },
          "reasoning": { "type": "string" },
          "metrics": {
            "type": "object",
            "properties": {
              "source": { "type": "string", "enum": ["complexity", "duplication", "size", "eslint", "coverage", "manual"] },
              "currentValue": { "type": "number" },
              "targetValue": { "type": "number" },
              "files": { "type": "array", "items": { "type": "string" } }
            }
          },
          "refactoringType": {
            "type": "string",
            "enum": ["extract-function", "extract-component", "consolidate-duplicates", "simplify-logic", "add-types", "other"]
          },
          "estimatedImpact": {
            "type": "object",
            "properties": {
              "linesAffected": { "type": "number" },
              "complexityReduction": { "type": "number" }
            }
          }
        },
        "required": ["category", "description", "priority", "reasoning", "metrics"]
      }
    }
  }
}
```

#### Spec Diff Schema

```json
{
  "type": "object",
  "properties": {
    "diffs": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "section": {
            "type": "string",
            "enum": ["project_name", "overview", "technology_stack", "core_capabilities", "implemented_features", "additional_requirements", "development_guidelines", "implementation_roadmap"]
          },
          "action": { "type": "string", "enum": ["add", "update", "remove"] },
          "path": { "type": "string", "description": "JSON path within section, e.g., 'implemented_features[2]'" },
          "oldValue": {},
          "newValue": {},
          "reason": { "type": "string" },
          "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
        },
        "required": ["section", "action", "reason"]
      }
    },
    "summary": { "type": "string" }
  }
}
```

### 4. Incremental Rollout Plan

#### MVP (3-5 days)

**Day 1-2: Metrics Collection**
- [ ] Create `libs/utils/src/metrics-collector.ts`
- [ ] Add `eslint-plugin-sonarjs` to devDependencies
- [ ] Configure complexity rules in ESLint
- [ ] Implement `runEslintAnalysis()` with JSON output parsing
- [ ] Implement `formatMetricsForPrompt()`

**Day 3: Integrate Metrics into Refactoring**
- [ ] Modify `generate-suggestions.ts` to collect metrics for refactoring type
- [ ] Update suggestion schema to include metrics source
- [ ] Test with sample projects

**Day 4-5: Context-Aware Spec Generation**
- [ ] Implement `parseXmlSpec()` in `libs/utils/src/spec-merger.ts`
- [ ] Modify `generate-spec.ts` to load existing spec
- [ ] Update prompt to include existing spec context
- [ ] Test preserving manual additions

#### Phase 2 (5-8 days after MVP)

- [ ] Add jscpd for duplication detection
- [ ] Implement `diffSpecs()` and `applyDiffs()`
- [ ] Add UI for reviewing spec diffs before applying
- [ ] Add file size analysis to metrics
- [ ] Store spec history in `.automaker/spec-history.json`
- [ ] Add pattern extraction to spec generation (naming conventions, etc.)

#### What Can Wait

- Custom AST analysis (ESLint complexity rules are sufficient)
- Test coverage integration (useful but not high priority)
- Automatic spec versioning/branching
- ML-based pattern detection

---

## Risky or Over-Engineered Ideas to Avoid

1. **Full AST parsing for custom metrics** - ESLint plugins already do this better
2. **Vector embeddings for pattern matching** - Current file-based context is sufficient
3. **Automatic spec branching** - Manual review is safer
4. **Real-time metrics dashboard** - Nice-to-have, not core value

---

## Recommended Next Actions

1. **Install and configure eslint-plugin-sonarjs** (30 min)
   ```bash
   npm install -D eslint-plugin-sonarjs
   ```
   Add complexity rules to `eslint.config.mjs`

2. **Create `metrics-collector.ts`** (2-3 hours)
   - Start with ESLint JSON output parsing
   - Add file size analysis
   - Format for prompt injection

3. **Modify `generate-suggestions.ts`** (1-2 hours)
   - Call metrics collector for refactoring type
   - Include metrics in prompt
   - Update schema to track metric sources

4. **Modify `generate-spec.ts` to load existing spec** (1-2 hours)
   - Read existing `app_spec.txt` before generation
   - Include in prompt with preservation instructions
   - Test with existing project

5. **Add pattern extraction instructions** (30 min)
   - Update analysis prompt to extract naming conventions
   - Test output quality

6. **Create spec merger utilities** (2-3 hours)
   - Implement XML parsing
   - Implement section-level diffing
   - Test with real spec changes

---

## Summary

| Improvement | Current State | Proposed State | Effort |
|-------------|---------------|----------------|--------|
| **Spec Context** | Regenerates from scratch | Merges with existing, preserves additions | 2 days |
| **Pattern Inference** | Vague "analyze patterns" | Explicit extraction of naming/structure patterns | 0.5 days |
| **Refactoring Metrics** | Pure LLM intuition | ESLint complexity + file size grounding | 1.5 days |
| **Duplication Detection** | None | jscpd integration | 1 day |
| **Diff-Based Updates** | Full replacement | Section-scoped with review | 2 days |

**Total MVP:** 3-5 days for meaningful improvement in suggestion quality and spec preservation.
