// API yanıt biçimi ve hata kodları (şartname bölüm 3 ve 10.10).

export const API_ERROR_STATUS = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  PASSWORD_CHANGE_REQUIRED: 403,
  READ_ONLY: 403,
  ACCESS_CLOSED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  EXCESS_CONFIRMATION_REQUIRED: 409,
  HAS_DEPENDENCIES: 409,
  STORAGE_FULL: 409,
  USERNAME_EXISTS: 409,
  LIMIT_EXCEEDED: 422,
  IDEMPOTENCY_MISMATCH: 422,
  IDEMPOTENCY_EXPIRED: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
} as const satisfies Record<string, number>;

export type ApiErrorCode = keyof typeof API_ERROR_STATUS;

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiFailure {
  success: false;
  message: string;
  code: ApiErrorCode;
  details?: unknown;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
