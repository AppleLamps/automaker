/**
 * GitHub routes - HTTP API for GitHub integration
 */

import { Router } from 'express';
import type { EventEmitter } from '../../lib/events.js';
import { validatePathParams, validateProjectPathExists } from '../../middleware/validate-paths.js';
import { createCheckGitHubRemoteHandler } from './routes/check-github-remote.js';
import { createListIssuesHandler } from './routes/list-issues.js';
import { createListPRsHandler } from './routes/list-prs.js';
import { createValidateIssueHandler } from './routes/validate-issue.js';
import {
  createValidationStatusHandler,
  createValidationStopHandler,
  createGetValidationsHandler,
  createDeleteValidationHandler,
  createMarkViewedHandler,
} from './routes/validation-endpoints.js';
import type { SettingsService } from '../../services/settings-service.js';

export function createGitHubRoutes(
  events: EventEmitter,
  settingsService?: SettingsService
): Router {
  const router = Router();

  router.post(
    '/check-remote',
    validatePathParams('projectPath'),
    validateProjectPathExists('projectPath'),
    createCheckGitHubRemoteHandler()
  );
  router.post(
    '/issues',
    validatePathParams('projectPath'),
    validateProjectPathExists('projectPath'),
    createListIssuesHandler()
  );
  router.post(
    '/prs',
    validatePathParams('projectPath'),
    validateProjectPathExists('projectPath'),
    createListPRsHandler()
  );
  router.post(
    '/validate-issue',
    validatePathParams('projectPath'),
    validateProjectPathExists('projectPath'),
    createValidateIssueHandler(events, settingsService)
  );

  // Validation management endpoints
  router.post(
    '/validation-status',
    validatePathParams('projectPath'),
    validateProjectPathExists('projectPath'),
    createValidationStatusHandler()
  );
  router.post(
    '/validation-stop',
    validatePathParams('projectPath'),
    validateProjectPathExists('projectPath'),
    createValidationStopHandler()
  );
  router.post(
    '/validations',
    validatePathParams('projectPath'),
    validateProjectPathExists('projectPath'),
    createGetValidationsHandler()
  );
  router.post(
    '/validation-delete',
    validatePathParams('projectPath'),
    validateProjectPathExists('projectPath'),
    createDeleteValidationHandler()
  );
  router.post(
    '/validation-mark-viewed',
    validatePathParams('projectPath'),
    validateProjectPathExists('projectPath'),
    createMarkViewedHandler(events)
  );

  return router;
}
