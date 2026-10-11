import { describe, expect, it } from 'vitest';
import { API_ERROR_STATUS } from '../src/index.js';

describe('API_ERROR_STATUS', () => {
  it('şartname 10.10 hata kodu tablosuyla birebir aynı', () => {
    expect(API_ERROR_STATUS).toEqual({
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
    });
  });
});
