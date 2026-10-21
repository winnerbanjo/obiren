import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import { authHeader, createTestApp, idempotencyHeader, registerAndLogin } from './helpers';

describe('HTTP contract and idempotency (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await mongoose.disconnect().catch(() => undefined);
    await app.close();
  });

  it('returns the PRD success envelope and echoes a request id', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('X-Request-Id', 'caller-request-123')
      .expect(200);

    expect(res.body).toMatchObject({ data: { status: 'ok' }, requestId: 'caller-request-123' });
    expect(res.body).not.toHaveProperty('success');
    expect(res.headers['x-request-id']).toBe('caller-request-123');
  });

  it('generates a request id when none is supplied and rejects unsafe ids', async () => {
    const generated = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(generated.body.requestId).toMatch(/^req_/);
    expect(generated.headers['x-request-id']).toBe(generated.body.requestId);

    const unsafe = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('X-Request-Id', 'bad id with spaces')
      .expect(200);
    expect(unsafe.body.requestId).toMatch(/^req_/);
    expect(unsafe.body.requestId).not.toBe('bad id with spaces');
  });

  it('serves the same handler through the /v1 prefix alias', async () => {
    const canonical = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    const alias = await request(app.getHttpServer()).get('/v1/health').expect(200);
    expect(alias.body.data).toMatchObject({ status: canonical.body.data.status, service: canonical.body.data.service });
    expect(alias.body.requestId).toBeTruthy();
  });

  it('uses the PRD error envelope with stable codes', async () => {
    const validation = await request(app.getHttpServer()).post('/api/v1/auth/register').send({}).expect(400);
    expect(validation.body.error.code).toBe('VALIDATION_ERROR');
    expect(validation.body.error.details.fields.email).toBeTruthy();
    expect(validation.body.requestId).toBe(validation.headers['x-request-id']);

    const unauthenticated = await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
    expect(unauthenticated.body.error.code).toBe('UNAUTHENTICATED');

    const missing = await request(app.getHttpServer()).get('/api/v1/definitely-not-a-route').expect(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });

  it('requires idempotency keys and replays an identical guardian invite', async () => {
    const { user } = await registerAndLogin(app);
    const headers = authHeader(user.accessToken!);
    const key = idempotencyHeader('guardian-invite');
    const body = { name: 'Sarah', phoneE164: '+2348011112222', scopes: ['sos_alert'] };

    const missingKey = await request(app.getHttpServer()).post('/api/v1/safety/guardians').set(headers).send(body).expect(400);
    expect(missingKey.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');

    const first = await request(app.getHttpServer())
      .post('/api/v1/safety/guardians')
      .set(headers)
      .set(key)
      .send(body)
      .expect(201);
    expect(first.body.data.contact.name).toBe('Sarah');

    const replay = await request(app.getHttpServer())
      .post('/api/v1/safety/guardians')
      .set(headers)
      .set(key)
      .send(body)
      .expect(201);
    expect(replay.body.data.contact._id).toBe(first.body.data.contact._id);
    expect(replay.body.requestId).not.toBe(first.body.requestId);

    const reused = await request(app.getHttpServer())
      .post('/api/v1/safety/guardians')
      .set(headers)
      .set(key)
      .send({ ...body, name: 'Someone else' })
      .expect(409);
    expect(reused.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('scopes idempotency keys to the authenticated account', async () => {
    const { user: first } = await registerAndLogin(app);
    const { user: second } = await registerAndLogin(app);
    const key = idempotencyHeader('shared-key');
    const body = { name: 'Shared key contact', phoneE164: '+2348022223333', scopes: ['sos_alert'] };

    await request(app.getHttpServer())
      .post('/api/v1/safety/guardians')
      .set(authHeader(first.accessToken!))
      .set(key)
      .send(body)
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/safety/guardians')
      .set(authHeader(second.accessToken!))
      .set(key)
      .send(body)
      .expect(201);
  });
});
