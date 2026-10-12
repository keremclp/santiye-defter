import type { RequestHandler } from 'express';
import '../http/request-context.js';
import type { CustomerAuthService } from '../services/customer-auth.js';
import type { PlatformAuthService } from '../services/platform-auth.js';
import type { AccessKind } from '../services/service-state.js';
import { bearerToken } from '../services/sessions.js';

export interface CustomerAuthOptions {
  /**
   * Erişim tablosundaki sütun (şartname 9.10). `auto`: GET/HEAD okuma, diğerleri kayıt
   * değiştirme. `session`: yalnız oturum doğrulanır (çıkış).
   */
  access: AccessKind | 'auto' | 'session';
  /** mustChangePassword varken yalnız şifre değişimi ve çıkış açıktır. */
  allowPasswordChangeRequired?: boolean;
}

export function customerAuth(
  service: CustomerAuthService,
  options: CustomerAuthOptions,
): RequestHandler {
  return async (req, _res, next) => {
    const user = await service.authenticate(bearerToken(req.get('authorization')));
    req.customerUserId = user._id;
    if (options.access !== 'session') {
      const kind =
        options.access === 'auto'
          ? req.method === 'GET' || req.method === 'HEAD'
            ? 'read'
            : 'write'
          : options.access;
      req.customer = await service.buildContext(user, kind, options.allowPasswordChangeRequired);
    }
    next();
  };
}

/** Ürün sahibi oturumu; müşteri token'ı ve ara token burada geçmez. */
export function platformAuth(service: PlatformAuthService): RequestHandler {
  return async (req, _res, next) => {
    req.platformAdmin = await service.authenticate(bearerToken(req.get('authorization')));
    next();
  };
}

/** Şifre adımından sonra verilen 5 dakikalık ara token. */
export function platformPendingAuth(service: PlatformAuthService): RequestHandler {
  return async (req, _res, next) => {
    req.pendingPlatformAdmin = await service.authenticatePending(
      bearerToken(req.get('authorization')),
    );
    next();
  };
}
