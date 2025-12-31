/**
 * Middleware for validating path parameters against ALLOWED_ROOT_DIRECTORY
 * Provides a clean, reusable way to validate paths without repeating the same
 * try-catch block in every route handler
 */

import type { Request, Response, NextFunction } from 'express';
import { validatePath, PathNotAllowedError } from '@automaker/platform';
import * as secureFs from '../lib/secure-fs.js';

/**
 * Creates a middleware that validates specified path parameters in req.body
 * @param paramNames - Names of parameters to validate (e.g., 'projectPath', 'worktreePath')
 * @example
 * router.post('/create', validatePathParams('projectPath'), handler);
 * router.post('/delete', validatePathParams('projectPath', 'worktreePath'), handler);
 * router.post('/send', validatePathParams('workingDirectory?', 'imagePaths[]'), handler);
 *
 * Special syntax:
 * - 'paramName?' - Optional parameter (only validated if present)
 * - 'paramName[]' - Array parameter (validates each element)
 */
export function validatePathParams(...paramNames: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      for (const paramName of paramNames) {
        // Handle optional parameters (paramName?)
        if (paramName.endsWith('?')) {
          const actualName = paramName.slice(0, -1);
          const value = req.body[actualName];
          if (value) {
            validatePath(value);
          }
          continue;
        }

        // Handle array parameters (paramName[])
        if (paramName.endsWith('[]')) {
          const actualName = paramName.slice(0, -2);
          const values = req.body[actualName];
          if (Array.isArray(values) && values.length > 0) {
            for (const value of values) {
              validatePath(value);
            }
          }
          continue;
        }

        // Handle regular parameters
        const value = req.body[paramName];
        if (value) {
          validatePath(value);
        }
      }

      next();
    } catch (error) {
      if (error instanceof PathNotAllowedError) {
        res.status(403).json({
          success: false,
          error: error.message,
        });
        return;
      }

      // Re-throw unexpected errors
      throw error;
    }
  };
}

/**
 * Ensures the projectPath exists and points to a directory.
 */
export function validateProjectPathExists(paramName = 'projectPath') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const projectPath = req.body?.[paramName];
    if (!projectPath || typeof projectPath !== 'string') {
      res.status(400).json({ success: false, error: 'projectPath is required' });
      return;
    }

    try {
      const stats = await secureFs.stat(projectPath);
      if (!stats.isDirectory()) {
        res.status(400).json({
          success: false,
          error: `Project path is not a directory: ${projectPath}.`,
          code: 'PROJECT_NOT_FOUND',
        });
        return;
      }
      next();
    } catch (error) {
      if (error instanceof PathNotAllowedError) {
        res.status(403).json({ success: false, error: error.message });
        return;
      }

      const missingMessage = `Project directory not found: ${projectPath}. It may have been moved or deleted. Remove it from the project list or choose the new location.`;
      res.status(404).json({
        success: false,
        error: missingMessage,
        code: 'PROJECT_NOT_FOUND',
      });
    }
  };
}
