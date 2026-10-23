import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import { authHeader, createTestApp, getDb, registerAndLogin } from './helpers';

describe('Consent and configuration options (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await mongoose.disconnect().catch(() => undefined);
    await app.close();
  });

  it('serves the public, versioned option catalog without requiring authentication', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/config/options');
    expect(response.status).toBe(200);
    expect(response.body.data.version).toBeTruthy();
    expect(response.body.data.objectives.map((item: any) => item.value)).toEqual([
      'CYCLE_TRACKING', 'PREGNANCY', 'FERTILITY', 'GENERAL_WELLNESS',
    ]);
    expect(response.body.data.countries.map((item: any) => item.code)).toEqual(['NG', 'GH', 'GB', 'US']);
    expect(response.body.data.provisional).toBe(true);
    expect(response.body.data.consentPurposes).toContain('health_sharing');
  });

  it('records separate consent purpose events and derives current state from append-only history', async () => {
    const { user } = await registerAndLogin(app);
    const server = app.getHttpServer();
    const headers = authHeader(user.accessToken!);

    const empty = await request(server).get('/api/v1/consents').set(headers);
    expect(empty.status).toBe(200);
    expect(empty.body.data.history).toHaveLength(0);

    await request(server)
      .post('/api/v1/consents')
      .set(headers)
      .send({ purpose: 'health_data_processing', policyVersion: 'privacy-1.0', granted: true, source: 'onboarding' })
      .expect(201);
    await request(server)
      .post('/api/v1/consents')
      .set(headers)
      .send({ purpose: 'marketing', policyVersion: 'marketing-1.0', granted: false, source: 'onboarding' })
      .expect(201);
    await request(server)
      .post('/api/v1/consents')
      .set(headers)
      .send({ purpose: 'health_data_processing', policyVersion: 'privacy-1.0', granted: false, source: 'settings' })
      .expect(201);

    const history = await request(server).get('/api/v1/consents').set(headers);
    expect(history.status).toBe(200);
    expect(history.body.data.history).toHaveLength(3);
    const current = Object.fromEntries(history.body.data.current.map((item: any) => [item.purpose, item.granted]));
    expect(current).toMatchObject({ health_data_processing: false, marketing: false });

    const stored = await getDb(app)
      .collection('consent_events')
      .find({ userId: new mongoose.Types.ObjectId(user.userId!) })
      .toArray();
    expect(stored).toHaveLength(3);
    expect(stored.every((event: any) => event.userId.toString() === user.userId)).toBe(true);
  });

  it('rejects unknown consent purposes and prevents users from reading another account history', async () => {
    const { user: first } = await registerAndLogin(app);
    const { user: second } = await registerAndLogin(app);
    const headers = authHeader(first.accessToken!);

    await request(app.getHttpServer())
      .post('/api/v1/consents')
      .set(headers)
      .send({ purpose: 'all_health_and_marketing', policyVersion: '1.0', granted: true, source: 'onboarding' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/consents')
      .set(headers)
      .send({ purpose: 'health_sharing', policyVersion: '1.0', granted: true, source: 'onboarding', userId: second.userId })
      .expect(400);

    const secondHistory = await request(app.getHttpServer())
      .get('/api/v1/consents')
      .set(authHeader(second.accessToken!));
    expect(secondHistory.status).toBe(200);
    expect(secondHistory.body.data.history).toHaveLength(0);
  });
});
