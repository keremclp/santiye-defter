import { Router } from 'express';

export const healthRouter = Router();

// Şartname 10.9: /health gövdesi `{ success, status: "ok" }`.
healthRouter.get('/health', (_req, res) => {
  res.json({ success: true, status: 'ok' });
});
