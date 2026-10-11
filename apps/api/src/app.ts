import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { silentLogger, type Logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { healthRouter } from './routes/health.js';

export interface AppOptions {
  webOrigin: string;
  logger?: Logger;
}

export function createApp({ webOrigin, logger = silentLogger }: AppOptions): express.Express {
  const app = express();

  app.use(requestLogger(logger));
  app.use(helmet());
  app.use(
    cors({
      origin: [webOrigin],
      allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.use(healthRouter);

  app.use(notFoundHandler);
  app.use(errorHandler(logger));

  return app;
}
