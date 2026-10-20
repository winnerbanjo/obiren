import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { ServiceUnavailableException } from '@nestjs/common';

export interface EncryptedHealthNote {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyId: string;
}

function encryptionKey(): Buffer {
  const configured = process.env.HEALTH_DATA_ENCRYPTION_KEY;
  if (!configured) {
    throw new ServiceUnavailableException('Sensitive-note encryption is not configured');
  }

  const key = /^[0-9a-f]{64}$/i.test(configured)
    ? Buffer.from(configured, 'hex')
    : Buffer.from(configured, 'base64');
  if (key.length !== 32) {
    throw new ServiceUnavailableException('Sensitive-note encryption key must be 32 bytes (64 hex or base64 encoded)');
  }
  return key;
}

export function encryptHealthNote(plaintext: string): EncryptedHealthNote {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    keyId: process.env.HEALTH_DATA_ENCRYPTION_KEY_ID || 'default',
  };
}

export function decryptHealthNote(encrypted: EncryptedHealthNote): string {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(encrypted.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
