import { API_ERROR_STATUS, type ApiErrorCode } from '@santiye/shared';

export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = API_ERROR_STATUS[code];
    this.details = details;
  }
}
