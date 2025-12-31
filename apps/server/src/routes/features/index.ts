/**
 * Features routes - HTTP API for feature management
 */

import { Router } from 'express';
import { FeatureLoader } from '../../services/feature-loader.js';
import { validatePathParams, validateProjectPathExists } from '../../middleware/validate-paths.js';
import { createListHandler } from './routes/list.js';
import { createGetHandler } from './routes/get.js';
import { createCreateHandler } from './routes/create.js';
import { createUpdateHandler } from './routes/update.js';
import { createDeleteHandler } from './routes/delete.js';
import { createAgentOutputHandler } from './routes/agent-output.js';
import { createGenerateTitleHandler } from './routes/generate-title.js';

export function createFeaturesRoutes(featureLoader: FeatureLoader): Router {
  const router = Router();

  router.post(
    '/list',
    validatePathParams('projectPath'),
    validateProjectPathExists('projectPath'),
    createListHandler(featureLoader)
  );
  router.post(
    '/get',
    validatePathParams('projectPath'),
    validateProjectPathExists('projectPath'),
    createGetHandler(featureLoader)
  );
  router.post(
    '/create',
    validatePathParams('projectPath'),
    validateProjectPathExists('projectPath'),
    createCreateHandler(featureLoader)
  );
  router.post(
    '/update',
    validatePathParams('projectPath'),
    validateProjectPathExists('projectPath'),
    createUpdateHandler(featureLoader)
  );
  router.post(
    '/delete',
    validatePathParams('projectPath'),
    validateProjectPathExists('projectPath'),
    createDeleteHandler(featureLoader)
  );
  router.post(
    '/agent-output',
    validatePathParams('projectPath'),
    validateProjectPathExists('projectPath'),
    createAgentOutputHandler(featureLoader)
  );
  router.post('/generate-title', createGenerateTitleHandler());

  return router;
}
