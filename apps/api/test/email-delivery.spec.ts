import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import { createTestApp, registerUser, uniqueEmail } from './helpers';
import { emailOutbox, resetEmailOutbox } from '../src/modules/mail/mock-email.provider';

describe('Email delivery (e2e, mocked provider)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => resetEmailOutbox());

  afterAll(async () => {
    await mongoose.disconnect().catch(() => undefined);
    await app.close();
  });

  it('delivers a verification link on registration and never logs the token', async () => {
    const user = await registerUser(app);
    expect(emailOutbox).toHaveLength(1);
    expect(emailOutbox[0].to).toBe(user.email);
    expect(emailOutbox[0].subject).toMatch(/verify/i);
    expect(emailOutbox[0].text).toContain('/verify-email?token=');
  });

  it('delivers a single-use password-reset link without revealing account existence', async () => {
    const user = await registerUser(app);
    resetEmailOutbox();

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: user.email })
      .expect(200);
    expect(JSON.stringify(res.body)).not.toContain('token=');
    expect(emailOutbox).toHaveLength(1);
    expect(emailOutbox[0].text).toContain('/reset-password?token=');

    resetEmailOutbox();
    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: uniqueEmail('missing') })
      .expect(200);
    expect(emailOutbox).toHaveLength(0);
  });
});
