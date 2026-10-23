import * as request from 'supertest';
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import mongoose from 'mongoose';
import { OAuth2Client } from 'google-auth-library';
import { createTestApp, registerAndLogin, uniqueEmail, getDb } from './helpers';
import { GoogleTokenVerifier } from '../src/modules/auth/google-token-verifier';
import { resetEnvCache } from '../src/config/env.validation';
import { totpCodeForCounter } from '../src/common/auth/totp';

const currentTotp = (secret: string) => totpCodeForCounter(secret, Math.floor(Date.now() / 1000 / 30));

const fakeIdentity = (overrides: Partial<{ subject: string; email: string; emailVerified: boolean; firstName: string; lastName: string }> = {}) => ({
  subject: `google-sub-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  email: uniqueEmail('google'),
  emailVerified: true,
  firstName: 'Ada',
  lastName: 'Obi',
  ...overrides,
});

describe('Google sign-in', () => {
  describe('token verification (no network)', () => {
    afterEach(() => {
      jest.restoreAllMocks();
      delete process.env.GOOGLE_CLIENT_ID;
      resetEnvCache();
    });

    it('fails closed with 503 when no client ID is configured', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      resetEnvCache();

      const error = await new GoogleTokenVerifier().verify('some-id-token').catch((e) => e);

      expect(error.getStatus()).toBe(503);
      expect(error.getResponse().error.code).toBe('PROVIDER_UNAVAILABLE');
    });

    it('rejects an unverifiable token against the configured audiences', async () => {
      process.env.GOOGLE_CLIENT_ID = 'web-client.apps.googleusercontent.com, android-client.apps.googleusercontent.com';
      resetEnvCache();
      const spy = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken') as jest.Mock;
      spy.mockRejectedValueOnce(new Error('Wrong recipient, payload audience != requiredAudience'));

      const error = await new GoogleTokenVerifier().verify('not-a-real-token').catch((e) => e);

      expect(error.getStatus()).toBe(401);
      expect(error.getResponse().error.code).toBe('AUTH_GOOGLE_TOKEN_INVALID');
      expect(spy).toHaveBeenCalledWith({
        idToken: 'not-a-real-token',
        audience: ['web-client.apps.googleusercontent.com', 'android-client.apps.googleusercontent.com'],
      });
    });

    it('normalises a verified payload and never trusts extra claims', async () => {
      process.env.GOOGLE_CLIENT_ID = 'web-client.apps.googleusercontent.com';
      resetEnvCache();
      const spy = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken') as jest.Mock;
      spy.mockResolvedValueOnce({
        getPayload: () => ({
          sub: 'google-123',
          email: '  Maya@Example.com ',
          email_verified: true,
          given_name: 'Maya',
          family_name: 'Okafor',
          // A client cannot smuggle a role through Google claims.
          roles: ['super_admin'],
        }),
      });

      const identity = await new GoogleTokenVerifier().verify('real-looking-token');

      expect(identity).toEqual({
        subject: 'google-123',
        email: 'maya@example.com',
        emailVerified: true,
        firstName: 'Maya',
        lastName: 'Okafor',
      });
      expect(identity).not.toHaveProperty('roles');
    });
  });

  describe('POST /auth/google (e2e)', () => {
    let app: INestApplication;
    let verifier: { verify: jest.Mock };

    const signIn = (idToken = 'stub-google-id-token') =>
      request(app.getHttpServer()).post('/api/v1/auth/google').send({ idToken, platform: 'web' });

    beforeAll(async () => {
      // Google sign-in is optional configuration; these tests exercise the
      // account rules, not the network verifier (covered above).
      delete process.env.GOOGLE_CLIENT_ID;
      resetEnvCache();
      verifier = { verify: jest.fn() };
      app = await createTestApp({ overrides: [{ provide: GoogleTokenVerifier, useValue: verifier }] });
    });

    afterAll(async () => {
      await mongoose.disconnect().catch(() => undefined);
      await app.close();
    });

    beforeEach(() => {
      verifier.verify.mockReset();
    });

    it('creates an active, email-verified account for a new Google identity', async () => {
      const identity = fakeIdentity();
      verifier.verify.mockResolvedValueOnce(identity);

      const res = await signIn();

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe(identity.email);
      expect(res.body.data.user.status).toBe('active');
      expect(res.body.data.user.emailVerified).toBe(true);
      expect(res.body.data.tokens.accessToken).toBeTruthy();
      expect(res.body.data.tokens.refreshToken).toBeTruthy();
      expect(String(res.headers['set-cookie'] ?? '')).toContain('obiren_refresh');

      const stored = await getDb(app).collection('users').findOne({ emailNormalized: identity.email });
      expect(stored!.googleSub).toBe(identity.subject);
      expect(stored!.authProviders).toEqual(['google']);
      expect(stored!.passwordHash).toBeUndefined();
      expect(stored!.emailVerifiedAt).toBeInstanceOf(Date);

      const profile = await getDb(app).collection('user_profiles').findOne({ userId: stored!._id });
      expect(profile!.displayName).toBe('Ada Obi');
    });

    it('reuses the same account on subsequent sign-ins', async () => {
      const identity = fakeIdentity();
      verifier.verify.mockResolvedValue(identity);

      const first = await signIn();
      const second = await signIn();

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body.data.user.id).toBe(first.body.data.user.id);

      const count = await getDb(app).collection('users').countDocuments({ googleSub: identity.subject });
      expect(count).toBe(1);
    });

    it('refuses password sign-in for a Google-only account instead of failing with 500', async () => {
      const identity = fakeIdentity();
      verifier.verify.mockResolvedValueOnce(identity);
      await signIn();

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: identity.email, password: 'WhateverPass1', platform: 'web' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('links to an existing email-verified local account', async () => {
      const email = uniqueEmail('link');
      const registered = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'SecurePass123', firstName: 'Ada', lastName: 'Obi', countryCode: 'NG' });
      expect(registered.status).toBe(201);
      const userId = registered.body.data.userId as string;

      const verified = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: registered.body.data.verificationToken });
      expect(verified.status).toBe(200);

      const identity = fakeIdentity({ email });
      verifier.verify.mockResolvedValueOnce(identity);
      const linked = await signIn();

      expect(linked.status).toBe(200);
      expect(linked.body.data.user.id).toBe(userId);

      const stored = await getDb(app).collection('users').findOne({ emailNormalized: email });
      expect(stored!.googleSub).toBe(identity.subject);
      expect(stored!.authProviders.sort()).toEqual(['google', 'password']);
      // No second account or duplicate profile was created.
      expect(await getDb(app).collection('users').countDocuments({ emailNormalized: email })).toBe(1);
      expect(await getDb(app).collection('user_profiles').countDocuments({ userId: stored!._id })).toBe(1);

      // The password keeps working after linking.
      const passwordLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'SecurePass123', platform: 'web' });
      expect(passwordLogin.status).toBe(200);
    });

    it('refuses to take over an account whose email was never verified', async () => {
      const email = uniqueEmail('unverified');
      const registered = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'SecurePass123', firstName: 'Ada', lastName: 'Obi', countryCode: 'NG' });
      expect(registered.status).toBe(201);

      verifier.verify.mockResolvedValueOnce(fakeIdentity({ email }));
      const res = await signIn();

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('AUTH_GOOGLE_ACCOUNT_UNVERIFIED');

      // Nothing was linked, and no session was issued.
      const stored = await getDb(app).collection('users').findOne({ emailNormalized: email });
      expect(stored!.googleSub).toBeUndefined();
      expect(await getDb(app).collection('sessions').countDocuments({ userId: stored!._id })).toBe(0);
    });

    it('rejects a Google identity whose email Google has not verified', async () => {
      verifier.verify.mockResolvedValueOnce(fakeIdentity({ emailVerified: false }));

      const res = await signIn();

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_GOOGLE_EMAIL_UNVERIFIED');
      expect(res.body.data).toBeUndefined();
    });

    it('propagates a verifier rejection as 401 without creating an account', async () => {
      verifier.verify.mockRejectedValueOnce(
        new UnauthorizedException({
          success: false,
          error: { code: 'AUTH_GOOGLE_TOKEN_INVALID', message: 'The Google credential could not be verified. Sign in again.' },
        }),
      );
      const before = await getDb(app).collection('users').countDocuments();

      const res = await signIn();

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_GOOGLE_TOKEN_INVALID');
      expect(await getDb(app).collection('users').countDocuments()).toBe(before);
    });

    it('does not issue sessions to a suspended account', async () => {
      const identity = fakeIdentity();
      verifier.verify.mockResolvedValue(identity);
      await signIn();

      await getDb(app).collection('users').updateOne(
        { googleSub: identity.subject },
        { $set: { status: 'suspended' } },
      );

      const res = await signIn();
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('AUTH_ACCOUNT_DISABLED');
    });

    it('still requires the second factor for MFA-enabled accounts', async () => {
      const { user } = await registerAndLogin(app);
      await getDb(app).collection('users').updateOne(
        { _id: new mongoose.Types.ObjectId(user.userId!) },
        { $set: { emailVerifiedAt: new Date(), status: 'active' } },
      );

      const enrolled = await request(app.getHttpServer())
        .post('/api/v1/auth/mfa/enroll')
        .set({ Authorization: `Bearer ${user.accessToken}` })
        .send();
      expect(enrolled.status).toBe(201);
      const secret = enrolled.body.data.secret as string;

      const verified = await request(app.getHttpServer())
        .post('/api/v1/auth/mfa/verify')
        .set({ Authorization: `Bearer ${user.accessToken}` })
        .send({ code: currentTotp(secret) });
      expect(verified.status).toBe(201);

      verifier.verify.mockResolvedValueOnce(fakeIdentity({ email: user.email }));
      const res = await signIn();

      expect(res.status).toBe(200);
      expect(res.body.data.mfaRequired).toBe(true);
      expect(res.body.data.tokens).toBeUndefined();
      expect(typeof res.body.data.mfaToken).toBe('string');

      const challenge = await request(app.getHttpServer())
        .post('/api/v1/auth/mfa/challenge')
        .send({ mfaToken: res.body.data.mfaToken, code: currentTotp(secret), platform: 'web' });
      expect(challenge.status).toBe(200);
      expect(challenge.body.data.tokens.accessToken).toBeTruthy();
    });

    it('validates the request body strictly', async () => {
      const missing = await request(app.getHttpServer()).post('/api/v1/auth/google').send({});
      expect(missing.status).toBe(400);

      const extra = await request(app.getHttpServer())
        .post('/api/v1/auth/google')
        .send({ idToken: 'a'.repeat(40), email: 'attacker@example.com' });
      expect(extra.status).toBe(400);
    });
  });
});
