import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from 'node:crypto';

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Okunurken karışmayan karakterlerden rastgele metin. */
export function randomReadable(length: number, alphabet: string): string {
  let result = '';
  for (let index = 0; index < length; index += 1) result += alphabet[randomInt(alphabet.length)];
  return result;
}

/** Anahtar metninden AES-256 anahtarı türetir (SHA-256). */
function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

/** AES-256-GCM: "v1.<iv>.<etiket>.<şifreli>" (base64url). */
export function encryptSecret(plaintext: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return ['v1', iv, cipher.getAuthTag(), encrypted]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
    .join('.');
}

export function decryptSecret(payload: string, secret: string): string {
  const [version, iv, tag, encrypted] = payload.split('.');
  if (version !== 'v1' || !iv || !tag || !encrypted) {
    throw new Error('Şifreli değer biçimi tanınmadı.');
  }
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
