import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import { createTestApp, registerAndLogin, authHeader, getDb } from './helpers';

describe('Cycles & Daily Logs (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await mongoose.disconnect().catch(() => undefined);
    await app.close();
  });

  it('creates an active cycle via start-period and returns a prediction', async () => {
    const { user } = await registerAndLogin(app);

    const res = await request(app.getHttpServer())
      .post('/api/v1/cycles/start-period')
      .set(authHeader(user.accessToken!))
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.data.cycle.status).toBe('active');
    expect(res.body.data.prediction).toBeTruthy();
    expect(res.body.data.prediction.calculationVersion).toContain('health-engine');
  });

  it('is idempotent for same-day period starts (one active cycle)', async () => {
    const { user } = await registerAndLogin(app);
    const server = app.getHttpServer();

    const first = await request(server)
      .post('/api/v1/cycles/start-period')
      .set(authHeader(user.accessToken!))
      .send({ date: '2026-09-01' });
    expect(first.status).toBe(201);

    const second = await request(server)
      .post('/api/v1/cycles/start-period')
      .set(authHeader(user.accessToken!))
      .send({ date: '2026-09-01' });
    expect(second.status).toBe(201);
    expect(second.body.data.message).toContain('Idempotent');

    // Only one ACTIVE cycle exists in the DB.
    const cycles = await getDb(app)
      .collection('cycles')
      .find({ userId: new mongoose.Types.ObjectId(user.userId!), status: 'active' })
      .toArray();
    expect(cycles).toHaveLength(1);
  });

  it('upserts daily logs and enforces one log per user per date', async () => {
    const { user } = await registerAndLogin(app);
    const server = app.getHttpServer();

    const create = await request(server)
      .put('/api/v1/daily-logs/2026-09-10')
      .set(authHeader(user.accessToken!))
      .send({
        bleeding: { level: 'medium' },
        pain: { level: 4 },
        moods: ['Calm'],
        symptoms: ['Cramps'],
      });
    expect(create.status).toBe(200);
    expect(create.body.data.bleeding.level).toBe('medium');

    // Overwrite (upsert) - not a duplicate.
    const update = await request(server)
      .put('/api/v1/daily-logs/2026-09-10')
      .set(authHeader(user.accessToken!))
      .send({
        bleeding: { level: 'heavy' },
        pain: { level: 7 },
        moods: [],
        symptoms: [],
        notes: 'Updated',
      });
    expect(update.status).toBe(200);
    expect(update.body.data.bleeding.level).toBe('heavy');

    const logs = await getDb(app)
      .collection('daily_logs')
      .find({ userId: new mongoose.Types.ObjectId(user.userId!), date: '2026-09-10' })
      .toArray();
    expect(logs).toHaveLength(1);
  });

  it('rejects invalid daily log payloads', async () => {
    const { user } = await registerAndLogin(app);

    const bad = await request(app.getHttpServer())
      .put('/api/v1/daily-logs/not-a-date')
      .set(authHeader(user.accessToken!))
      .send({ moods: [] });
    expect(bad.status).toBe(400);

    const badBody = await request(app.getHttpServer())
      .put('/api/v1/daily-logs/2026-09-10')
      .set(authHeader(user.accessToken!))
      .send({ bleeding: { level: 'torrential' } });
    expect(badBody.status).toBe(400);
  });

  it('users cannot see another user\u2019s cycle data (IDOR)', async () => {
    const { user: userA } = await registerAndLogin(app, { firstName: 'A' });
    const { user: userB } = await registerAndLogin(app, { firstName: 'B' });

    await request(app.getHttpServer())
      .post('/api/v1/cycles/start-period')
      .set(authHeader(userA.accessToken!))
      .send({});

    const asB = await request(app.getHttpServer())
      .get('/api/v1/cycles/current')
      .set(authHeader(userB.accessToken!));
    expect(asB.status).toBe(200);
    expect(asB.body.data).toBeNull();
  });
});

describe('Pregnancy (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await mongoose.disconnect().catch(() => undefined);
    await app.close();
  });

  it('creates a pregnancy profile and computes gestational age', async () => {
    const { user } = await registerAndLogin(app);

    const create = await request(app.getHttpServer())
      .post('/api/v1/pregnancies')
      .set(authHeader(user.accessToken!))
      .send({ lastMenstrualPeriod: '2026-06-01' });

    expect(create.status).toBe(201);
    expect(create.body.data.status).toBe('active');

    const current = await request(app.getHttpServer())
      .get('/api/v1/pregnancies/current')
      .set(authHeader(user.accessToken!));
    expect(current.status).toBe(200);
    expect(current.body.data.currentWeek).toBeGreaterThan(0);
    expect(current.body.data.babyMilestone).toBeTruthy();
  });

  it('enforces ONE active pregnancy per user (service + partial index)', async () => {
    const { user } = await registerAndLogin(app);
    const server = app.getHttpServer();

    const first = await request(server)
      .post('/api/v1/pregnancies')
      .set(authHeader(user.accessToken!))
      .send({ estimatedDueDate: '2027-01-15' });
    expect(first.status).toBe(201);

    const second = await request(server)
      .post('/api/v1/pregnancies')
      .set(authHeader(user.accessToken!))
      .send({ estimatedDueDate: '2027-03-15' });
    expect(second.status).toBe(400);
    const msg = second.body?.error?.message || second.body?.message || '';
    expect(msg).toContain('active pregnancy');
  });

  it('requires either LMP or due date', async () => {
    const { user } = await registerAndLogin(app);

    const res = await request(app.getHttpServer())
      .post('/api/v1/pregnancies')
      .set(authHeader(user.accessToken!))
      .send({});
    expect(res.status).toBe(400);
  });

  it('flags high-risk symptoms with urgent safety notice', async () => {
    const { user } = await registerAndLogin(app);
    const server = app.getHttpServer();

    const create = await request(server)
      .post('/api/v1/pregnancies')
      .set(authHeader(user.accessToken!))
      .send({ lastMenstrualPeriod: '2026-05-01' });
    const pregnancyId = create.body.data._id || create.body.data.id;

    const log = await request(server)
      .put(`/api/v1/pregnancies/${pregnancyId}/logs/2026-09-28`)
      .set(authHeader(user.accessToken!))
      .send({ symptoms: ['severe_bleeding'] });

    expect(log.status).toBe(200);
    expect(log.body.data.safetyNotice).toBeTruthy();
    expect(log.body.data.safetyNotice.title).toContain('urgent medical');
  });
});
