import type { Request } from 'express';
import type { Types } from 'mongoose';
import type { PlatformAdminDocument } from '../models/platform-admin.js';
import type { CustomerContext } from '../services/customer-auth.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express istek tipinin genişletilmesi
  namespace Express {
    interface Request {
      /** Firma bağlamı: kullanıcı → firma → etkin hizmet durumu */
      customer?: CustomerContext;
      /** Yalnız oturum doğrulandı (çıkış için) */
      customerUserId?: Types.ObjectId;
      platformAdmin?: PlatformAdminDocument;
      pendingPlatformAdmin?: PlatformAdminDocument;
    }
  }
}

/** Rota parametresi; beklenmeyen biçimde boş döner (kimlik doğrulaması 404 verir). */
export function routeParam(req: Request, name: string): string {
  const value: unknown = req.params[name];
  return typeof value === 'string' ? value : '';
}

function missing(name: string): Error {
  return new Error(`${name} ara katmanı bu rotada çalışmadı.`);
}

export function requireCustomer(req: Request): CustomerContext {
  if (!req.customer) throw missing('customerAuth');
  return req.customer;
}

export function requireCustomerUserId(req: Request): Types.ObjectId {
  if (!req.customerUserId) throw missing('customerAuth');
  return req.customerUserId;
}

export function requirePlatformAdmin(req: Request): PlatformAdminDocument {
  if (!req.platformAdmin) throw missing('platformAuth');
  return req.platformAdmin;
}

export function requirePendingPlatformAdmin(req: Request): PlatformAdminDocument {
  if (!req.pendingPlatformAdmin) throw missing('platformPendingAuth');
  return req.pendingPlatformAdmin;
}
