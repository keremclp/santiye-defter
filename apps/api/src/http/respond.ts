import type { ApiSuccess } from '@santiye/shared';
import type { Response } from 'express';

export function sendSuccess<T>(
  res: Response,
  data: T,
  options: { status?: number; message?: string } = {},
): void {
  const body: ApiSuccess<T> = { success: true, data };
  if (options.message !== undefined) body.message = options.message;
  res.status(options.status ?? 200).json(body);
}
