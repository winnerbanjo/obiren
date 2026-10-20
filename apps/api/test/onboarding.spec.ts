import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import { authHeader, createTestApp, getDb, registerAndLogin } from './helpers';

describe('Onboarding (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await mongoose.disconnect().catch(() => undefined);
    await app.close();
  });

  it('returns a first-step draft and persists partial progress for the authenticated user', async () => {
    const { user } = await registerAndLogin(app);
    const server = app.getHttpServer();

    const initial = await request(server).get('/api/v1/users/onboarding').set(authHeader(user.accessToken!));
    expect(initial.status).toBe(200);
    expect(initial.body.data).toMatchObject({ step: 1, status: 'in_progress' });

    const save = await request(server)
      .patch('/api/v1/users/onboarding')
      .set(authHeader(user.accessToken!))
      .send({ step: 2, objective: 'CYCLE_TRACKING', cycleLengthDays: 29, conditions: ['endometriosis'] });
    expect(save.status).toBe(200);
    expect(save.body.data).toMatchObject({ step: 2, objective: 'CYCLE_TRACKING', cycleLengthDays: 29 });

    const resumed = await request(server).get('/api/v1/users/onboarding').set(authHeader(user.accessToken!));
    expect(resumed.body.data.conditions).toEqual(['endometriosis']);
  });

  it('rejects completion before step eight and does not allow profile PATCH to set completion status', async () => {
    const { user } = await registerAndLogin(app);
    const server = app.getHttpServer();

    const incomplete = await request(server)
      .post('/api/v1/users/onboarding/complete')
      .set(authHeader(user.accessToken!));
    expect(incomplete.status).toBe(422);

    const bypass = await request(server)
      .patch('/api/v1/users/me')
      .set(authHeader(user.accessToken!))
      .send({ onboardingStatus: 'COMPLETED' });
    expect(bypass.status).toBe(400);
    expect(bypass.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('completes a valid cycle-tracking intake and creates its baseline only when no active cycle exists', async () => {
    const { user } = await registerAndLogin(app);
    const server = app.getHttpServer();
    const headers = authHeader(user.accessToken!);

    for (let step = 2; step <= 8; step += 1) {
      await request(server)
        .patch('/api/v1/users/onboarding')
        .set(headers)
        .send({
          step,
          ...(step === 2 ? { objective: 'CYCLE_TRACKING' } : {}),
          ...(step === 8 ? { lastMenstrualPeriod: '2026-09-25' } : {}),
        })
        .expect(200);
    }

    const completed = await request(server).post('/api/v1/users/onboarding/complete').set(headers);
    expect(completed.status).toBe(201);
    expect(completed.body.data.status).toBe('COMPLETED');
    expect(completed.body.data.profile.trackingGoal).toBe('CYCLE_TRACKING');

    const cycles = await getDb(app)
      .collection('cycles')
      .find({ userId: new mongoose.Types.ObjectId(user.userId!), status: 'active' })
      .toArray();
    expect(cycles).toHaveLength(1);
    expect(cycles[0].startedAt.toISOString().slice(0, 10)).toBe('2026-09-25');

    const repeated = await request(server).post('/api/v1/users/onboarding/complete').set(headers);
    expect(repeated.status).toBe(201);
    const afterRepeat = await getDb(app)
      .collection('cycles')
      .find({ userId: new mongoose.Types.ObjectId(user.userId!), status: 'active' })
      .toArray();
    expect(afterRepeat).toHaveLength(1);
  });

  it('enforces user ownership and validates canonical steps and date format', async () => {
    const { user: first } = await registerAndLogin(app);
    const { user: second } = await registerAndLogin(app);

    await request(app.getHttpServer())
      .patch('/api/v1/users/onboarding')
      .set(authHeader(first.accessToken!))
      .send({ step: 9 })
      .expect(400);

    await request(app.getHttpServer())
      .patch('/api/v1/users/onboarding')
      .set(authHeader(first.accessToken!))
      .send({ step: 4 })
      .expect(422);

    await request(app.getHttpServer())
      .patch('/api/v1/users/onboarding')
      .set(authHeader(first.accessToken!))
      .send({ lastMenstrualPeriod: '2026-99-99' })
      .expect(400);

    const secondDraft = await request(app.getHttpServer())
      .get('/api/v1/users/onboarding')
      .set(authHeader(second.accessToken!));
    expect(secondDraft.body.data.step).toBe(1);
    expect(secondDraft.body.data.objective).toBeUndefined();
  });
});
