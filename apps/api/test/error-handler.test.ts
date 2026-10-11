import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AppError } from '../src/http/errors.js';
import { sendSuccess } from '../src/http/respond.js';
import type { Logger } from '../src/lib/logger.js';
import { errorHandler } from '../src/middleware/error-handler.js';

function buildApp(logger: Logger) {
  const app = express();
  app.get('/basari', (_req, res) => {
    sendSuccess(res, { id: 1 });
  });
  app.post('/olusturuldu', (_req, res) => {
    sendSuccess(res, { id: 2 }, { status: 201, message: 'Kaydedildi' });
  });
  app.get('/uygulama-hatasi', () => {
    throw new AppError('CONFLICT', 'Kayıt başka bir yerde güncellendi', { current: { id: 1 } });
  });
  app.get('/dogrulama-hatasi', () => {
    z.object({ name: z.string() }).parse({});
  });
  app.get('/async-hata', async () => {
    await Promise.resolve();
    throw new AppError('READ_ONLY', 'Görüntüleme döneminde değişiklik yapılamaz.');
  });
  app.get('/beklenmeyen', () => {
    throw new Error('gizli iç ayrıntı');
  });
  app.use(errorHandler(logger));
  return app;
}

function createSpyLogger() {
  return { info: vi.fn(), error: vi.fn() } satisfies Logger;
}

describe('başarılı yanıt biçimi', () => {
  it('{ success: true, data } döner', async () => {
    const res = await request(buildApp(createSpyLogger())).get('/basari');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { id: 1 } });
  });

  it('durum kodu ve mesaj eklenebilir', async () => {
    const res = await request(buildApp(createSpyLogger())).post('/olusturuldu');

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, data: { id: 2 }, message: 'Kaydedildi' });
  });
});

describe('merkezi hata işleyici', () => {
  it('AppError kodunu, HTTP durumunu ve ayrıntıyı taşır', async () => {
    const res = await request(buildApp(createSpyLogger())).get('/uygulama-hatasi');

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      message: 'Kayıt başka bir yerde güncellendi',
      code: 'CONFLICT',
      details: { current: { id: 1 } },
    });
  });

  it('async rota hatasını yakalar', async () => {
    const res = await request(buildApp(createSpyLogger())).get('/async-hata');

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, code: 'READ_ONLY' });
  });

  it('Zod hatasını 400 VALIDATION ve alan ayrıntısıyla döner', async () => {
    const res = await request(buildApp(createSpyLogger())).get('/dogrulama-hatasi');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      message: 'Eksik veya hatalı bilgi.',
      code: 'VALIDATION',
      details: { issues: [{ path: 'name' }] },
    });
  });

  it('beklenmeyen hatada iç ayrıntıyı sızdırmadan 500 INTERNAL döner ve loglar', async () => {
    const logger = createSpyLogger();
    const res = await request(buildApp(logger)).get('/beklenmeyen');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      success: false,
      message: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.',
      code: 'INTERNAL',
    });
    expect(JSON.stringify(res.body)).not.toContain('gizli iç ayrıntı');
    expect(logger.error).toHaveBeenCalledOnce();
  });
});
