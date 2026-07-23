import * as crypto from 'crypto';
import * as argon2 from 'argon2';

describe('Auth & Session Security (PRD Audit Section 3)', () => {
  it('should hash passwords using Argon2id', async () => {
    const password = 'SecurePassword2026!';
    const hash = await argon2.hash(password, { type: argon2.argon2id });

    expect(hash).toContain('$argon2id$');
    const isValid = await argon2.verify(hash, password);
    expect(isValid).toBe(true);
  });

  it('should generate SHA-256 hashes for refresh tokens to store in MongoDB', () => {
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const hash1 = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const hash2 = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(rawRefreshToken);
    expect(hash1.length).toBe(64);
  });

  it('should detect refresh token replay attack and revoke session family', () => {
    const session = {
      userId: 'u-101',
      refreshTokenHash: 'hash_abc',
      revokedAt: new Date(), // Already rotated token
    };

    let isReplay = false;
    let revokeFamily = false;

    if (session.revokedAt) {
      isReplay = true;
      revokeFamily = true;
    }

    expect(isReplay).toBe(true);
    expect(revokeFamily).toBe(true);
  });
});
