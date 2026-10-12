import bcrypt from 'bcryptjs';
import { randomReadable } from './crypto.js';

const TEMPORARY_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/** Şartname 9.8: geçici şifre 72 saat geçerli. */
export const TEMPORARY_PASSWORD_TTL_MS = 72 * 60 * 60 * 1000;

export function hashPassword(password: string, cost: number): Promise<string> {
  return bcrypt.hash(password, cost);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateTemporaryPassword(): string {
  return randomReadable(12, TEMPORARY_PASSWORD_ALPHABET);
}

// Bilinmeyen kullanıcı adında da aynı sürede cevap verilsin diye karşılaştırılan sahte hash.
const dummyHashes = new Map<number, Promise<string>>();

export async function verifyAgainstDummy(password: string, cost: number): Promise<false> {
  let hash = dummyHashes.get(cost);
  if (!hash) {
    hash = bcrypt.hash('şantiye-hesap-sahte-şifre', cost);
    dummyHashes.set(cost, hash);
  }
  await bcrypt.compare(password, await hash);
  return false;
}
