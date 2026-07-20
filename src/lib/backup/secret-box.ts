import crypto from 'node:crypto';

/**
 * Symmetric encryption for secrets we must store but read back later — today
 * only the backup destination's password.
 *
 * AES-256-GCM with a key derived from **AUTH_SECRET** via HKDF, so no extra env
 * var is needed. Rotating AUTH_SECRET therefore invalidates anything encrypted
 * here; that is acceptable because the only consumer is a password the owner can
 * simply re-enter (and it must never be silently "recovered" with a weak key).
 *
 * Output format: `v1:` + base64url(iv | authTag | ciphertext).
 */

function key(): Buffer {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET must be set to encrypt or read stored secrets.');
  return Buffer.from(crypto.hkdfSync('sha256', s, 'veeey-secretbox', 'v1', 32));
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64url')}`;
}

/** Decrypt a value produced by {@link encryptSecret}. Returns null when it can't
 *  be read (rotated key, corrupt value) rather than throwing. */
export function decryptSecret(token: string | null | undefined): string | null {
  if (!token || !token.startsWith('v1:')) return null;
  try {
    const raw = Buffer.from(token.slice(3), 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
