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

  it('returns current-cycle estimates with an explicit low-confidence and non-contraceptive safety signal', async () => {
    const { user } = await registerAndLogin(app);
    await request(app.getHttpServer())
      .post('/api/v1/cycles/start-period')
      .set(authHeader(user.accessToken!))
      .send({ date: '2026-09-01' })
      .expect(201);

    const current = await request(app.getHttpServer())
      .get('/api/v1/cycles/current')
      .set(authHeader(user.accessToken!));
    expect(current.status).toBe(200);
    expect(current.body.data.prediction.confidence).toBe('LOW');
    expect(current.body.data.prediction.isContraceptiveAdvice).toBe(false);
    expect(current.body.data.prediction.periodPrediction.rangeStart).toBeTruthy();
    expect(current.body.data.timeZone).toBe('Africa/Lagos');
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

  it('edits an owner period, calculates inclusive bleeding days, and rejects overlaps', async () => {
    const { user } = await registerAndLogin(app);
    const server = app.getHttpServer();
    const headers = authHeader(user.accessToken!);

    const first = await request(server)
      .post('/api/v1/cycles/start-period')
      .set(headers)
      .send({ date: '2026-10-01' });
    expect(first.status).toBe(201);
    const firstId = first.body.data.cycle._id;

    const ended = await request(server)
      .post('/api/v1/cycles/end-period')
      .set(headers)
      .send({ date: '2026-10-05' });
    expect(ended.status).toBe(201);
    expect(ended.body.data.periodLength).toBe(5);

    const next = await request(server)
      .post('/api/v1/cycles/start-period')
      .set(headers)
      .send({ date: '2026-10-29' });
    expect(next.status).toBe(201);

    const edited = await request(server)
      .patch(`/api/v1/cycles/${firstId}`)
      .set(headers)
      .send({ startDate: '2026-10-02', endDate: '2026-10-06', notes: 'Updated cycle note' });
    expect(edited.status).toBe(200);
    expect(edited.body.data.periodLength).toBe(5);
    expect(edited.body.data.notes).toBe('Updated cycle note');

    const overlap = await request(server)
      .patch(`/api/v1/cycles/${firstId}`)
      .set(headers)
      .send({ endDate: '2026-10-30' });
    expect(overlap.status).toBe(400);

    const movedStart = await request(server)
      .patch(`/api/v1/cycles/${firstId}`)
      .set(headers)
      .send({ startDate: '2026-10-07' });
    expect(movedStart.status).toBe(200);
    expect(movedStart.body.data.periodEndedAt).toBeUndefined();
    expect(movedStart.body.data.periodLength).toBeUndefined();
  });

  it('lists paginated cycle history, summary, detail, and hides other users’ history', async () => {
    const { user: owner } = await registerAndLogin(app);
    const { user: other } = await registerAndLogin(app);
    const server = app.getHttpServer();
    const ownerHeaders = authHeader(owner.accessToken!);
    const otherHeaders = authHeader(other.accessToken!);

    const first = await request(server).post('/api/v1/cycles/start-period').set(ownerHeaders).send({ date: '2026-06-01' });
    await request(server).post('/api/v1/cycles/start-period').set(ownerHeaders).send({ date: '2026-06-29' });
    await request(server).post('/api/v1/cycles/start-period').set(ownerHeaders).send({ date: '2026-07-27' });

    const pageOne = await request(server).get('/api/v1/cycles/history?limit=2').set(ownerHeaders);
    expect(pageOne.status).toBe(200);
    expect(pageOne.body.data.cycles).toHaveLength(2);
    expect(pageOne.body.data.summary.recordedCycleCount).toBe(3);
    expect(pageOne.body.data.summary.avgCycleLength).toBe(28);
    expect(pageOne.body.data.nextCursor).toBeTruthy();

    const pageTwo = await request(server)
      .get(`/api/v1/cycles/history?limit=2&cursor=${pageOne.body.data.nextCursor}`)
      .set(ownerHeaders);
    expect(pageTwo.status).toBe(200);
    expect(pageTwo.body.data.cycles).toHaveLength(1);
    expect(pageTwo.body.data.nextCursor).toBeNull();

    const detail = await request(server)
      .get(`/api/v1/cycles/history/${first.body.data.cycle._id}`)
      .set(ownerHeaders);
    expect(detail.status).toBe(200);
    expect(detail.body.data.cycle._id).toBe(first.body.data.cycle._id);

    const hidden = await request(server)
      .get(`/api/v1/cycles/history/${first.body.data.cycle._id}`)
      .set(otherHeaders);
    expect(hidden.status).toBe(404);
  });

  it('rejects impossible dates and out-of-order period starts without closing the active cycle', async () => {
    const { user } = await registerAndLogin(app);
    const server = app.getHttpServer();
    const headers = authHeader(user.accessToken!);

    await request(server).post('/api/v1/cycles/start-period').set(headers).send({ date: '2026-02-30' }).expect(400);
    const active = await request(server).post('/api/v1/cycles/start-period').set(headers).send({ date: '2026-07-10' });
    expect(active.status).toBe(201);
    const before = await request(server).post('/api/v1/cycles/start-period').set(headers).send({ date: '2026-07-09' });
    expect(before.status).toBe(400);
    const current = await request(server).get('/api/v1/cycles/current').set(headers);
    expect(current.body.data.startedAt).toBe('2026-07-10');
    expect(current.body.data.status).toBe('active');
  });

  it('does not allow users to edit another user’s cycle', async () => {
    const { user: owner } = await registerAndLogin(app);
    const { user: other } = await registerAndLogin(app);
    const created = await request(app.getHttpServer())
      .post('/api/v1/cycles/start-period')
      .set(authHeader(owner.accessToken!))
      .send({ date: '2026-08-01' });
    const cycleId = created.body.data.cycle._id;

    await request(app.getHttpServer())
      .patch(`/api/v1/cycles/${cycleId}`)
      .set(authHeader(other.accessToken!))
      .send({ notes: 'unauthorized edit' })
      .expect(404);
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

  it('supports partial updates and conditional deletes with optimistic versioning', async () => {
    const { user } = await registerAndLogin(app);
    const server = app.getHttpServer();
    const headers = authHeader(user.accessToken!);

    const created = await request(server)
      .put('/api/v1/daily-logs/2026-10-14')
      .set(headers)
      .send({ bleeding: { level: 'light' }, notes: 'first entry' });
    expect(created.status).toBe(200);

    const firstUpdate = await request(server)
      .patch('/api/v1/daily-logs/2026-10-14')
      .set(headers)
      .send({ version: created.body.data.version, pain: { level: 5 } });
    expect(firstUpdate.status).toBe(200);
    expect(firstUpdate.body.data.version).toBe(created.body.data.version + 1);
    expect(firstUpdate.body.data.pain.level).toBe(5);

    const staleAttempt = await request(server)
      .patch('/api/v1/daily-logs/2026-10-14')
      .set(headers)
      .send({ version: created.body.data.version, notes: 'stale' });
    expect(staleAttempt.status).toBe(409);

    const deleted = await request(server)
      .delete('/api/v1/daily-logs/2026-10-14')
      .set(headers)
      .query({ version: firstUpdate.body.data.version });
    expect(deleted.status).toBe(200);
    expect(deleted.body.data.deleted).toBe(true);

    const gone = await request(server).get('/api/v1/daily-logs/2026-10-14').set(headers);
    expect(gone.status).toBe(200);
    expect(gone.body.data).toEqual({ date: '2026-10-14', bleeding: { level: 'none' }, moods: [], symptoms: [] });
  });    it('rejects partial updates and deletes that target another user’s log', async () => {
    const { user: owner } = await registerAndLogin(app);
    const { user: other } = await registerAndLogin(app);
    const server = app.getHttpServer();

    const ownerEntry = await request(server)
      .put('/api/v1/daily-logs/2026-10-25')
      .set(authHeader(owner.accessToken!))
      .send({ bleeding: { level: 'medium' } });
    expect(ownerEntry.status).toBe(200);
    const version = ownerEntry.body.data.version;

    await request(server)
      .patch('/api/v1/daily-logs/2026-10-25')
      .set(authHeader(other.accessToken!))
      .send({ version, notes: 'unauthorized' })
      .expect(404);

    await request(server)
      .delete('/api/v1/daily-logs/2026-10-25')
      .set(authHeader(other.accessToken!))
      .query({ version })
      .expect(404);
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
      .send({ estimatedDueDate: '2027-01-15', calculationSource: 'user_entered' });
    expect(first.status).toBe(201);

    const second = await request(server)
      .post('/api/v1/pregnancies')
      .set(authHeader(user.accessToken!))
      .send({ estimatedDueDate: '2027-03-15', calculationSource: 'user_entered' });
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

  it('persists detailed owner-scoped pregnancy logs and encrypts private notes at rest', async () => {
    const { user: owner } = await registerAndLogin(app);
    const { user: other } = await registerAndLogin(app);
    const server = app.getHttpServer();
    const headers = authHeader(owner.accessToken!);
    const create = await request(server).post('/api/v1/pregnancies').set(headers).send({ lastMenstrualPeriod: '2026-08-01' });
    expect(create.status).toBe(201);
    const pregnancyId = create.body.data._id;

    const log = await request(server)
      .put(`/api/v1/pregnancies/${pregnancyId}/logs/2026-10-18`)
      .set(headers)
      .send({ nausea: 'mild', symptoms: ['fatigue'], mood: 'calm', energy: 'low', water: 5, vitamins: ['prenatal'], nutrition: ['fruit'], selfCare: ['rest'], notes: 'private pregnancy note', fetalMovement: 'not_assessed' });
    expect(log.status).toBe(200);
    expect(log.body.data.log.notes).toBe('private pregnancy note');
    expect(log.body.data.log.notesEncrypted).toBeUndefined();

    const stored = await getDb(app).collection('pregnancy_logs').findOne({ pregnancyId: new mongoose.Types.ObjectId(pregnancyId), date: '2026-10-18' });
    expect(stored.notesEncrypted).not.toBe('private pregnancy note');
    expect(stored.notesIv).toBeTruthy();
    expect(stored.notesAuthTag).toBeTruthy();
    expect(stored.symptoms).toEqual(['fatigue']);

    const read = await request(server).get('/api/v1/pregnancies/logs/2026-10-18').set(headers);
    expect(read.status).toBe(200);
    expect(read.body.data.notes).toBe('private pregnancy note');
    const otherRead = await request(server).get('/api/v1/pregnancies/logs/2026-10-18').set(authHeader(other.accessToken!));
    expect(otherRead.body.data.version).toBe(0);
    await request(server).put(`/api/v1/pregnancies/${pregnancyId}/logs/2026-10-19`).set(authHeader(other.accessToken!)).send({ symptoms: ['fatigue'] }).expect(404);
  });

  it('records estimated due-date provenance, allows an unknown LMP and guards early kick counts', async () => {
    const { user } = await registerAndLogin(app);
    const headers = authHeader(user.accessToken!);
    const created = await request(app.getHttpServer()).post('/api/v1/pregnancies').set(headers).send({ estimatedDueDate: '2027-06-01', calculationSource: 'user_entered', dateConfidence: 'unknown' });
    expect(created.status).toBe(201);
    const id = created.body.data._id;
    const current = await request(app.getHttpServer()).get('/api/v1/pregnancies/current').set(headers);
    expect(current.body.data.currentWeek).toBeNull();
    expect(current.body.data.lastMenstrualPeriod).toBeNull();

    const correction = await request(app.getHttpServer()).patch(`/api/v1/pregnancies/${id}`).set(headers).send({ estimatedDueDate: '2027-06-08', calculationSource: 'ultrasound', dateConfidence: 'certain' });
    expect(correction.status).toBe(200);
    expect(correction.body.data.clinicianConfirmedDueDate).toBeUndefined();
    expect(correction.body.data.confirmedEstimatedDueDate).toBeUndefined();
    expect(correction.body.data.dueDateHistory).toHaveLength(1);

    const kick = await request(app.getHttpServer()).post(`/api/v1/pregnancies/${id}/kicks`).set(headers).send({ startedAt: '2026-10-18T09:00:00Z', completedAt: '2026-10-18T09:30:00Z', count: 10 });
    expect(kick.status).toBe(422);
  });
});
