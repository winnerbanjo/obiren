import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import { authHeader, createTestApp, getDb, registerAndLogin } from './helpers';

/** Today in the account timezone (the API default for a Nigerian profile). */
function todayLagos(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

describe('Periods, enriched daily logs and date-scoped home (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await mongoose.disconnect().catch(() => undefined);
    await app.close();
  });

  const server = () => app.getHttpServer();

  it('records periods, is idempotent for a repeated start date and lists a date range', async () => {
    const { user } = await registerAndLogin(app);
    const headers = authHeader(user.accessToken!);

    const created = await request(server())
      .post('/api/v1/periods')
      .set(headers)
      .send({ startDate: '2026-09-02', endDate: '2026-09-06', notes: 'first period' })
      .expect(201);
    expect(created.body.data.created).toBe(true);
    expect(created.body.data.period).toMatchObject({
      startDate: '2026-09-02',
      endDate: '2026-09-06',
      periodLengthDays: 5,
      status: 'active',
    });
    const periodId = created.body.data.period.id;

    // Repeating the same start date must not create a second record.
    const repeated = await request(server())
      .post('/api/v1/periods')
      .set(headers)
      .send({ startDate: '2026-09-02' })
      .expect(201);
    expect(repeated.body.data.created).toBe(false);
    expect(repeated.body.data.period.id).toBe(periodId);

    const next = await request(server())
      .post('/api/v1/periods')
      .set(headers)
      .send({ startDate: '2026-10-01', endDate: '2026-10-05' })
      .expect(201);
    expect(next.body.data.period.startDate).toBe('2026-10-01');

    const listed = await request(server())
      .get('/api/v1/periods?from=2026-09-01&to=2026-10-31')
      .set(headers)
      .expect(200);
    expect(listed.body.data.periods.map((period: any) => period.startDate)).toEqual(['2026-09-02', '2026-10-01']);
    expect(listed.body.data.summary).toMatchObject({
      recordedPeriodCount: 2,
      averagePeriodLengthDays: 5,
      averagePeriodLengthSampleSize: 2,
      isContraceptiveAdvice: false,
    });

    // A period outside the requested window is excluded.
    const narrow = await request(server())
      .get('/api/v1/periods?from=2026-10-01&to=2026-10-10')
      .set(headers)
      .expect(200);
    expect(narrow.body.data.periods.map((period: any) => period.startDate)).toEqual(['2026-10-01']);

    const edited = await request(server())
      .patch(`/api/v1/periods/${periodId}`)
      .set(headers)
      .send({ endDate: '2026-09-05' })
      .expect(200);
    expect(edited.body.data.period.periodLengthDays).toBe(4);
  });

  it('rejects overlapping, inverted and retroactive periods without touching other accounts', async () => {
    const { user: owner } = await registerAndLogin(app);
    const { user: other } = await registerAndLogin(app);
    const ownerHeaders = authHeader(owner.accessToken!);

    await request(server()).post('/api/v1/periods').set(ownerHeaders).send({ startDate: '2026-09-10' }).expect(201);
    await request(server()).post('/api/v1/periods').set(ownerHeaders).send({ startDate: '2026-10-10' }).expect(201);

    // Start before the latest recorded period would rewrite history.
    await request(server()).post('/api/v1/periods').set(ownerHeaders).send({ startDate: '2026-09-20' }).expect(400);
    // End before start.
    await request(server()).post('/api/v1/periods').set(ownerHeaders).send({ startDate: '2026-11-01', endDate: '2026-10-30' }).expect(400);
    // Implausibly long recorded period.
    await request(server()).post('/api/v1/periods').set(ownerHeaders).send({ startDate: '2026-11-01', endDate: '2026-12-15' }).expect(400);

    const ownerList = await request(server()).get('/api/v1/periods?from=2026-01-01&to=2026-12-31').set(ownerHeaders).expect(200);
    const periodId = ownerList.body.data.periods[0].id;

    // Another account cannot see or edit the period.
    const otherList = await request(server())
      .get('/api/v1/periods?from=2026-01-01&to=2026-12-31')
      .set(authHeader(other.accessToken!))
      .expect(200);
    expect(otherList.body.data.periods).toHaveLength(0);
    await request(server())
      .patch(`/api/v1/periods/${periodId}`)
      .set(authHeader(other.accessToken!))
      .send({ endDate: '2026-09-12' })
      .expect(404);

    // End date crossing the next recorded period is refused.
    await request(server())
      .patch(`/api/v1/periods/${periodId}`)
      .set(ownerHeaders)
      .send({ endDate: '2026-10-11' })
      .expect(400);
  });

  it('defaults a period start to today in the account timezone', async () => {
    const { user } = await registerAndLogin(app);
    const headers = authHeader(user.accessToken!);
    const created = await request(server()).post('/api/v1/periods').set(headers).send({}).expect(201);
    expect(created.body.data.period.startDate).toBe(todayLagos());
  });

  it('round-trips the PRD daily-log fields and keeps private notes out of calendar reads', async () => {
    const { user } = await registerAndLogin(app);
    const headers = authHeader(user.accessToken!);

    const saved = await request(server())
      .put('/api/v1/daily-logs/2026-10-12')
      .set(headers)
      .send({
        mode: 'cycle',
        bleeding: { level: 'medium', clots: false },
        bloodColor: 'dark_red',
        pain: { level: 6, locations: ['lower_back'] },
        moods: ['tired'],
        symptoms: ['cramps'],
        energy: 2,
        cravings: ['chocolate'],
        sleep: { hours: 6.5, quality: 'fair' },
        notes: 'private daily note',
      })
      .expect(200);

    expect(saved.body.data).toMatchObject({
      mode: 'cycle',
      bloodColor: 'dark_red',
      energy: 2,
      cravings: ['chocolate'],
      sleep: { hours: 6.5, quality: 'fair' },
      notes: 'private daily note',
    });

    const patched = await request(server())
      .patch('/api/v1/daily-logs/2026-10-12')
      .set(headers)
      .send({ version: saved.body.data.version, energy: 4, sleep: { quality: 'good' } })
      .expect(200);
    expect(patched.body.data.energy).toBe(4);
    expect(patched.body.data.sleep).toMatchObject({ hours: 6.5, quality: 'good' });

    await request(server())
      .put('/api/v1/daily-logs/2026-10-13')
      .set(headers)
      .send({ mode: 'pregnancy', bleeding: { level: 'none' } })
      .expect(200);

    const calendar = await request(server())
      .get('/api/v1/daily-logs?from=2026-10-01&to=2026-10-31')
      .set(headers)
      .expect(200);
    expect(calendar.body.data.logs.map((log: any) => log.mode)).toEqual(['cycle', 'pregnancy']);
    expect(calendar.body.data.logs[0].isPeriodDay).toBe(true);
    expect(calendar.body.data.logs[1].isPeriodDay).toBe(false);
    expect(calendar.body.data.summary).toMatchObject({ loggedDayCount: 2, periodDayCount: 1, spanDays: 31 });
    expect(JSON.stringify(calendar.body)).not.toContain('private daily note');

    // Invalid enum values are rejected rather than stored.
    await request(server())
      .put('/api/v1/daily-logs/2026-10-14')
      .set(headers)
      .send({ bloodColor: 'purple' })
      .expect(400);
    await request(server())
      .put('/api/v1/daily-logs/2026-10-14')
      .set(headers)
      .send({ energy: 9 })
      .expect(400);
  });

  it('serves a date-scoped home summary with deterministic cards and a logged-day streak', async () => {
    const { user } = await registerAndLogin(app);
    const headers = authHeader(user.accessToken!);

    const empty = await request(server()).get('/api/v1/home').set(headers).expect(200);
    expect(empty.body.data.date).toBe(todayLagos());
    expect(empty.body.data.cycle).toBeNull();
    expect(empty.body.data.insights.map((insight: any) => insight.code)).toContain('NO_CYCLE_RECORDED');
    expect(empty.body.data.disclaimer).toContain('not a contraceptive method');

    await request(server()).post('/api/v1/periods').set(headers).send({ startDate: '2026-10-01' }).expect(201);
    await request(server())
      .put('/api/v1/daily-logs/2026-10-18')
      .set(headers)
      .send({ symptoms: ['fatigue'], moods: ['calm'], notes: 'home note' })
      .expect(200);

    const home = await request(server()).get('/api/v1/home?date=2026-10-18').set(headers).expect(200);
    expect(home.body.data.date).toBe('2026-10-18');
    expect(home.body.data.todayLog).toMatchObject({ date: '2026-10-18', mode: 'cycle' });
    expect(home.body.data.pulse).toMatchObject({ loggedToday: true, loggedDayStreak: 1, cycleDay: 18 });
    // The open period is surfaced as a prompt, not as a fabricated end date.
    expect(home.body.data.cards.map((card: any) => card.id)).toContain('period-end');
    expect(home.body.data.cards.find((card: any) => card.id === 'daily-log')).toBeUndefined();
    expect(JSON.stringify(home.body)).not.toContain('home note');

    // A day with no logged activity keeps the persisted cycle but offers the log card.
    const other = await request(server()).get('/api/v1/home?date=2026-10-17').set(headers).expect(200);
    expect(other.body.data.todayLog).toBeNull();
    expect(other.body.data.pulse.loggedDayStreak).toBe(0);
    expect(other.body.data.cards.map((card: any) => card.id)).toContain('daily-log');

    // Future days and malformed dates are refused instead of invented.
    await request(server()).get('/api/v1/home?date=2099-01-01').set(headers).expect(400);
    await request(server()).get('/api/v1/home?date=2026-02-31').set(headers).expect(400);
  });

  it('exposes /me and /onboarding aliases over the same account data', async () => {
    const { user } = await registerAndLogin(app);
    const headers = authHeader(user.accessToken!);

    const me = await request(server()).get('/api/v1/me').set(headers).expect(200);
    const canonical = await request(server()).get('/api/v1/users/me').set(headers).expect(200);
    expect(me.body.data.userId).toBe(user.userId);
    expect(me.body.data.email).toBe(canonical.body.data.email);

    await request(server()).patch('/api/v1/me').set(headers).send({ displayName: 'Alias Name' }).expect(200);
    const updated = await request(server()).get('/api/v1/users/me').set(headers).expect(200);
    expect(updated.body.data.displayName).toBe('Alias Name');

    await request(server()).patch('/api/v1/onboarding').set(headers).send({ step: 2, objective: 'CYCLE_TRACKING' }).expect(200);
    const draft = await request(server()).get('/api/v1/onboarding').set(headers).expect(200);
    expect(draft.body.data.step).toBe(2);

    // The alias never accepts a client-supplied account identifier.
    await request(server())
      .patch('/api/v1/me')
      .set(headers)
      .send({ displayName: 'x', userId: '66a0b6f3e5f21c8e7a112233' })
      .expect(400);
  });

  it('serves the active pregnancy alias with a trimester and date-keyed check-ins', async () => {
    const { user } = await registerAndLogin(app);
    const headers = authHeader(user.accessToken!);

    const none = await request(server()).get('/api/v1/pregnancies/active').set(headers).expect(200);
    expect(none.body.data).toBeNull();

    const created = await request(server())
      .post('/api/v1/pregnancies')
      .set(headers)
      .send({ lastMenstrualPeriod: '2026-08-20', dateConfidence: 'certain' })
      .expect(201);
    expect(created.status).toBe(201);

    const active = await request(server()).get('/api/v1/pregnancies/active').set(headers).expect(200);
    expect(active.body.data.currentTrimester).toBe(1);
    expect(active.body.data.status).toBe('active');
    expect(active.body.data.disclaimer).toContain('estimates');

    const logged = await request(server())
      .put('/api/v1/pregnancy-logs/2026-10-20')
      .set(headers)
      .send({ nausea: 'mild', symptoms: ['fatigue'], water: 6, notes: 'pregnancy alias note' })
      .expect(200);
    expect(logged.body.data.log.notes).toBe('pregnancy alias note');
    expect(logged.body.data.log.notesEncrypted).toBeUndefined();

    const read = await request(server()).get('/api/v1/pregnancy-logs/2026-10-20').set(headers).expect(200);
    expect(read.body.data.notes).toBe('pregnancy alias note');
    expect(read.body.data.water).toBe(6);

    const stored = await getDb(app)
      .collection('pregnancy_logs')
      .findOne({ date: '2026-10-20', userId: new mongoose.Types.ObjectId(user.userId!) });
    expect(JSON.stringify(stored)).not.toContain('pregnancy alias note');

    // No active pregnancy: the date-keyed write fails closed instead of guessing one.
    const { user: other } = await registerAndLogin(app);
    await request(server())
      .put('/api/v1/pregnancy-logs/2026-10-20')
      .set(authHeader(other.accessToken!))
      .send({ symptoms: ['fatigue'] })
      .expect(404);
  });
});
