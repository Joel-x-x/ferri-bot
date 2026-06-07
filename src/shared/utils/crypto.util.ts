import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const SALT = 'ferri-bot-salt-v1';

// Cache derived key — ENCRYPTION_KEY and salt are constant for the process lifetime.
// scryptSync is intentionally expensive (~20-50ms); calling it per-operation would
// add latency to every credential lookup.
const keyCache = new Map<string, Buffer>();

function deriveKey(encryptionKey: string): Buffer {
  let key = keyCache.get(encryptionKey);
  if (!key) {
    key = scryptSync(encryptionKey, SALT, 32) as Buffer;
    keyCache.set(encryptionKey, key);
  }
  return key;
}

export function encrypt(text: string, encryptionKey: string): string {
  const iv = randomBytes(16);
  const key = deriveKey(encryptionKey);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final(),
  ]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(encryptedText: string, encryptionKey: string): string {
  const [ivHex, encryptedHex] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const key = deriveKey(encryptionKey);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
