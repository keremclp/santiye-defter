import { jwtVerify, SignJWT } from 'jose';
import { randomToken, sha256Hex } from './crypto.js';
import type { Clock } from './clock.js';

/** Token türleri birbirinin yerine kullanılamaz (şartname 3, kimlik akışı madde 7). */
export type TokenAudience = 'customer' | 'platform' | 'platform-pending';

const ISSUER = 'santiye-hesap';
const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
/** Şartname 9.8: ürün sahibi ara token'ı 5 dakika geçerli. */
const PENDING_TTL_SECONDS = 5 * 60;

export interface VerifiedToken {
  subject: string;
  issuedAt: number;
}

export interface IssuedRefreshToken {
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

export class TokenError extends Error {}

export function hashRefreshToken(token: string): string {
  return sha256Hex(token);
}

export class TokenService {
  private readonly accessKey: Uint8Array;
  private readonly refreshKey: Uint8Array;

  constructor(
    secrets: { accessSecret: string; refreshSecret: string },
    private readonly clock: Clock,
  ) {
    this.accessKey = new TextEncoder().encode(secrets.accessSecret);
    this.refreshKey = new TextEncoder().encode(secrets.refreshSecret);
  }

  private nowSeconds(): number {
    return Math.floor(this.clock.now().getTime() / 1000);
  }

  private sign(
    audience: TokenAudience,
    subject: string,
    ttl: number,
    key: Uint8Array,
    jti?: string,
  ) {
    const issuedAt = this.nowSeconds();
    const jwt = new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(ISSUER)
      .setAudience(audience)
      .setSubject(subject)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + ttl);
    if (jti) jwt.setJti(jti);
    return jwt.sign(key);
  }

  private async verify(
    token: string,
    audience: TokenAudience,
    key: Uint8Array,
  ): Promise<VerifiedToken> {
    try {
      const { payload } = await jwtVerify(token, key, {
        issuer: ISSUER,
        audience,
        algorithms: ['HS256'],
        currentDate: this.clock.now(),
      });
      if (!payload.sub || typeof payload.iat !== 'number') throw new TokenError('Eksik token.');
      return { subject: payload.sub, issuedAt: payload.iat };
    } catch {
      throw new TokenError('Geçersiz token.');
    }
  }

  signAccess(audience: 'customer' | 'platform', subject: string): Promise<string> {
    return this.sign(audience, subject, ACCESS_TTL_SECONDS, this.accessKey);
  }

  signPending(subject: string): Promise<string> {
    return this.sign('platform-pending', subject, PENDING_TTL_SECONDS, this.accessKey);
  }

  async signRefresh(
    audience: 'customer' | 'platform',
    subject: string,
  ): Promise<IssuedRefreshToken> {
    const token = await this.sign(
      audience,
      subject,
      REFRESH_TTL_SECONDS,
      this.refreshKey,
      randomToken(16),
    );
    return {
      token,
      tokenHash: hashRefreshToken(token),
      expiresAt: new Date((this.nowSeconds() + REFRESH_TTL_SECONDS) * 1000),
    };
  }

  verifyAccess(token: string, audience: TokenAudience): Promise<VerifiedToken> {
    return this.verify(token, audience, this.accessKey);
  }

  verifyRefresh(token: string, audience: 'customer' | 'platform'): Promise<VerifiedToken> {
    return this.verify(token, audience, this.refreshKey);
  }
}

/**
 * Oturum düşürme anından önce verilmiş token geçersizdir. Saniye hassasiyetinde karşılaştırılır;
 * düşürme anı saniyeye aşağı yuvarlanarak saklandığından aynı saniyede verilen yeni token geçerlidir.
 */
export function isIssuedBeforeRevocation(issuedAt: number, tokensValidAfter: Date | null): boolean {
  return tokensValidAfter !== null && issuedAt * 1000 < tokensValidAfter.getTime();
}

/** Oturum düşürme anı: saniyeye aşağı yuvarlanır. */
export function revocationTime(clock: Clock): Date {
  return new Date(Math.floor(clock.now().getTime() / 1000) * 1000);
}
