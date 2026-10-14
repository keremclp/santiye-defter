import { describe, expect, it } from 'vitest';
import { BCRYPT_COST, loadConfig } from '../src/config.js';

const secrets = {
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  PLATFORM_TOTP_ENCRYPTION_KEY: 'c'.repeat(32),
};

const storage = {
  STORAGE_ENDPOINT: 'https://depo.example',
  STORAGE_BUCKET: 'belgeler',
  STORAGE_ACCESS_KEY: 'erisim-anahtari',
  STORAGE_SECRET_KEY: 'gizli-depo-anahtari',
};

describe('loadConfig', () => {
  it('geliştirmede boş değerler için yerel varsayılanları kullanır', () => {
    const config = loadConfig({
      ...secrets,
      PORT: '',
      MONGODB_URI: '',
      WEB_ORIGIN: '',
      APP_NAME: '',
    });

    expect(config).toMatchObject({
      nodeEnv: 'development',
      port: 3000,
      mongodbUri: 'mongodb://localhost:27017/santiye_hesap?replicaSet=rs0',
      webOrigin: 'http://localhost:5173',
      appName: 'Şantiye Hesap',
      platformBootstrap: null,
    });
  });

  it('verilen değerleri kullanır; bcrypt maliyeti 12', () => {
    const config = loadConfig({
      ...secrets,
      NODE_ENV: 'production',
      PORT: '8080',
      MONGODB_URI: 'mongodb://db.example:27017/app?replicaSet=rs0',
      WEB_ORIGIN: 'https://app.example',
      ...storage,
      PLATFORM_BOOTSTRAP_USERNAME: 'patron',
      PLATFORM_BOOTSTRAP_PASSWORD: 'Patron-Sifre-1',
    });

    expect(config).toMatchObject({
      nodeEnv: 'production',
      port: 8080,
      mongodbUri: 'mongodb://db.example:27017/app?replicaSet=rs0',
      webOrigin: 'https://app.example',
      jwtAccessSecret: secrets.JWT_ACCESS_SECRET,
      platformBootstrap: { username: 'patron', password: 'Patron-Sifre-1' },
      bcryptCost: 12,
      storage: {
        endpoint: 'https://depo.example',
        bucket: 'belgeler',
        accessKey: 'erisim-anahtari',
        secretKey: 'gizli-depo-anahtari',
      },
    });
    expect(BCRYPT_COST).toBe(12);
  });

  it('belge deposu üretimde zorunlu; geliştirmede boşsa ayarsız açılır, yarım ayar reddedilir', () => {
    const production = {
      ...secrets,
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://db.example:27017/app?replicaSet=rs0',
      WEB_ORIGIN: 'https://app.example',
    };
    expect(() => loadConfig(production)).toThrow(/STORAGE_ENDPOINT/);
    expect(loadConfig({ ...secrets, STORAGE_ENDPOINT: '', STORAGE_BUCKET: '' }).storage).toBeNull();
    expect(() => loadConfig({ ...secrets, STORAGE_BUCKET: 'belgeler' })).toThrow(
      /STORAGE_SECRET_KEY/,
    );
    let message = '';
    try {
      loadConfig({ ...secrets, STORAGE_SECRET_KEY: storage.STORAGE_SECRET_KEY });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toContain(storage.STORAGE_SECRET_KEY);
  });

  it('üretimde zorunlu değerler eksikse başlatmaz', () => {
    expect(() => loadConfig({ ...secrets, NODE_ENV: 'production' })).toThrow(/MONGODB_URI/);
  });

  it('gizli anahtarlar her ortamda zorunlu; değerleri hata metnine yazılmaz', () => {
    expect(() => loadConfig({})).toThrow(/JWT_ACCESS_SECRET/);
    const short = 'kisa-gizli-deger';
    let message = '';
    try {
      loadConfig({ ...secrets, JWT_ACCESS_SECRET: short });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/JWT_ACCESS_SECRET/);
    expect(message).not.toContain(short);
  });

  it('refresh imzası access imzasından farklı olmalı; TOTP anahtarı en az 32 bayt', () => {
    expect(() => loadConfig({ ...secrets, JWT_REFRESH_SECRET: secrets.JWT_ACCESS_SECRET })).toThrow(
      /JWT_REFRESH_SECRET/,
    );
    expect(() => loadConfig({ ...secrets, PLATFORM_TOTP_ENCRYPTION_KEY: 'x'.repeat(31) })).toThrow(
      /PLATFORM_TOTP_ENCRYPTION_KEY/,
    );
  });

  it('geçersiz port değerini reddeder', () => {
    expect(() => loadConfig({ ...secrets, PORT: 'abc' })).toThrow(/PORT/);
  });
});
