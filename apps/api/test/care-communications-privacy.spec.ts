import * as request from 'supertest';
import * as crypto from 'crypto';
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import { authHeader, createTestApp, getDb, idempotencyHeader, registerAndLogin, setUserRole } from './helpers';

describe('Care, communications, guardians and privacy jobs (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await mongoose.disconnect().catch(() => undefined); await app.close(); });

  it('does not expose unverified clinicians and atomically permits only one competing hold', async () => {
    const { user: clinician } = await registerAndLogin(app);
    const { user: first } = await registerAndLogin(app);
    const { user: second } = await registerAndLogin(app);
    await setUserRole(app, clinician.userId!, 'clinician');
    const db = getDb(app);
    const clinicianId = new mongoose.Types.ObjectId();
    await db.collection('clinicians').insertOne({ _id: clinicianId, userId: new mongoose.Types.ObjectId(clinician.userId!), displayName: 'Unverified Provider', countryCode: 'NG', specialties: ['obgyn'], languages: ['en'], verificationStatus: 'pending', active: true, feeBySessionType: { video: 2500000 } });
    const hidden = await request(app.getHttpServer()).get('/api/v1/specialists').expect(200);
    expect(hidden.body.data.specialists).toHaveLength(0);

    await db.collection('clinicians').updateOne({ _id: clinicianId }, { $set: { verificationStatus: 'verified' } });
    const slot = await db.collection('availability_slots').insertOne({ clinicianId, startsAt: new Date(Date.now() + 60 * 60 * 1000), endsAt: new Date(Date.now() + 90 * 60 * 1000), sessionType: 'video', status: 'open' });
    const available = await request(app.getHttpServer()).get(`/api/v1/care/availability?from=${new Date().toISOString()}&to=${new Date(Date.now() + 2 * 86400000).toISOString()}&countryCode=NG`).expect(200);
    expect(available.body.data).toHaveLength(1);

    const responses = await Promise.all([
      request(app.getHttpServer()).post('/api/v1/bookings/hold').set(authHeader(first.accessToken!)).set(idempotencyHeader('hold-first')).send({ slotId: slot.insertedId.toString() }),
      request(app.getHttpServer()).post('/api/v1/bookings/hold').set(authHeader(second.accessToken!)).set(idempotencyHeader('hold-second')).send({ slotId: slot.insertedId.toString() }),
    ]);
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
    const winningUser = responses[0].status === 201 ? first : second;
    const losingUser = responses[0].status === 201 ? second : first;
    const won = responses.find((response) => response.status === 201)!;
    // Server-priced, held booking; checkout stays disabled without credentials.
    expect(won.body.data.booking.status).toBe('held');
    expect(won.body.data.booking.amountMinor).toBe(2500000);
    expect(won.body.data.booking.currency).toBe('NGN');
    expect(won.body.data.checkoutEnabled).toBe(false);

    const listed = await request(app.getHttpServer()).get('/api/v1/bookings?status=held').set(authHeader(winningUser.accessToken!)).expect(200);
    expect(listed.body.data.bookings).toHaveLength(1);
    const other = await request(app.getHttpServer()).get('/api/v1/bookings?status=held').set(authHeader(losingUser.accessToken!)).expect(200);
    expect(other.body.data.bookings).toHaveLength(0);
  });

  it('fails closed for checkout and blocks arbitrary users from publishing clinician slots', async () => {
    const { user } = await registerAndLogin(app);
    await request(app.getHttpServer()).post('/api/v1/clinician/slots').set(authHeader(user.accessToken!)).send({ startsAt: new Date(Date.now()+3600000).toISOString(), endsAt: new Date(Date.now()+7200000).toISOString(), sessionType: 'video' }).expect(403);
  });

  it('keeps notification content discreet by default and owner-scopes reads/preferences', async () => {
    const { user: owner } = await registerAndLogin(app);
    const { user: other } = await registerAndLogin(app);
    const db = getDb(app);
    const inserted = await db.collection('notification_outbox').insertOne({ userId: new mongoose.Types.ObjectId(owner.userId!), recipient: {}, type: 'HEALTH_REMINDER', category: 'REMINDER', channel: 'in_app', templateKey: 'private', templateData: { title: 'Pregnancy symptom', body: 'private health details' }, scheduledFor: new Date(), status: 'delivered', idempotencyKey: `inbox-${Date.now()}` });
    const inbox = await request(app.getHttpServer()).get('/api/v1/notifications').set(authHeader(owner.accessToken!)).expect(200);
    expect(inbox.body.data.notifications[0].body).not.toContain('private health');
    await request(app.getHttpServer()).patch(`/api/v1/notifications/${inserted.insertedId}/read`).set(authHeader(other.accessToken!)).expect(404);
    await request(app.getHttpServer()).patch(`/api/v1/notifications/${inserted.insertedId}/read`).set(authHeader(owner.accessToken!)).expect(200);
    await request(app.getHttpServer()).patch('/api/v1/notification-preferences').set(authHeader(owner.accessToken!)).send({ discreetMode: false }).expect(200);
    const visible = await request(app.getHttpServer()).get('/api/v1/notifications').set(authHeader(owner.accessToken!)).expect(200);
    expect(visible.body.data.notifications[0].body).toContain('private health details');
  });

  it('gates health shares behind consent, scopes evidence to the owner range, and enforces expiry and revocation', async () => {
    const { user: owner } = await registerAndLogin(app);
    const { user: recipient } = await registerAndLogin(app);
    const { user: stranger } = await registerAndLogin(app);
    const server = app.getHttpServer();
    const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
    const payload = { recipientUserId: recipient.userId!, scopes: ['cycles', 'daily_logs'], from: '2026-09-01', to: '2026-10-01', expiresAt };

    await request(server).post('/api/v1/health-shares').set(authHeader(owner.accessToken!)).send(payload).expect(404);
    await request(server).post('/api/v1/consents').set(authHeader(owner.accessToken!)).send({ purpose: 'health_sharing', policyVersion: 'test-v1', granted: true, source: 'settings' }).expect(201);
    await request(server).post('/api/v1/health-shares').set(authHeader(owner.accessToken!)).send({ ...payload, recipientUserId: owner.userId }).expect(400);
    await request(server).post('/api/v1/health-shares').set(authHeader(owner.accessToken!)).send({ ...payload, scopes: ['admin'] }).expect(400);
    await request(server).post('/api/v1/health-shares').set(authHeader(owner.accessToken!)).send({ ...payload, expiresAt: new Date(Date.now() + 45 * 86400000).toISOString() }).expect(400);

    await request(server).post('/api/v1/cycles/start-period').set(authHeader(owner.accessToken!)).send({ date: '2026-09-05' }).expect(201);
    await request(server).put('/api/v1/daily-logs/2026-09-06').set(authHeader(owner.accessToken!)).send({ symptoms: ['cramps'], notes: 'private owner note' }).expect(200);

    const created = await request(server).post('/api/v1/health-shares').set(authHeader(owner.accessToken!)).send(payload).expect(201);
    expect(created.body.data).toMatchObject({ scopes: ['cycles', 'daily_logs'], evidenceFrom: '2026-09-01', evidenceTo: '2026-10-01', status: 'active' });

    const strangerView = await request(server).get('/api/v1/health-shares/received').set(authHeader(stranger.accessToken!)).expect(200);
    expect(strangerView.body.data).toHaveLength(0);

    const received = await request(server).get('/api/v1/health-shares/received').set(authHeader(recipient.accessToken!)).expect(200);
    expect(received.body.data).toHaveLength(1);
    expect(received.body.data[0].data.cycles).toHaveLength(1);
    expect(received.body.data[0].data.logs[0]).toMatchObject({ date: '2026-09-06', symptoms: ['cramps'] });
    expect(JSON.stringify(received.body)).not.toContain('private owner note');

    await request(server).delete(`/api/v1/health-shares/${created.body.data.id}`).set(authHeader(recipient.accessToken!)).expect(404);
    await request(server).delete(`/api/v1/health-shares/${created.body.data.id}`).set(authHeader(owner.accessToken!)).expect(200);
    const afterRevoke = await request(server).get('/api/v1/health-shares/received').set(authHeader(recipient.accessToken!)).expect(200);
    expect(afterRevoke.body.data).toHaveLength(0);
  });

  it('does not return expired shares to the recipient', async () => {
    const { user: owner } = await registerAndLogin(app);
    const { user: recipient } = await registerAndLogin(app);
    await getDb(app).collection('health_shares').insertOne({ ownerUserId: new mongoose.Types.ObjectId(owner.userId!), recipientUserId: new mongoose.Types.ObjectId(recipient.userId!), scopes: ['cycles'], evidenceFrom: '2026-09-01', evidenceTo: '2026-10-01', redactedSnapshot: { cycles: [] }, expiresAt: new Date(Date.now() - 60000), consentedAt: new Date() });
    const received = await request(app.getHttpServer()).get('/api/v1/health-shares/received').set(authHeader(recipient.accessToken!)).expect(200);
    expect(received.body.data).toHaveLength(0);
  });

  it('adds pending guardians without exposing invite tokens, revokes owner-only, and does not claim dispatch', async () => {
    const { user: owner } = await registerAndLogin(app);
    const { user: other } = await registerAndLogin(app);
    const created = await request(app.getHttpServer()).post('/api/v1/safety/guardians').set(authHeader(owner.accessToken!)).set(idempotencyHeader('guardian')).send({ name: 'Trusted friend', phoneE164: '+2348012345678', scopes: ['sos_alert'] }).expect(201);
    expect(created.body.data.status).toBe('pending');
    expect(created.body.data).not.toHaveProperty('token');
    const contactId = created.body.data.contact._id;
    await request(app.getHttpServer()).delete(`/api/v1/safety/guardians/${contactId}`).set(authHeader(other.accessToken!)).expect(404);
    await request(app.getHttpServer()).delete(`/api/v1/safety/guardians/${contactId}`).set(authHeader(owner.accessToken!)).expect(200);
    const trigger = await request(app.getHttpServer()).post('/api/v1/safety/sos/trigger').set(authHeader(owner.accessToken!)).set(idempotencyHeader('sos')).send({ isTestMode: false }).expect(201);
    expect(trigger.body.data.incident.dispatchStatus).toBe('not_requested');
    expect(trigger.body.data.message).toContain('No emergency dispatch');
  });

  it('does not claim account erasure and supports owner cancellation of scheduled deletion', async () => {
    const { user } = await registerAndLogin(app);
    const requested = await request(app.getHttpServer()).post('/api/v1/users/me/request-deletion').set(authHeader(user.accessToken!)).expect(201);
    expect(requested.body.data.erasureCompleted).toBe(false);
    expect(requested.body.data.executionStatus).toBe('pending_operator_worker');
    const pending = await getDb(app).collection('privacy_jobs').findOne({ _id: new mongoose.Types.ObjectId(requested.body.data.jobId) });
    expect(pending.status).toBe('requested');
    await request(app.getHttpServer()).post('/api/v1/users/me/cancel-deletion').set(authHeader(user.accessToken!)).expect(201);
    const cancelled = await getDb(app).collection('privacy_jobs').findOne({ _id: pending._id });
    expect(cancelled.status).toBe('cancelled');
  });
});
