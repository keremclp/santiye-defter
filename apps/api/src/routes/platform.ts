import {
  loginSchema,
  logoutSchema,
  platformCompanyCreateSchema,
  platformCompanyDeleteSchema,
  platformCompanyUpdateSchema,
  platformEndServiceSchema,
  platformExtendRetentionSchema,
  platformPasswordResetSchema,
  platformQuotaSchema,
  platformReasonSchema,
  platformSuspendSchema,
  platformUserCreateSchema,
  platformUserUpdateSchema,
  recoveryCodeSchema,
  refreshTokenSchema,
  totpCodeSchema,
} from '@santiye/shared';
import { Router } from 'express';
import { z } from 'zod';
import type { AppDeps } from '../deps.js';
import {
  requirePendingPlatformAdmin,
  requirePlatformAdmin,
  routeParam,
} from '../http/request-context.js';
import { sendSuccess } from '../http/respond.js';
import { platformAuth, platformPendingAuth } from '../middleware/auth.js';
import { hashRequest, runIdempotent } from '../services/idempotency.js';
import type { PlatformAuthService } from '../services/platform-auth.js';
import type { PlatformManagementService } from '../services/platform-management.js';
import { SERVICE_STATES } from '../services/service-state.js';

const companyListQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum(SERVICE_STATES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** `?preview=1`: hizmet sonu tarihlerini yazmadan gösterir. */
const previewQuerySchema = z.object({
  preview: z
    .enum(['0', '1', 'true', 'false'])
    .optional()
    .transform((value) => value === '1' || value === 'true'),
});

export function platformRouter(
  deps: AppDeps,
  auth: PlatformAuthService,
  management: PlatformManagementService,
): Router {
  const router = Router();
  const pending = platformPendingAuth(auth);
  const signedIn = platformAuth(auth);

  router.post('/platform/auth/login', async (req, res) => {
    sendSuccess(res, await auth.login(loginSchema.parse(req.body), req.ip ?? ''));
  });

  router.post('/platform/auth/totp/setup', pending, async (req, res) => {
    sendSuccess(res, await auth.startTotpSetup(requirePendingPlatformAdmin(req)));
  });

  router.post('/platform/auth/totp/verify', pending, async (req, res) => {
    const { code } = totpCodeSchema.parse(req.body);
    sendSuccess(res, await auth.verifyTotp(requirePendingPlatformAdmin(req), code));
  });

  router.post('/platform/auth/recovery', pending, async (req, res) => {
    const { recoveryCode } = recoveryCodeSchema.parse(req.body);
    sendSuccess(
      res,
      await auth.loginWithRecoveryCode(requirePendingPlatformAdmin(req), recoveryCode),
    );
  });

  router.post('/platform/auth/recovery-codes/regenerate', signedIn, async (req, res) => {
    const { code } = totpCodeSchema.parse(req.body);
    sendSuccess(res, await auth.regenerateRecoveryCodes(requirePlatformAdmin(req), code));
  });

  router.post('/platform/auth/refresh', async (req, res) => {
    sendSuccess(res, await auth.refresh(refreshTokenSchema.parse(req.body).refreshToken));
  });

  router.post('/platform/auth/logout', signedIn, async (req, res) => {
    const { refreshToken } = logoutSchema.parse(req.body ?? {});
    await auth.logout(requirePlatformAdmin(req)._id, refreshToken);
    sendSuccess(res, null, { message: 'Çıkış yapıldı.' });
  });

  router.get('/platform/companies', signedIn, async (req, res) => {
    sendSuccess(res, await management.listCompanies(companyListQuerySchema.parse(req.query)));
  });

  router.post('/platform/companies', signedIn, async (req, res) => {
    const admin = requirePlatformAdmin(req);
    const input = platformCompanyCreateSchema.parse(req.body);
    const outcome = await runIdempotent({
      keyHeader: req.get('idempotency-key'),
      scope: { companyId: null, userId: admin._id },
      requestHash: hashRequest(req),
      clock: deps.clock,
      execute: (session) => management.createCompany(admin._id, input, session),
      replay: (ref) => management.replayCompany(ref),
    });
    sendSuccess(res, outcome.data, { status: outcome.status, message: outcome.message });
  });

  router.get('/platform/companies/:id', signedIn, async (req, res) => {
    sendSuccess(res, await management.getCompany(routeParam(req, 'id')));
  });

  router.post('/platform/companies/:id/users', signedIn, async (req, res) => {
    const admin = requirePlatformAdmin(req);
    const input = platformUserCreateSchema.parse(req.body);
    const outcome = await runIdempotent({
      keyHeader: req.get('idempotency-key'),
      scope: { companyId: null, userId: admin._id },
      requestHash: hashRequest(req),
      clock: deps.clock,
      execute: (session) => management.createUser(admin._id, routeParam(req, 'id'), input, session),
      replay: (ref) => management.replayUser(ref),
    });
    sendSuccess(res, outcome.data, { status: outcome.status, message: outcome.message });
  });

  router.patch('/platform/companies/:id', signedIn, async (req, res) => {
    const input = platformCompanyUpdateSchema.parse(req.body);
    sendSuccess(
      res,
      await management.updateCompany(requirePlatformAdmin(req)._id, routeParam(req, 'id'), input),
    );
  });

  router.post('/platform/companies/:id/quota', signedIn, async (req, res) => {
    const input = platformQuotaSchema.parse(req.body);
    sendSuccess(
      res,
      await management.setQuota(requirePlatformAdmin(req)._id, routeParam(req, 'id'), input),
    );
  });

  router.post('/platform/companies/:id/suspend', signedIn, async (req, res) => {
    const input = platformSuspendSchema.parse(req.body);
    sendSuccess(
      res,
      await management.setSuspended(requirePlatformAdmin(req)._id, routeParam(req, 'id'), input),
    );
  });

  router.post('/platform/companies/:id/end-service', signedIn, async (req, res) => {
    const { preview } = previewQuerySchema.parse(req.query);
    const input = platformEndServiceSchema.parse(req.body);
    if (!preview) platformReasonSchema.parse(req.body);
    sendSuccess(
      res,
      await management.endService(
        requirePlatformAdmin(req)._id,
        routeParam(req, 'id'),
        input,
        preview,
      ),
    );
  });

  router.post('/platform/companies/:id/reopen', signedIn, async (req, res) => {
    const { reason } = platformReasonSchema.parse(req.body);
    sendSuccess(
      res,
      await management.reopen(requirePlatformAdmin(req)._id, routeParam(req, 'id'), reason),
    );
  });

  router.post('/platform/companies/:id/extend-retention', signedIn, async (req, res) => {
    const input = platformExtendRetentionSchema.parse(req.body);
    sendSuccess(
      res,
      await management.extendRetention(requirePlatformAdmin(req)._id, routeParam(req, 'id'), input),
    );
  });

  // Silme arka planda sürer; durum firma detayındaki `deletionStatus` ile izlenir.
  router.post('/platform/companies/:id/delete', signedIn, async (req, res) => {
    const input = platformCompanyDeleteSchema.parse(req.body);
    sendSuccess(
      res,
      await management.requestDeletion(requirePlatformAdmin(req)._id, routeParam(req, 'id'), input),
      { status: 202 },
    );
  });

  router.patch('/platform/users/:id', signedIn, async (req, res) => {
    const input = platformUserUpdateSchema.parse(req.body);
    sendSuccess(
      res,
      await management.updateUser(requirePlatformAdmin(req)._id, routeParam(req, 'id'), input),
    );
  });

  router.post('/platform/users/:id/reset-password', signedIn, async (req, res) => {
    const { reason } = platformPasswordResetSchema.parse(req.body);
    sendSuccess(
      res,
      await management.resetPassword(requirePlatformAdmin(req)._id, routeParam(req, 'id'), reason),
    );
  });

  return router;
}
