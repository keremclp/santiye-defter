import type { ApiFailure } from '@santiye/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../http/errors.js';
import type { Logger } from '../lib/logger.js';

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError('NOT_FOUND', 'İstenen adres bulunamadı.'));
};

// express.json() hataları (body-parser) `type` ve `status` alanı taşır.
function isBodyParserError(err: unknown): err is { type: string; status: number } {
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { type?: unknown }).type === 'string' &&
    typeof (err as { status?: unknown }).status === 'number'
  );
}

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) {
    return new AppError('VALIDATION', 'Eksik veya hatalı bilgi.', {
      issues: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }
  if (isBodyParserError(err) && err.status < 500) {
    return new AppError(
      'VALIDATION',
      err.type === 'entity.parse.failed'
        ? 'İstek gövdesi geçerli JSON değil.'
        : 'İstek gövdesi işlenemedi.',
    );
  }
  return new AppError('INTERNAL', 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.');
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    const appError = toAppError(err);
    if (appError.code === 'INTERNAL') {
      logger.error('beklenmeyen hata', {
        method: req.method,
        path: req.originalUrl.split('?')[0],
        error:
          err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
      });
    }

    const body: ApiFailure = { success: false, message: appError.message, code: appError.code };
    if (appError.details !== undefined) body.details = appError.details;
    res.status(appError.status).json(body);
  };
}
