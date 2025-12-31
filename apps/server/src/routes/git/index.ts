/**
 * Git routes - HTTP API for git operations (non-worktree)
 */

import { Router } from 'express';
import { validatePathParams, validateProjectPathExists } from '../../middleware/validate-paths.js';
import { createDiffsHandler } from './routes/diffs.js';
import { createFileDiffHandler } from './routes/file-diff.js';

export function createGitRoutes(): Router {
  const router = Router();

  router.post(
    '/diffs',
    validatePathParams('projectPath'),
    validateProjectPathExists('projectPath'),
    createDiffsHandler()
  );
  router.post(
    '/file-diff',
    validatePathParams('projectPath', 'filePath'),
    validateProjectPathExists('projectPath'),
    createFileDiffHandler()
  );

  return router;
}
