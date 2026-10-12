import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/app.js';

const webOrigin = 'http://localhost:5173';
const { app } = buildTestApp({ config: { webOrigin } });

describe('GET /health', () => {
  it('{ success: true, status: "ok" } döner', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, status: 'ok' });
  });

  it('helmet güvenlik başlıklarını ekler', async () => {
    const res = await request(app).get('/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('CORS', () => {
  it('WEB_ORIGIN için izin başlığı döner', async () => {
    const res = await request(app).get('/health').set('Origin', webOrigin);

    expect(res.headers['access-control-allow-origin']).toBe(webOrigin);
  });

  it('ön kontrolde Idempotency-Key ve Authorization başlıklarına izin verir', async () => {
    const res = await request(app)
      .options('/health')
      .set('Origin', webOrigin)
      .set('Access-Control-Request-Method', 'POST');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-headers']).toContain('Idempotency-Key');
    expect(res.headers['access-control-allow-headers']).toContain('Authorization');
  });

  it('başka origin için izin başlığı dönmez', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://baska.example');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('bilinmeyen adres ve gövde hataları', () => {
  it('bilinmeyen adres 404 NOT_FOUND hata biçimiyle döner', async () => {
    const res = await request(app).get('/yok');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      message: 'İstenen adres bulunamadı.',
      code: 'NOT_FOUND',
    });
  });

  it('geçersiz JSON gövdesi 400 VALIDATION döner', async () => {
    const res = await request(app)
      .post('/health')
      .set('Content-Type', 'application/json')
      .send('{"bozuk":');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: 'İstek gövdesi geçerli JSON değil.',
      code: 'VALIDATION',
    });
  });
});
