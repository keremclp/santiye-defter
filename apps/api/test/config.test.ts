import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('geliştirmede boş değerler için yerel varsayılanları kullanır', () => {
    const config = loadConfig({ PORT: '', MONGODB_URI: '', WEB_ORIGIN: '' });

    expect(config).toEqual({
      nodeEnv: 'development',
      port: 3000,
      mongodbUri: 'mongodb://localhost:27017/santiye_hesap?replicaSet=rs0',
      webOrigin: 'http://localhost:5173',
    });
  });

  it('verilen değerleri kullanır', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      PORT: '8080',
      MONGODB_URI: 'mongodb://db.example:27017/app?replicaSet=rs0',
      WEB_ORIGIN: 'https://app.example',
    });

    expect(config).toEqual({
      nodeEnv: 'production',
      port: 8080,
      mongodbUri: 'mongodb://db.example:27017/app?replicaSet=rs0',
      webOrigin: 'https://app.example',
    });
  });

  it('üretimde zorunlu değerler eksikse başlatmaz', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/MONGODB_URI/);
  });

  it('geçersiz port değerini reddeder', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/PORT/);
  });
});
