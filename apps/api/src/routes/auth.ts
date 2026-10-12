import {
  loginSchema,
  logoutSchema,
  passwordChangeSchema,
  profileUpdateSchema,
  refreshTokenSchema,
} from '@santiye/shared';
import { Router } from 'express';
import { requireCustomer, requireCustomerUserId } from '../http/request-context.js';
import { sendSuccess } from '../http/respond.js';
import { customerAuth } from '../middleware/auth.js';
import type { CustomerAuthService } from '../services/customer-auth.js';

export function authRouter(service: CustomerAuthService): Router {
  const router = Router();

  router.post('/auth/login', async (req, res) => {
    sendSuccess(res, await service.login(loginSchema.parse(req.body), req.ip ?? ''));
  });

  router.post('/auth/refresh', async (req, res) => {
    sendSuccess(res, await service.refresh(refreshTokenSchema.parse(req.body).refreshToken));
  });

  router.post('/auth/logout', customerAuth(service, { access: 'session' }), async (req, res) => {
    const { refreshToken } = logoutSchema.parse(req.body ?? {});
    await service.logout(requireCustomerUserId(req), refreshToken);
    sendSuccess(res, null, { message: 'Çıkış yapıldı.' });
  });

  router.get('/auth/me', customerAuth(service, { access: 'self' }), (req, res) => {
    sendSuccess(res, service.me(requireCustomer(req)));
  });

  router.patch('/auth/me', customerAuth(service, { access: 'self' }), async (req, res) => {
    const input = profileUpdateSchema.parse(req.body);
    sendSuccess(res, await service.updateProfile(requireCustomer(req), input));
  });

  router.patch(
    '/auth/password',
    customerAuth(service, { access: 'self', allowPasswordChangeRequired: true }),
    async (req, res) => {
      const input = passwordChangeSchema.parse(req.body);
      const result = await service.changePassword(requireCustomer(req), input);
      sendSuccess(
        res,
        result.session ? { user: result.user, ...result.session } : { user: result.user },
        {
          message: result.session
            ? 'Şifreniz oluşturuldu.'
            : 'Şifreniz değişti. Bütün oturumlar kapatıldı; yeni şifrenizle giriş yapın.',
        },
      );
    },
  );

  return router;
}
