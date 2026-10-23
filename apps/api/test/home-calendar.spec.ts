import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import { authHeader, createTestApp, registerAndLogin } from './helpers';

describe('Home and calendar (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await mongoose.disconnect().catch(() => undefined); await app.close(); });

  it('aggregates persisted owner state and excludes free-text daily notes', async () => {
    const { user } = await registerAndLogin(app);
    const headers = authHeader(user.accessToken!);
    await request(app.getHttpServer()).post('/api/v1/cycles/start-period').set(headers).send({ date: '2026-10-01' }).expect(201);
    await request(app.getHttpServer()).put('/api/v1/daily-logs/2026-10-18').set(headers).send({ symptoms: ['fatigue'], notes: 'private note' }).expect(200);

    const home = await request(app.getHttpServer()).get('/api/v1/home').set(headers).expect(200);
    expect(home.body.data.cycle).toMatchObject({ startedAt: '2026-10-01', status: 'active' });
    expect(home.body.data.pregnancy).toBeNull();
    expect(home.body.data.recentLogs).toHaveLength(1);
    expect(home.body.data.recentLogs[0].symptoms).toEqual(['fatigue']);
    expect(home.body.data.recentLogs[0]).not.toHaveProperty('notes');
    expect(JSON.stringify(home.body)).not.toContain('private note');
  });

  it('returns inclusive date-filtered calendar entries only for the caller, without notes', async () => {
    const { user: owner } = await registerAndLogin(app);
    const { user: other } = await registerAndLogin(app);
    const server = app.getHttpServer();
    await request(server).put('/api/v1/daily-logs/2026-10-01').set(authHeader(owner.accessToken!)).send({ symptoms: ['one'], notes: 'owner secret' }).expect(200);
    await request(server).put('/api/v1/daily-logs/2026-10-02').set(authHeader(owner.accessToken!)).send({ symptoms: ['two'] }).expect(200);
    await request(server).put('/api/v1/daily-logs/2026-10-02').set(authHeader(other.accessToken!)).send({ symptoms: ['other user'] }).expect(200);

    const response = await request(server).get('/api/v1/daily-logs?from=2026-10-01&to=2026-10-02').set(authHeader(owner.accessToken!)).expect(200);
    expect(response.body.data.logs).toHaveLength(2);
    expect(response.body.data.logs.map((entry: any) => entry.date)).toEqual(['2026-10-01', '2026-10-02']);
    expect(response.body.data.logs[0]).not.toHaveProperty('notes');
    expect(JSON.stringify(response.body)).not.toContain('owner secret');
    expect(JSON.stringify(response.body)).not.toContain('other user');
  });

  it.each([
    '2026-02-30',
    '2026-10-02',
  ])('rejects invalid or reversed date ranges (%s)', async (from) => {
    const { user } = await registerAndLogin(app);
    const to = from === '2026-10-02' ? '2026-10-01' : '2026-03-01';
    await request(app.getHttpServer()).get(`/api/v1/daily-logs?from=${from}&to=${to}`).set(authHeader(user.accessToken!)).expect(400);
  });

  it('rejects calendar ranges larger than 93 inclusive days', async () => {
    const { user } = await registerAndLogin(app);
    await request(app.getHttpServer()).get('/api/v1/daily-logs?from=2026-01-01&to=2026-04-04').set(authHeader(user.accessToken!)).expect(400);
  });
});
