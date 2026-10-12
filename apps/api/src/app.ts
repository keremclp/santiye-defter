import cors from 'cors';
import express, { type Router } from 'express';
import helmet from 'helmet';
import type { AppDeps } from './deps.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { authRouter } from './routes/auth.js';
import { healthRouter } from './routes/health.js';
import { platformRouter } from './routes/platform.js';
import { CustomerAuthService } from './services/customer-auth.js';
import { PlatformAuthService } from './services/platform-auth.js';
import { PlatformManagementService } from './services/platform-management.js';

export interface AppServices {
  customerAuth: CustomerAuthService;
  platformAuth: PlatformAuthService;
  platformManagement: PlatformManagementService;
}

export interface AppOptions {
  /** Ek rotalar; testlerde örnek uçları gerçek ara katmanlarla bağlamak için. */
  extraRoutes?: (services: AppServices) => Router;
}

export function createApp(deps: AppDeps, options: AppOptions = {}): express.Express {
  const app = express();
  const services: AppServices = {
    customerAuth: new CustomerAuthService(deps),
    platformAuth: new PlatformAuthService(deps),
    platformManagement: new PlatformManagementService(deps),
  };

  app.use(requestLogger(deps.logger));
  app.use(helmet());
  app.use(
    cors({
      origin: [deps.config.webOrigin],
      allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.use(healthRouter);
  app.use(authRouter(services.customerAuth));
  app.use(platformRouter(deps, services.platformAuth, services.platformManagement));
  if (options.extraRoutes) app.use(options.extraRoutes(services));

  app.use(notFoundHandler);
  app.use(errorHandler(deps.logger));

  return app;
}
