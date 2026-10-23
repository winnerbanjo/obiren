import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import { Types } from 'mongoose';
import { authHeader, createTestApp, getDb, idempotencyHeader, registerAndLogin, setUserRole } from './helpers';

/**
 * Cross-user access ("guess another user's id") coverage for every resource
 * family. A resource that belongs to someone else must behave exactly like a
 * missing resource: 404 for owner-scoped lookups and mutations, 403 for the
 * Health Vault document routes (their contract is 403 by design).
 */
describe('Cross-user access (IDOR) coverage (e2e)', () => {
  let app: INestApplication;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await mongoose.disconnect().catch(() => undefined);
    await app.close();
  });

  it('does not expose another user’s daily logs, cycles or pregnancy data', async () => {
    const { user: owner } = await registerAndLogin(app);
    const { user: other } = await registerAndLogin(app);
    const ownerHeaders = authHeader(owner.accessToken!);
    const otherHeaders = authHeader(other.accessToken!);

    const log = await request(server())
      .put('/api/v1/daily-logs/2026-09-03')
      .set(ownerHeaders)
      .send({ bleeding: { level: 'light' }, notes: 'owner only' })
      .expect(200);

    const otherLog = await request(server()).get('/api/v1/daily-logs/2026-09-03').set(otherHeaders).expect(200);
    expect(otherLog.body.data.version ?? 0).toBe(0);
    expect(JSON.stringify(otherLog.body)).not.toContain('owner only');

    await request(server())
      .patch('/api/v1/daily-logs/2026-09-03')
      .set(otherHeaders)
      .send({ version: log.body.data.version, notes: 'hijack' })
      .expect(404);
    await request(server())
      .delete('/api/v1/daily-logs/2026-09-03')
      .set(otherHeaders)
      .query({ version: log.body.data.version })
      .expect(404);

    const cycle = await request(server()).post('/api/v1/cycles/start-period').set(ownerHeaders).send({ date: '2026-09-01' }).expect(201);
    await request(server()).get(`/api/v1/cycles/history/${cycle.body.data.cycle._id}`).set(otherHeaders).expect(404);
    await request(server()).patch(`/api/v1/cycles/${cycle.body.data.cycle._id}`).set(otherHeaders).send({ notes: 'hijack' }).expect(404);

    const pregnancy = await request(server())
      .post('/api/v1/pregnancies')
      .set(ownerHeaders)
      .send({ lastMenstrualPeriod: '2026-06-01' })
      .expect(201);
    const pregnancyId = pregnancy.body.data._id;
    await request(server())
      .put(`/api/v1/pregnancies/${pregnancyId}/logs/2026-09-05`)
      .set(ownerHeaders)
      .send({ symptoms: ['fatigue'] })
      .expect(200);

    await request(server()).get(`/api/v1/pregnancies/${pregnancyId}/timeline`).set(otherHeaders).expect(404);
    await request(server())
      .put(`/api/v1/pregnancies/${pregnancyId}/logs/2026-09-06`)
      .set(otherHeaders)
      .send({ symptoms: ['fatigue'] })
      .expect(404);
    const otherPregnancyLog = await request(server()).get('/api/v1/pregnancies/logs/2026-09-05').set(otherHeaders).expect(200);
    expect(otherPregnancyLog.body.data.version).toBe(0);
  });

  it('does not expose or cancel another user’s booking hold or guardian contact', async () => {
    const { user: owner } = await registerAndLogin(app);
    const { user: other } = await registerAndLogin(app);
    const db = getDb(app);
    const now = new Date();

    // A booked hold needs a verified, priced clinician. The record is removed at
    // the end of this test so the shared catalog assertions in other specs stay
    // valid.
    const clinicianId = new Types.ObjectId();
    await db.collection('clinicians').insertOne({
      _id: clinicianId,
      userId: new Types.ObjectId(),
      displayName: 'IDOR Fixture Clinician',
      countryCode: 'NG',
      specialties: ['obgyn'],
      languages: ['en'],
      verificationStatus: 'verified',
      active: true,
      feeBySessionType: { video: 2500000 },
      createdAt: now,
      updatedAt: now,
    });
    const slot = await db.collection('availability_slots').insertOne({
      clinicianId,
      startsAt: new Date(now.getTime() + 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 90 * 60 * 1000),
      sessionType: 'video',
      status: 'open',
      createdAt: now,
      updatedAt: now,
    });

    const hold = await request(server())
      .post('/api/v1/bookings/hold')
      .set(authHeader(owner.accessToken!))
      .set(idempotencyHeader('hold'))
      .send({ slotId: slot.insertedId.toString() })
      .expect(201);
    const bookingId = hold.body.data.booking.id as string;
    expect(hold.body.data.booking.status).toBe('held');

    const otherBookings = await request(server()).get('/api/v1/bookings?status=held').set(authHeader(other.accessToken!)).expect(200);
    expect(otherBookings.body.data.bookings).toHaveLength(0);
    await request(server())
      .post(`/api/v1/bookings/${bookingId}/cancel`)
      .set(authHeader(other.accessToken!))
      .send({ reason: 'IDOR check' })
      .expect(404);
    const stillHeld = await request(server()).get('/api/v1/bookings?status=held').set(authHeader(owner.accessToken!)).expect(200);
    expect((stillHeld.body.data.bookings as Array<{ id: string }>).map((item) => item.id)).toContain(bookingId);

    const guardian = await request(server())
      .post('/api/v1/safety/guardians')
      .set(authHeader(owner.accessToken!))
      .set(idempotencyHeader('guardian'))
      .send({ name: 'Owner contact', phoneE164: '+2348099990000', scopes: ['sos_alert'] })
      .expect(201);
    const guardianId = guardian.body.data.contact._id;

    const otherGuardians = await request(server()).get('/api/v1/safety/guardians').set(authHeader(other.accessToken!)).expect(200);
    expect(JSON.stringify(otherGuardians.body)).not.toContain('Owner contact');
    await request(server()).delete(`/api/v1/safety/guardians/${guardianId}`).set(authHeader(other.accessToken!)).expect(404);

    // Leave the shared catalog exactly as it was found.
    await db.collection('bookings').deleteMany({ slotId: slot.insertedId });
    await db.collection('booking_holds').deleteMany({ slotId: slot.insertedId });
    await db.collection('availability_slots').deleteOne({ _id: slot.insertedId });
    await db.collection('clinicians').deleteOne({ _id: clinicianId });
  });

  it('does not expose another user’s devices, notifications or consultation messages', async () => {
    const { user: owner } = await registerAndLogin(app);
    const { user: other } = await registerAndLogin(app);
    const db = getDb(app);

    const device = await request(server())
      .post('/api/v1/devices')
      .set(authHeader(owner.accessToken!))
      .send({ platform: 'ios', token: `owner-device-${Date.now()}-${'a'.repeat(20)}` })
      .expect(201);
    const otherDevices = await request(server()).get('/api/v1/devices').set(authHeader(other.accessToken!)).expect(200);
    expect(otherDevices.body.data).toHaveLength(0);
    await request(server()).delete(`/api/v1/devices/${device.body.data.id}`).set(authHeader(other.accessToken!)).expect(404);

    const notification = await db.collection('notification_outbox').insertOne({
      userId: new Types.ObjectId(owner.userId!),
      recipient: { email: owner.email },
      type: 'reminder',
      category: 'REMINDER',
      channel: 'in_app',
      templateKey: 'reminder',
      templateData: { title: 'Private cycle reminder', body: 'Private body text' },
      scheduledFor: new Date(),
      status: 'sent',
      idempotencyKey: `notif-${Date.now()}-${Math.random()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await request(server())
      .patch(`/api/v1/notifications/${notification.insertedId.toString()}/read`)
      .set(authHeader(other.accessToken!))
      .expect(404);

    const consultation = await db.collection('consultations').insertOne({
      patientUserId: new Types.ObjectId(owner.userId!),
      clinicianUserId: new Types.ObjectId(other.userId!),
      participantUserIds: [new Types.ObjectId(owner.userId!), new Types.ObjectId(other.userId!)],
      status: 'open',
      lastMessageAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const { user: intruder } = await registerAndLogin(app);
    const intruderHeaders = authHeader(intruder.accessToken!);

    const intruderList = await request(server()).get('/api/v1/consultations').set(intruderHeaders).expect(200);
    expect(intruderList.body.data.consultations).toHaveLength(0);
    await request(server()).get(`/api/v1/consultations/${consultation.insertedId.toString()}/messages`).set(intruderHeaders).expect(404);
    await request(server())
      .post(`/api/v1/consultations/${consultation.insertedId.toString()}/messages`)
      .set(intruderHeaders)
      .send({ body: 'intrusion' })
      .expect(404);
    await request(server())
      .post(`/api/v1/consultations/${consultation.insertedId.toString()}/read`)
      .set(intruderHeaders)
      .expect(404);
  });

  it('returns only explicitly consented health shares and the owner controls revocation', async () => {
    const { user: owner } = await registerAndLogin(app);
    const { user: recipient } = await registerAndLogin(app);
    const { user: intruder } = await registerAndLogin(app);

    await request(server())
      .post('/api/v1/consents')
      .set(authHeader(owner.accessToken!))
      .send({ purpose: 'health_sharing', policyVersion: 'privacy-1.0', granted: true, source: 'settings' })
      .expect(201);

    await request(server())
      .put('/api/v1/daily-logs/2026-09-20')
      .set(authHeader(owner.accessToken!))
      .send({ symptoms: ['headache'], notes: 'never shared' })
      .expect(200);

    const share = await request(server())
      .post('/api/v1/health-shares')
      .set(authHeader(owner.accessToken!))
      .send({
        recipientUserId: recipient.userId,
        scopes: ['daily_logs'],
        from: '2026-09-01',
        to: '2026-09-30',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .expect(201);

    const received = await request(server()).get('/api/v1/health-shares/received').set(authHeader(recipient.accessToken!)).expect(200);
    expect(received.body.data).toHaveLength(1);
    expect(received.body.data[0].ownerUserId).toBe(owner.userId);
    expect(JSON.stringify(received.body)).not.toContain('never shared');

    const intruderShares = await request(server()).get('/api/v1/health-shares/received').set(authHeader(intruder.accessToken!)).expect(200);
    expect(intruderShares.body.data).toHaveLength(0);
    await request(server()).delete(`/api/v1/health-shares/${share.body.data.id}`).set(authHeader(intruder.accessToken!)).expect(404);
    await request(server()).delete(`/api/v1/health-shares/${share.body.data.id}`).set(authHeader(owner.accessToken!)).expect(200);
    const afterRevoke = await request(server()).get('/api/v1/health-shares/received').set(authHeader(recipient.accessToken!)).expect(200);
    expect(afterRevoke.body.data).toHaveLength(0);
  });

  it('gives a clinician role no patient access without an explicit share', async () => {
    const { user: patient } = await registerAndLogin(app);
    const { user: clinician } = await registerAndLogin(app);
    await setUserRole(app, clinician.userId!, 'clinician');

    await request(server())
      .put('/api/v1/daily-logs/2026-09-12')
      .set(authHeader(patient.accessToken!))
      .send({ symptoms: ['cramps'], notes: 'patient private' })
      .expect(200);

    const clinicianHeaders = authHeader(clinician.accessToken!);

    // Owner-scoped reads stay empty and never disclose the patient's diary.
    const log = await request(server()).get('/api/v1/daily-logs/2026-09-12').set(clinicianHeaders).expect(200);
    expect(log.body.data.version ?? 0).toBe(0);
    expect(JSON.stringify(log.body)).not.toContain('patient private');
    const cycles = await request(server()).get('/api/v1/cycles/current').set(clinicianHeaders).expect(200);
    expect(cycles.body.data).toBeNull();
    const shares = await request(server()).get('/api/v1/health-shares/received').set(clinicianHeaders).expect(200);
    expect(shares.body.data).toHaveLength(0);

    // The role passes the roles guard, but publishing availability requires a
    // verified clinician profile, which this account does not have.
    const availability = await request(server())
      .post('/api/v1/clinician/slots')
      .set(clinicianHeaders)
      .send({
        startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        endsAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        sessionType: 'audio',
      })
      .expect(403);
    expect(availability.body.error.message).toMatch(/clinician profile/i);

    // Without the role the same call is denied by the roles guard.
    const { user: plainUser } = await registerAndLogin(app);
    const denied = await request(server())
      .post('/api/v1/clinician/slots')
      .set(authHeader(plainUser.accessToken!))
      .send({
        startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        endsAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        sessionType: 'audio',
      })
      .expect(403);
    expect(denied.body.error.message).toMatch(/required role/i);
  });

  it('does not let another user read a Health Vault document', async () => {
    const { user: owner } = await registerAndLogin(app);
    const { user: other } = await registerAndLogin(app);

    const document = await request(server())
      .post('/api/v1/health-vault/documents')
      .set(authHeader(owner.accessToken!))
      .send({ title: 'Private lab result', cloudinaryPublicId: `vault/${Date.now()}`, documentType: 'laboratory_result' })
      .expect(201);

    const otherList = await request(server()).get('/api/v1/health-vault/documents').set(authHeader(other.accessToken!)).expect(200);
    expect(otherList.body.data).toHaveLength(0);

    const denied = await request(server())
      .get(`/api/v1/health-vault/documents/${document.body.data._id}`)
      .set(authHeader(other.accessToken!));
    expect([403, 404]).toContain(denied.status);
    expect(JSON.stringify(denied.body)).not.toContain('Private lab result');
  });
});
