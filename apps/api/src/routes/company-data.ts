// Firma verisi uçları (şartname 10.3–10.9). Hepsi firma bağlamından geçer; companyId
// istemciden değil oturumdaki kullanıcıdan gelir.

import {
  agreementAmountSchema,
  agreementCancelSchema,
  agreementCreateSchema,
  agreementDueDateSchema,
  agreementUpdateSchema,
  agreementWorkStatusSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  companyUpdateSchema,
  documentUploadIntentSchema,
  partyCreateSchema,
  partyUpdateSchema,
  pinSchema,
  projectArchiveSchema,
  projectCompleteSchema,
  projectCreateSchema,
  projectReactivateSchema,
  projectUpdateSchema,
  recordChangeSchema,
  refundCreateSchema,
  transactionCorrectionSchema,
  transactionCreateSchema,
  transactionRestoreSchema,
} from '@santiye/shared';
import { Router, type Response } from 'express';
import { z } from 'zod';
import type { AppDeps } from '../deps.js';
import { requireCustomer, routeParam } from '../http/request-context.js';
import { sendSuccess } from '../http/respond.js';
import { customerAuth } from '../middleware/auth.js';
import { AgreementService, agreementListQuerySchema } from '../services/agreements.js';
import { CategoryService } from '../services/categories.js';
import { CompanyService } from '../services/company.js';
import type { CustomerAuthService } from '../services/customer-auth.js';
import { DocumentService } from '../services/documents.js';
import type { IdempotentOutcome } from '../services/idempotency.js';
import {
  deletedQuerySchema,
  duesQuerySchema,
  OverviewService,
  searchQuerySchema,
} from '../services/overview.js';
import { PartyService, partyListQuerySchema } from '../services/parties.js';
import { ProjectService, projectListQuerySchema } from '../services/projects.js';
import { runCompanyIdempotent, runOptionallyIdempotent } from '../services/records.js';
import { TransactionService, transactionListQuerySchema } from '../services/transactions.js';

function respond(res: Response, outcome: IdempotentOutcome) {
  sendSuccess(res, outcome.data, { status: outcome.status, message: outcome.message });
}

export function companyDataRouter(deps: AppDeps, customerAuthService: CustomerAuthService): Router {
  const router = Router();
  const auth = customerAuth(customerAuthService, { access: 'auto' });
  const company = new CompanyService(deps);
  const categories = new CategoryService(deps);
  const projects = new ProjectService(deps);
  const parties = new PartyService(deps);
  const agreements = new AgreementService(deps);
  const transactions = new TransactionService(deps);
  const overview = new OverviewService(deps, transactions);
  const documents = new DocumentService(deps);
  const id = (req: Parameters<typeof routeParam>[0]) => routeParam(req, 'id');

  // ── Firma ve kategoriler (10.3) ──────────────────────────────────────────────
  router.get('/company', auth, async (req, res) => {
    sendSuccess(res, await company.get(requireCustomer(req)));
  });
  router.get('/company/users', auth, async (req, res) => {
    sendSuccess(res, await company.users(requireCustomer(req)));
  });
  router.patch('/company', auth, async (req, res) => {
    sendSuccess(
      res,
      await company.update(requireCustomer(req), companyUpdateSchema.parse(req.body)),
    );
  });

  router.get('/categories', auth, async (req, res) => {
    const includeInactive = req.query.includeInactive === 'true';
    sendSuccess(res, await categories.list(requireCustomer(req), includeInactive));
  });
  router.post('/categories', auth, async (req, res) => {
    const context = requireCustomer(req);
    const { name } = categoryCreateSchema.parse(req.body);
    respond(
      res,
      await runOptionallyIdempotent(
        deps,
        req,
        context,
        (session) => categories.create(context, name, session),
        (ref, status) => categories.replay(context, ref, status),
      ),
    );
  });
  router.patch('/categories/:id', auth, async (req, res) => {
    sendSuccess(
      res,
      await categories.update(requireCustomer(req), id(req), categoryUpdateSchema.parse(req.body)),
    );
  });

  // ── Şantiyeler (10.4) ────────────────────────────────────────────────────────
  router.get('/projects', auth, async (req, res) => {
    sendSuccess(
      res,
      await projects.list(requireCustomer(req), projectListQuerySchema.parse(req.query)),
    );
  });
  router.post('/projects', auth, async (req, res) => {
    const context = requireCustomer(req);
    const input = projectCreateSchema.parse(req.body);
    respond(
      res,
      await runOptionallyIdempotent(
        deps,
        req,
        context,
        (session) => projects.create(context, input, session),
        (ref, status) => projects.replay(context, ref, status),
      ),
    );
  });
  router.get('/projects/:id', auth, async (req, res) => {
    sendSuccess(res, await projects.get(requireCustomer(req), id(req)));
  });
  router.get('/projects/:id/summary', auth, async (req, res) => {
    sendSuccess(res, await projects.summary(requireCustomer(req), id(req)));
  });
  router.patch('/projects/:id', auth, async (req, res) => {
    sendSuccess(
      res,
      await projects.update(requireCustomer(req), id(req), projectUpdateSchema.parse(req.body)),
    );
  });
  router.post('/projects/:id/complete', auth, async (req, res) => {
    sendSuccess(
      res,
      await projects.complete(requireCustomer(req), id(req), projectCompleteSchema.parse(req.body)),
    );
  });
  router.post('/projects/:id/reactivate', auth, async (req, res) => {
    sendSuccess(
      res,
      await projects.reactivate(
        requireCustomer(req),
        id(req),
        projectReactivateSchema.parse(req.body),
      ),
    );
  });
  router.post('/projects/:id/archive', auth, async (req, res) => {
    sendSuccess(
      res,
      await projects.archive(requireCustomer(req), id(req), projectArchiveSchema.parse(req.body)),
    );
  });
  router.post('/projects/:id/pin', auth, async (req, res) => {
    sendSuccess(
      res,
      await projects.pin(requireCustomer(req), id(req), pinSchema.parse(req.body).pinned),
    );
  });
  router.delete('/projects/:id', auth, async (req, res) => {
    sendSuccess(
      res,
      await projects.remove(requireCustomer(req), id(req), recordChangeSchema.parse(req.body)),
    );
  });
  router.post('/projects/:id/restore', auth, async (req, res) => {
    sendSuccess(
      res,
      await projects.restore(requireCustomer(req), id(req), recordChangeSchema.parse(req.body)),
    );
  });

  // ── Kişiler (10.5) ───────────────────────────────────────────────────────────
  router.get('/parties', auth, async (req, res) => {
    sendSuccess(
      res,
      await parties.list(requireCustomer(req), partyListQuerySchema.parse(req.query)),
    );
  });
  router.get('/parties/suggest', auth, async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    sendSuccess(res, await parties.suggest(requireCustomer(req), q));
  });
  router.post('/parties', auth, async (req, res) => {
    const context = requireCustomer(req);
    const input = partyCreateSchema.parse(req.body);
    respond(
      res,
      await runOptionallyIdempotent(
        deps,
        req,
        context,
        (session) => parties.create(context, input, session),
        (ref, status) => parties.replay(context, ref, status),
      ),
    );
  });
  router.get('/parties/:id', auth, async (req, res) => {
    sendSuccess(res, await parties.get(requireCustomer(req), id(req)));
  });
  router.get('/parties/:id/statement', auth, async (req, res) => {
    sendSuccess(res, await parties.statement(requireCustomer(req), id(req)));
  });
  router.patch('/parties/:id', auth, async (req, res) => {
    sendSuccess(
      res,
      await parties.update(requireCustomer(req), id(req), partyUpdateSchema.parse(req.body)),
    );
  });
  router.post('/parties/:id/pin', auth, async (req, res) => {
    sendSuccess(
      res,
      await parties.pin(requireCustomer(req), id(req), pinSchema.parse(req.body).pinned),
    );
  });
  router.delete('/parties/:id', auth, async (req, res) => {
    sendSuccess(
      res,
      await parties.remove(requireCustomer(req), id(req), recordChangeSchema.parse(req.body)),
    );
  });
  router.post('/parties/:id/restore', auth, async (req, res) => {
    sendSuccess(
      res,
      await parties.restore(requireCustomer(req), id(req), recordChangeSchema.parse(req.body)),
    );
  });

  // ── İşlemler (10.6) ──────────────────────────────────────────────────────────
  router.get('/transactions', auth, async (req, res) => {
    sendSuccess(
      res,
      await transactions.list(requireCustomer(req), transactionListQuerySchema.parse(req.query)),
    );
  });
  router.get('/transactions/suggestions', auth, async (req, res) => {
    const kind = z.enum(['income', 'expense']).optional().parse(req.query.kind);
    sendSuccess(res, await transactions.suggestions(requireCustomer(req), kind));
  });
  router.post('/transactions', auth, async (req, res) => {
    const context = requireCustomer(req);
    const input = transactionCreateSchema.parse(req.body);
    respond(
      res,
      await runCompanyIdempotent(
        deps,
        req,
        context,
        (session) => transactions.create(context, input, session),
        (ref, status) => transactions.replay(context, ref, status),
      ),
    );
  });
  router.get('/transactions/:id', auth, async (req, res) => {
    sendSuccess(res, await transactions.get(requireCustomer(req), id(req)));
  });
  router.patch('/transactions/:id', auth, async (req, res) => {
    sendSuccess(
      res,
      await transactions.correct(
        requireCustomer(req),
        id(req),
        transactionCorrectionSchema.parse(req.body),
      ),
    );
  });
  router.post('/transactions/:id/refunds', auth, async (req, res) => {
    const context = requireCustomer(req);
    const input = refundCreateSchema.parse(req.body);
    const sourceId = id(req);
    respond(
      res,
      await runCompanyIdempotent(
        deps,
        req,
        context,
        (session) => transactions.refund(context, sourceId, input, session),
        (ref, status) => transactions.replay(context, ref, status),
      ),
    );
  });
  router.delete('/transactions/:id', auth, async (req, res) => {
    sendSuccess(
      res,
      await transactions.remove(requireCustomer(req), id(req), recordChangeSchema.parse(req.body)),
    );
  });
  router.post('/transactions/:id/restore', auth, async (req, res) => {
    sendSuccess(
      res,
      await transactions.restore(
        requireCustomer(req),
        id(req),
        transactionRestoreSchema.parse(req.body),
      ),
    );
  });
  router.post('/transactions/:id/duplicate', auth, async (req, res) => {
    sendSuccess(res, await transactions.duplicateDraft(requireCustomer(req), id(req)));
  });
  router.get('/idempotency/:key', auth, async (req, res) => {
    sendSuccess(
      res,
      await overview.idempotencyStatus(requireCustomer(req), routeParam(req, 'key')),
    );
  });

  // ── Anlaşmalar (10.7) ────────────────────────────────────────────────────────
  router.get('/agreements', auth, async (req, res) => {
    sendSuccess(
      res,
      await agreements.list(requireCustomer(req), agreementListQuerySchema.parse(req.query)),
    );
  });
  router.post('/agreements', auth, async (req, res) => {
    const context = requireCustomer(req);
    const input = agreementCreateSchema.parse(req.body);
    respond(
      res,
      await runCompanyIdempotent(
        deps,
        req,
        context,
        (session) => agreements.create(context, input, session),
        (ref, status) => agreements.replay(context, ref, status),
      ),
    );
  });
  router.get('/agreements/:id', auth, async (req, res) => {
    sendSuccess(res, await agreements.get(requireCustomer(req), id(req)));
  });
  router.patch('/agreements/:id', auth, async (req, res) => {
    sendSuccess(
      res,
      await agreements.update(requireCustomer(req), id(req), agreementUpdateSchema.parse(req.body)),
    );
  });
  router.post('/agreements/:id/amount', auth, async (req, res) => {
    const preview = req.query.preview === '1' || req.query.preview === 'true';
    const input = preview
      ? agreementAmountSchema
          .pick({ newAmount: true })
          .extend({ reason: z.string().default(''), expectedUpdatedAt: z.string().default('') })
          .parse(req.body)
      : agreementAmountSchema.parse(req.body);
    sendSuccess(res, await agreements.changeAmount(requireCustomer(req), id(req), input, preview));
  });
  router.post('/agreements/:id/due-date', auth, async (req, res) => {
    sendSuccess(
      res,
      await agreements.changeDueDate(
        requireCustomer(req),
        id(req),
        agreementDueDateSchema.parse(req.body),
      ),
    );
  });
  router.post('/agreements/:id/work-status', auth, async (req, res) => {
    sendSuccess(
      res,
      await agreements.setWorkStatus(
        requireCustomer(req),
        id(req),
        agreementWorkStatusSchema.parse(req.body),
      ),
    );
  });
  router.post('/agreements/:id/cancel', auth, async (req, res) => {
    sendSuccess(
      res,
      await agreements.cancel(requireCustomer(req), id(req), agreementCancelSchema.parse(req.body)),
    );
  });
  router.delete('/agreements/:id', auth, async (req, res) => {
    sendSuccess(
      res,
      await agreements.remove(requireCustomer(req), id(req), recordChangeSchema.parse(req.body)),
    );
  });
  router.post('/agreements/:id/restore', auth, async (req, res) => {
    sendSuccess(
      res,
      await agreements.restore(requireCustomer(req), id(req), recordChangeSchema.parse(req.body)),
    );
  });

  // ── Belgeler (10.8) ──────────────────────────────────────────────────────────
  router.post('/documents/upload-intent', auth, async (req, res) => {
    const context = requireCustomer(req);
    const input = documentUploadIntentSchema.parse(req.body);
    respond(
      res,
      await runOptionallyIdempotent(
        deps,
        req,
        context,
        (session) => documents.uploadIntent(context, input, session),
        (ref, status) => documents.replay(context, ref, status),
      ),
    );
  });
  router.post('/documents/:id/complete', auth, async (req, res) => {
    sendSuccess(res, await documents.complete(requireCustomer(req), id(req)));
  });
  router.get('/documents/:id/download', auth, async (req, res) => {
    sendSuccess(res, await documents.download(requireCustomer(req), id(req), 'download'));
  });
  router.get('/documents/:id/preview', auth, async (req, res) => {
    sendSuccess(res, await documents.download(requireCustomer(req), id(req), 'preview'));
  });
  router.delete('/documents/:id', auth, async (req, res) => {
    sendSuccess(
      res,
      await documents.remove(requireCustomer(req), id(req), recordChangeSchema.parse(req.body)),
    );
  });
  router.post('/documents/:id/restore', auth, async (req, res) => {
    sendSuccess(
      res,
      await documents.restore(requireCustomer(req), id(req), recordChangeSchema.parse(req.body)),
    );
  });

  // ── Pano, vade, arama, silinenler (10.9) ─────────────────────────────────────
  router.get('/dashboard', auth, async (req, res) => {
    sendSuccess(res, await overview.dashboard(requireCustomer(req)));
  });
  router.get('/dues', auth, async (req, res) => {
    sendSuccess(res, await overview.dues(requireCustomer(req), duesQuerySchema.parse(req.query)));
  });
  router.get('/search', auth, async (req, res) => {
    sendSuccess(
      res,
      await overview.search(requireCustomer(req), searchQuerySchema.parse(req.query)),
    );
  });
  router.get('/search/history', auth, async (req, res) => {
    sendSuccess(res, await overview.history(requireCustomer(req)));
  });
  // Arama geçmişini temizlemek kullanıcının kendi tercihidir; kayıt değiştirme sayılmaz.
  router.delete(
    '/search/history',
    customerAuth(customerAuthService, { access: 'read' }),
    async (req, res) => {
      await overview.clearHistory(requireCustomer(req));
      sendSuccess(res, null, { message: 'Arama geçmişi temizlendi.' });
    },
  );
  router.get('/deleted', auth, async (req, res) => {
    sendSuccess(
      res,
      await overview.deleted(requireCustomer(req), deletedQuerySchema.parse(req.query)),
    );
  });

  return router;
}
