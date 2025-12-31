import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { secureFs, isPathAllowed } from '@automaker/platform';
import type { ToolDefinition, ToolExecutionContext, ToolExecutionResult } from './types.js';

const execAsync = promisify(exec);

const DEFAULT_IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  'out',
  '.cache',
]);

const DEFAULT_MAX_RESULTS = 2000;
const DEFAULT_MAX_MATCHES = 200;
const DEFAULT_FETCH_BYTES = 100000;
const DEFAULT_BASH_TIMEOUT_MS = 120000;

export const DEFAULT_TOOL_NAMES = [
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'Bash',
  'WebFetch',
] as const;

const asObject = (input: unknown): Record<string, unknown> | null =>
  input && typeof input === 'object' ? (input as Record<string, unknown>) : null;

const getString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null;

const normalizeRelativePath = (value: string): string =>
  value.replace(/\\/g, '/');

const resolveInputPath = (cwd: string, inputPath: string): string =>
  path.isAbsolute(inputPath) ? inputPath : path.resolve(cwd, inputPath);

const coerceFilePath = (input: Record<string, unknown>): string | null => {
  const candidate =
    getString(input.file_path) ||
    getString(input.filePath) ||
    getString(input.path) ||
    getString(input.filename);
  return candidate;
};

const coerceText = (input: Record<string, unknown>): string | null => {
  if (typeof input.content === 'string') return input.content;
  if (typeof input.text === 'string') return input.text;
  return null;
};

const coerceCommand = (input: Record<string, unknown>): string | null =>
  getString(input.command) || getString(input.cmd);

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const globToRegExp = (pattern: string): RegExp => {
  let regex = '';
  let index = 0;
  const normalized = normalizeRelativePath(pattern);

  while (index < normalized.length) {
    const char = normalized[index];
    if (char === '*') {
      if (normalized[index + 1] === '*') {
        regex += '.*';
        index += 2;
        if (normalized[index] === '/') {
          regex += '/?';
          index += 1;
        }
      } else {
        regex += '[^/]*';
        index += 1;
      }
      continue;
    }
    if (char === '?') {
      regex += '.';
      index += 1;
      continue;
    }
    regex += escapeRegExp(char);
    index += 1;
  }

  return new RegExp(`^${regex}$`);
};

const walkDirectory = async (
  rootDir: string,
  maxResults: number
): Promise<string[]> => {
  const results: string[] = [];
  const pending: string[] = [rootDir];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) break;

    let entries: Array<import('fs').Dirent>;
    try {
      entries = (await secureFs.readdir(current, {
        withFileTypes: true,
      })) as Array<import('fs').Dirent>;
    } catch (error) {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (DEFAULT_IGNORE_DIRS.has(entry.name)) continue;
        pending.push(fullPath);
      } else if (entry.isFile()) {
        const relative = path.relative(rootDir, fullPath);
        results.push(normalizeRelativePath(relative));
        if (results.length >= maxResults) {
          return results;
        }
      }
    }
  }

  return results;
};

const readTool = async (
  input: unknown,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> => {
  const params = asObject(input);
  if (!params) {
    return { content: 'Read tool input must be an object.', isError: true };
  }
  const filePath = coerceFilePath(params);
  if (!filePath) {
    return { content: 'Read tool requires file_path.', isError: true };
  }

  const resolved = resolveInputPath(context.cwd, filePath);
  try {
    const content = (await secureFs.readFile(resolved, 'utf-8')) as string;
    const startLine = Number(params.start_line ?? params.startLine ?? 0);
    const endLine = Number(params.end_line ?? params.endLine ?? 0);
    if (startLine || endLine) {
      const lines = content.split(/\r?\n/);
      const startIndex = Math.max(startLine - 1, 0);
      const endIndex = endLine ? Math.min(endLine, lines.length) : lines.length;
      return {
        content: lines.slice(startIndex, endIndex).join('\n'),
      };
    }
    return { content };
  } catch (error) {
    return {
      content: `Read failed for ${resolved}: ${(error as Error).message}`,
      isError: true,
    };
  }
};

const writeTool = async (
  input: unknown,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> => {
  const params = asObject(input);
  if (!params) {
    return { content: 'Write tool input must be an object.', isError: true };
  }
  const filePath = coerceFilePath(params);
  const content = coerceText(params);
  if (!filePath || content === null) {
    return {
      content: 'Write tool requires file_path and content.',
      isError: true,
    };
  }

  const resolved = resolveInputPath(context.cwd, filePath);
  try {
    await secureFs.mkdir(path.dirname(resolved), { recursive: true });
    await secureFs.writeFile(resolved, content, 'utf-8');
    return {
      content: `Wrote ${content.length} characters to ${resolved}.`,
    };
  } catch (error) {
    return {
      content: `Write failed for ${resolved}: ${(error as Error).message}`,
      isError: true,
    };
  }
};

const editTool = async (
  input: unknown,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> => {
  const params = asObject(input);
  if (!params) {
    return { content: 'Edit tool input must be an object.', isError: true };
  }
  const filePath = coerceFilePath(params);
  if (!filePath) {
    return { content: 'Edit tool requires file_path.', isError: true };
  }

  const resolved = resolveInputPath(context.cwd, filePath);
  const editsInput = params.edits;
  const edits =
    Array.isArray(editsInput) && editsInput.length > 0
      ? editsInput
      : [
          {
            old_string: params.old_string ?? params.oldString,
            new_string: params.new_string ?? params.newString,
            replace_all: params.replace_all ?? params.replaceAll,
          },
        ];

  try {
    const original = (await secureFs.readFile(resolved, 'utf-8')) as string;
    let updated = original;
    let totalReplacements = 0;

    for (const edit of edits) {
      const editObj = asObject(edit);
      if (!editObj) {
        return { content: 'Edit entries must be objects.', isError: true };
      }
      const oldString = getString(editObj.old_string ?? editObj.oldString);
      const newString = String(editObj.new_string ?? editObj.newString ?? '');
      const replaceAll = Boolean(editObj.replace_all ?? editObj.replaceAll);

      if (!oldString) {
        return {
          content: 'Edit entries must include old_string.',
          isError: true,
        };
      }

      if (replaceAll) {
        const parts = updated.split(oldString);
        if (parts.length === 1) {
          return {
            content: `Edit failed: "${oldString}" not found in ${resolved}.`,
            isError: true,
          };
        }
        totalReplacements += parts.length - 1;
        updated = parts.join(newString);
      } else {
        const index = updated.indexOf(oldString);
        if (index === -1) {
          return {
            content: `Edit failed: "${oldString}" not found in ${resolved}.`,
            isError: true,
          };
        }
        updated =
          updated.slice(0, index) +
          newString +
          updated.slice(index + oldString.length);
        totalReplacements += 1;
      }
    }

    if (updated === original) {
      return {
        content: `Edit made no changes to ${resolved}.`,
      };
    }

    await secureFs.writeFile(resolved, updated, 'utf-8');
    return {
      content: `Updated ${resolved} (${totalReplacements} replacements).`,
    };
  } catch (error) {
    return {
      content: `Edit failed for ${resolved}: ${(error as Error).message}`,
      isError: true,
    };
  }
};

const globTool = async (
  input: unknown,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> => {
  const params = asObject(input) ?? {};
  const pattern = getString(params.pattern) ?? '**/*';
  const baseDir = getString(params.path) ?? '.';
  const maxResults =
    Number(params.max_results ?? params.maxResults ?? DEFAULT_MAX_RESULTS) ||
    DEFAULT_MAX_RESULTS;

  const root = resolveInputPath(context.cwd, baseDir);
  const matcher = globToRegExp(pattern);

  try {
    const files = await walkDirectory(root, DEFAULT_MAX_RESULTS);
    const matches = files.filter((file) => matcher.test(file));
    if (matches.length === 0) {
      return { content: 'No files matched.' };
    }
    return { content: matches.join('\n') };
  } catch (error) {
    return {
      content: `Glob failed in ${root}: ${(error as Error).message}`,
      isError: true,
    };
  }
};

const grepTool = async (
  input: unknown,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> => {
  const params = asObject(input) ?? {};
  const pattern = getString(params.pattern);
  if (!pattern) {
    return { content: 'Grep tool requires pattern.', isError: true };
  }

  const baseDir = getString(params.path) ?? '.';
  const globPattern = getString(params.glob) ?? '**/*';
  const regexMode = Boolean(params.regex);
  const caseSensitive = params.case_sensitive === false ? false : true;
  const maxResults =
    Number(params.max_results ?? params.maxResults ?? DEFAULT_MAX_MATCHES) ||
    DEFAULT_MAX_MATCHES;

  const root = resolveInputPath(context.cwd, baseDir);
  const matcher = globToRegExp(globPattern);

  let searchRegex: RegExp | null = null;
  if (regexMode) {
    try {
      searchRegex = new RegExp(pattern, caseSensitive ? '' : 'i');
    } catch (error) {
      return {
        content: `Invalid regex pattern: ${(error as Error).message}`,
        isError: true,
      };
    }
  }

  try {
    const files = await walkDirectory(root, maxResults);
    const matches: string[] = [];

    for (const relative of files) {
      if (!matcher.test(relative)) continue;
      const fullPath = path.join(root, relative);

      let content: string;
      try {
        content = (await secureFs.readFile(fullPath, 'utf-8')) as string;
      } catch {
        continue;
      }

      const lines = content.split(/\r?\n/);
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex];
        const hit = searchRegex
          ? searchRegex.test(line)
          : caseSensitive
            ? line.includes(pattern)
            : line.toLowerCase().includes(pattern.toLowerCase());
        if (hit) {
          matches.push(`${relative}:${lineIndex + 1}: ${line}`);
        }
        if (matches.length >= maxResults) {
          return { content: matches.join('\n') };
        }
      }
    }

    if (matches.length === 0) {
      return { content: 'No matches found.' };
    }
    return { content: matches.join('\n') };
  } catch (error) {
    return {
      content: `Grep failed in ${root}: ${(error as Error).message}`,
      isError: true,
    };
  }
};

const bashTool = async (
  input: unknown,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> => {
  const params = asObject(input);
  if (!params) {
    return { content: 'Bash tool input must be an object.', isError: true };
  }
  const command = coerceCommand(params);
  if (!command) {
    return { content: 'Bash tool requires command.', isError: true };
  }

  const requestedCwd = getString(params.cwd);
  const resolvedCwd = requestedCwd
    ? resolveInputPath(context.cwd, requestedCwd)
    : context.cwd;

  if (!isPathAllowed(resolvedCwd)) {
    return {
      content: `Bash cwd is not allowed: ${resolvedCwd}`,
      isError: true,
    };
  }

  const timeoutMs =
    Number(params.timeout_ms ?? params.timeoutMs ?? DEFAULT_BASH_TIMEOUT_MS) ||
    DEFAULT_BASH_TIMEOUT_MS;

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: resolvedCwd,
      timeout: timeoutMs,
      maxBuffer: 5 * 1024 * 1024,
    });
    const output = [stdout, stderr && `\n[stderr]\n${stderr}`]
      .filter(Boolean)
      .join('');
    return { content: output.trim() || 'Command completed with no output.' };
  } catch (error) {
    return {
      content: `Bash failed: ${(error as Error).message}`,
      isError: true,
    };
  }
};

const webFetchTool = async (
  input: unknown,
  _context: ToolExecutionContext
): Promise<ToolExecutionResult> => {
  const params = asObject(input);
  if (!params) {
    return { content: 'WebFetch tool input must be an object.', isError: true };
  }
  const url = getString(params.url) || getString(params.href);
  if (!url) {
    return { content: 'WebFetch tool requires url.', isError: true };
  }
  const method = getString(params.method)?.toUpperCase() || 'GET';
  const headers =
    params.headers && typeof params.headers === 'object'
      ? (params.headers as Record<string, string>)
      : undefined;
  const body = getString(params.body) ?? undefined;
  const maxBytes =
    Number(params.max_bytes ?? params.maxBytes ?? DEFAULT_FETCH_BYTES) ||
    DEFAULT_FETCH_BYTES;

  const controller = new AbortController();
  const timeoutMs = Number(params.timeout_ms ?? params.timeoutMs ?? 20000) || 20000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const text = await response.text();
    const truncated = text.slice(0, maxBytes);
    return {
      content: `Status: ${response.status} ${response.statusText}\n\n${truncated}`,
    };
  } catch (error) {
    clearTimeout(timeout);
    return {
      content: `WebFetch failed: ${(error as Error).message}`,
      isError: true,
    };
  }
};

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'Read',
    description: 'Read a file from the local filesystem.',
    parameters: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Path to the file.' },
        start_line: { type: 'integer', description: 'Optional start line (1-based).' },
        end_line: { type: 'integer', description: 'Optional end line (1-based).' },
      },
      required: ['file_path'],
    },
    execute: readTool,
  },
  {
    name: 'Write',
    description: 'Write content to a file, creating directories if needed.',
    parameters: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Path to the file.' },
        content: { type: 'string', description: 'Content to write.' },
      },
      required: ['file_path', 'content'],
    },
    execute: writeTool,
  },
  {
    name: 'Edit',
    description:
      'Edit a file by replacing text. Provide old_string/new_string or an edits array.',
    parameters: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Path to the file.' },
        old_string: { type: 'string', description: 'Text to replace.' },
        new_string: { type: 'string', description: 'Replacement text.' },
        replace_all: { type: 'boolean', description: 'Replace all occurrences.' },
        edits: {
          type: 'array',
          description: 'Batch edits to apply in order.',
          items: {
            type: 'object',
            properties: {
              old_string: { type: 'string' },
              new_string: { type: 'string' },
              replace_all: { type: 'boolean' },
            },
            required: ['old_string', 'new_string'],
          },
        },
      },
      required: ['file_path'],
    },
    execute: editTool,
  },
  {
    name: 'Glob',
    description: 'List files matching a glob pattern.',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Glob pattern (e.g., **/*.ts).' },
        path: { type: 'string', description: 'Base directory (defaults to cwd).' },
        max_results: { type: 'integer', description: 'Maximum results.' },
      },
    },
    execute: globTool,
  },
  {
    name: 'Grep',
    description: 'Search files for a pattern.',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Search pattern.' },
        path: { type: 'string', description: 'Base directory (defaults to cwd).' },
        glob: { type: 'string', description: 'Glob filter for files.' },
        regex: { type: 'boolean', description: 'Interpret pattern as regex.' },
        case_sensitive: { type: 'boolean', description: 'Case sensitive search.' },
        max_results: { type: 'integer', description: 'Maximum matches.' },
      },
      required: ['pattern'],
    },
    execute: grepTool,
  },
  {
    name: 'Bash',
    description: 'Execute a shell command.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to execute.' },
        cwd: { type: 'string', description: 'Optional working directory.' },
        timeout_ms: { type: 'integer', description: 'Timeout in milliseconds.' },
      },
      required: ['command'],
    },
    execute: bashTool,
  },
  {
    name: 'WebFetch',
    description: 'Fetch a URL and return the response body.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch.' },
        method: { type: 'string', description: 'HTTP method (default GET).' },
        headers: { type: 'object', description: 'HTTP headers.' },
        body: { type: 'string', description: 'Optional request body.' },
        max_bytes: { type: 'integer', description: 'Max response size.' },
        timeout_ms: { type: 'integer', description: 'Timeout in milliseconds.' },
      },
      required: ['url'],
    },
    execute: webFetchTool,
  },
];

export const getToolDefinitions = (
  allowedTools?: string[]
): ToolDefinition[] => {
  const names =
    allowedTools === undefined ? Array.from(DEFAULT_TOOL_NAMES) : allowedTools;
  return TOOL_DEFINITIONS.filter((tool) => names.includes(tool.name));
};
