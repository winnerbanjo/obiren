import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import { authHeader, createTestApp, getDb, registerAndLogin, setUserRole } from './helpers';

/**
 * Milestones 3-5 security slice: clinician verification, consultation
 * membership, encrypted messaging, device registration, and SOS delivery
 * evidence. No test may assert a delivery, booking, or payment that was not
 * confirmed by a provider.
 */
describe('Consultations, devices and SOS delivery evidence (e2e)', () => {
  let app: INestApplication;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    // Tests share one in-memory database; remove seeded clinicians so other
    // suites that assert on the public catalog stay deterministic.
    await getDb(app)
      .collection('clinicians')
      .deleteMany({ displayName: { $in: ['Dr Ada Obi', 'Roleless Account'] } })
      .catch(() => undefined);
    await mongoose.disconnect().catch(() => undefined);
    await app.close();
  });

  async function seedClinician(opts: { verificationStatus?: string; active?: boolean } = {}) {
    const { user: clinicianUser } = await registerAndLogin(app);
    await setUserRole(app, clinicianUser.userId!, 'clinician');
    const clinicianId = new mongoose.Types.ObjectId();
    await getDb(app).collection('clinicians').insertOne({
      _id: clinicianId,
      userId: new mongoose.Types.ObjectId(clinicianUser.userId!),
      displayName: 'Dr Ada Obi',
      countryCode: 'NG',
      specialties: ['obgyn'],
      languages: ['en'],
      verificationStatus: opts.verificationStatus ?? 'pending',
      active: opts.active ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { clinicianUser, clinicianId: clinicianId.toString() };
  }

  it('requires an admin role, a clinician account, and evidence before verification', async () => {
    const { user: admin } = await registerAndLogin(app);
    const { user: patient } = await registerAndLogin(app);
    await setUserRole(app, admin.userId!, 'super_admin');
    const { clinicianId } = await seedClinician();

    await request(server())
      .put(`/api/v1/admin/clinicians/${clinicianId}/verification`)
      .set(authHeader(patient.accessToken!))
      .send({ verificationStatus: 'verified', evidenceRef: 'evidence/001' })
      .expect(403);

    const missingEvidence = await request(server())
      .put(`/api/v1/admin/clinicians/${clinicianId}/verification`)
      .set(authHeader(admin.accessToken!))
      .send({ verificationStatus: 'verified' })
      .expect(400);
    expect(missingEvidence.body.message || JSON.stringify(missingEvidence.body)).toMatch(/evidence/i);

    const verified = await request(server())
      .put(`/api/v1/admin/clinicians/${clinicianId}/verification`)
      .set(authHeader(admin.accessToken!))
      .send({ verificationStatus: 'verified', evidenceRef: 'evidence/licence-001', note: 'Licence checked' })
      .expect(200);
    expect(verified.body.data.verificationStatus).toBe('verified');
    expect(verified.body.data.active).toBe(true);

    const catalog = await request(server()).get('/api/v1/care/clinicians').expect(200);
    expect(catalog.body.data.map((item: any) => item.displayName)).toContain('Dr Ada Obi');

    // Rejection hides the clinician again and the decision is audited.
    await request(server())
      .put(`/api/v1/admin/clinicians/${clinicianId}/verification`)
      .set(authHeader(admin.accessToken!))
      .send({ verificationStatus: 'rejected', note: 'Licence expired' })
      .expect(200);
    const afterReject = await request(server()).get('/api/v1/care/clinicians').expect(200);
    // The shared test database may hold other verified clinicians; assert on
    // this record only.
    expect(afterReject.body.data.map((item: any) => item.displayName)).not.toContain('Dr Ada Obi');
    const audit = await getDb(app)
      .collection('audit_logs')
      .find({ action: 'VERIFY_CLINICIAN' })
      .toArray();
    expect(audit.length).toBe(2);
  });

  it('rejects verification when the linked account lacks the clinician role', async () => {
    const { user: admin } = await registerAndLogin(app);
    const { user: clinician } = await registerAndLogin(app);
    const { user: other } = await registerAndLogin(app);
    await setUserRole(app, admin.userId!, 'super_admin');
    await setUserRole(app, clinician.userId!, 'clinician');
    await setUserRole(app, other.userId!, 'user');
    const clinicianId = new mongoose.Types.ObjectId();
    await getDb(app).collection('clinicians').insertOne({
      _id: clinicianId,
      userId: new mongoose.Types.ObjectId(other.userId!),
      displayName: 'Roleless Account',
      countryCode: 'NG',
      specialties: [],
      languages: ['en'],
      verificationStatus: 'pending',
      active: true,
    });

    await request(server())
      .put(`/api/v1/admin/clinicians/${clinicianId.toString()}/verification`)
      .set(authHeader(admin.accessToken!))
      .send({ verificationStatus: 'verified', evidenceRef: 'evidence/002' })
      .expect(422);
  });

  it('keeps consultation messages membership-scoped, encrypted at rest, and exportable', async () => {
    const { user: admin } = await registerAndLogin(app);
    const { user: patient } = await registerAndLogin(app);
    const { clinicianUser, clinicianId } = await seedClinician({ verificationStatus: 'verified' });
    const { user: stranger } = await registerAndLogin(app);
    await setUserRole(app, admin.userId!, 'super_admin');

    await request(server())
      .post('/api/v1/admin/consultations')
      .set(authHeader(patient.accessToken!))
      .send({ patientUserId: patient.userId, clinicianId })
      .expect(403);

    const created = await request(server())
      .post('/api/v1/admin/consultations')
      .set(authHeader(admin.accessToken!))
      .send({ patientUserId: patient.userId, clinicianId })
      .expect(201);
    expect(created.body.data.bookingConfirmed).toBe(false);
    const consultationId = created.body.data.id;

    await request(server())
      .post('/api/v1/admin/consultations')
      .set(authHeader(admin.accessToken!))
      .send({ patientUserId: patient.userId, clinicianId })
      .expect(409);

    await request(server()).get(`/api/v1/consultations/${consultationId}/messages`).set(authHeader(stranger.accessToken!)).expect(404);
    await request(server())
      .post(`/api/v1/consultations/${consultationId}/messages`)
      .set(authHeader(stranger.accessToken!))
      .send({ body: 'intrusion attempt' })
      .expect(404);

    const patientList = await request(server()).get('/api/v1/consultations').set(authHeader(patient.accessToken!)).expect(200);
    expect(patientList.body.data.consultations).toHaveLength(1);
    expect(patientList.body.data.consultations[0].role).toBe('patient');
    const strangerList = await request(server()).get('/api/v1/consultations').set(authHeader(stranger.accessToken!)).expect(200);
    expect(strangerList.body.data.consultations).toHaveLength(0);

    const sent = await request(server())
      .post(`/api/v1/consultations/${consultationId}/messages`)
      .set(authHeader(patient.accessToken!))
      .send({ body: 'private symptom detail' })
      .expect(201);
    expect(sent.body.data.body).toBe('private symptom detail');

    const raw = await getDb(app).collection('consultation_messages').findOne({ consultationId: new mongoose.Types.ObjectId(consultationId) });
    expect(raw).toBeTruthy();
    expect(JSON.stringify(raw)).not.toContain('private symptom detail');
    expect(raw!.ciphertext).toBeTruthy();
    expect(raw!.senderUserId.toString()).toBe(patient.userId);

    const clinicianView = await request(server())
      .get(`/api/v1/consultations/${consultationId}/messages`)
      .set(authHeader(clinicianUser.accessToken!))
      .expect(200);
    expect(clinicianView.body.data.messages).toHaveLength(1);
    expect(clinicianView.body.data.messages[0]).toMatchObject({ body: 'private symptom detail', status: 'delivered', isOwnMessage: false });

    await request(server())
      .post(`/api/v1/consultations/${consultationId}/read`)
      .set(authHeader(stranger.accessToken!))
      .expect(404);
    const read = await request(server())
      .post(`/api/v1/consultations/${consultationId}/read`)
      .set(authHeader(clinicianUser.accessToken!))
      .expect(201);
    expect(read.body.data.markedRead).toBe(1);

    const reply = await request(server())
      .post(`/api/v1/consultations/${consultationId}/messages`)
      .set(authHeader(clinicianUser.accessToken!))
      .send({ body: 'clinic reply' })
      .expect(201);
    expect(reply.body.data.isOwnMessage).toBe(true);

    const exportBody = await request(server()).get('/api/v1/users/me/export').set(authHeader(patient.accessToken!)).expect(200);
    expect(exportBody.body.data.exportVersion).toBe('1.2');
    expect(exportBody.body.data.consultationMessages.map((message: any) => message.body)).toEqual(
      expect.arrayContaining(['private symptom detail', 'clinic reply']),
    );
    expect(JSON.stringify(exportBody.body)).not.toContain('ciphertext');

    await getDb(app).collection('consultations').updateOne(
      { _id: new mongoose.Types.ObjectId(consultationId) },
      { $set: { status: 'closed', closedAt: new Date() } },
    );
    await request(server())
      .post(`/api/v1/consultations/${consultationId}/messages`)
      .set(authHeader(patient.accessToken!))
      .send({ body: 'after close' })
      .expect(409);

    await request(server())
      .post(`/api/v1/consultations/${consultationId}/messages`)
      .set(authHeader(patient.accessToken!))
      .send({ body: '   ' })
      .expect(400);
  });

  it('hashes device tokens, never returns them, and enforces owner-only revocation', async () => {
    const { user: owner } = await registerAndLogin(app);
    const { user: other } = await registerAndLogin(app);
    const token = `push-token-${'a'.repeat(48)}`;

    const registered = await request(server())
      .post('/api/v1/devices')
      .set(authHeader(owner.accessToken!))
      .send({ platform: 'android', token, deviceName: 'Pixel' })
      .expect(201);
    expect(registered.body.data).toMatchObject({ platform: 'android', deviceName: 'Pixel', status: 'active' });
    expect(JSON.stringify(registered.body)).not.toContain(token);

    const stored = await getDb(app).collection('devices').findOne({ userId: new mongoose.Types.ObjectId(owner.userId!) });
    expect(stored).toBeTruthy();
    expect(stored!.tokenHash).not.toBe(token);
    expect(stored).not.toHaveProperty('token');

    const conflict = await request(server())
      .post('/api/v1/devices')
      .set(authHeader(other.accessToken!))
      .send({ platform: 'ios', token })
      .expect(409);
    expect(JSON.stringify(conflict.body)).not.toContain(token);

    const listed = await request(server()).get('/api/v1/devices').set(authHeader(owner.accessToken!)).expect(200);
    expect(listed.body.data).toHaveLength(1);
    expect(JSON.stringify(listed.body)).not.toContain(token);
    expect(JSON.stringify(listed.body)).not.toContain('tokenHash');
    const otherList = await request(server()).get('/api/v1/devices').set(authHeader(other.accessToken!)).expect(200);
    expect(otherList.body.data).toHaveLength(0);

    const deviceId = listed.body.data[0].id;
    await request(server()).delete(`/api/v1/devices/${deviceId}`).set(authHeader(other.accessToken!)).expect(404);
    await request(server()).delete(`/api/v1/devices/${deviceId}`).set(authHeader(owner.accessToken!)).expect(200);
    const afterRevoke = await request(server()).get('/api/v1/devices').set(authHeader(owner.accessToken!)).expect(200);
    expect(afterRevoke.body.data[0].status).toBe('revoked');

    const exported = await request(server()).get('/api/v1/users/me/export').set(authHeader(owner.accessToken!)).expect(200);
    expect(JSON.stringify(exported.body)).not.toContain(token);
    expect(JSON.stringify(exported.body)).not.toContain('tokenHash');
  });

  it('records SOS delivery attempts honestly and scopes them to the incident owner', async () => {
    const { user: owner } = await registerAndLogin(app);
    const { user: other } = await registerAndLogin(app);
    const created = await request(server())
      .post('/api/v1/safety/guardians')
      .set(authHeader(owner.accessToken!))
      .send({ name: 'Trusted friend', phoneE164: '+2348012345678', scopes: ['sos_alert'] })
      .expect(201);

    // Identity verification is a separate approved step; mark it directly here.
    await getDb(app).collection('guardian_contacts').updateOne(
      { _id: new mongoose.Types.ObjectId(created.body.data.contact._id) },
      { $set: { status: 'verified', verifiedAt: new Date() } },
    );

    const trigger = await request(server())
      .post('/api/v1/safety/sos/trigger')
      .set(authHeader(owner.accessToken!))
      .send({ isTestMode: false })
      .expect(201);
    expect(trigger.body.data.incident.dispatchStatus).toBe('failed');
    expect(trigger.body.data.deliverySummary).toMatchObject({ recordedAttempts: 1, deliveredAttempts: 0 });
    expect(trigger.body.data.message).toContain('No emergency dispatch');

    const incidentId = trigger.body.data.incident._id;
    const deliveries = await request(server())
      .get(`/api/v1/safety/sos/${incidentId}/deliveries`)
      .set(authHeader(owner.accessToken!))
      .expect(200);
    expect(deliveries.body.data.deliveryConfirmed).toBe(false);
    expect(deliveries.body.data.attempts).toHaveLength(1);
    expect(deliveries.body.data.attempts[0]).toMatchObject({
      status: 'skipped',
      failureCode: 'approved_delivery_channel_not_configured',
      channel: 'guardian_alert',
    });

    await request(server()).get(`/api/v1/safety/sos/${incidentId}/deliveries`).set(authHeader(other.accessToken!)).expect(404);

    // A second trigger within an hour is idempotent, so use a separate account
    // for the test-mode drill.
    const { user: drillUser } = await registerAndLogin(app);
    const drillGuardian = await request(server())
      .post('/api/v1/safety/guardians')
      .set(authHeader(drillUser.accessToken!))
      .send({ name: 'Drill contact', phoneE164: '+2348098765432', scopes: ['sos_alert'] })
      .expect(201);
    await getDb(app).collection('guardian_contacts').updateOne(
      { _id: new mongoose.Types.ObjectId(drillGuardian.body.data.contact._id) },
      { $set: { status: 'verified', verifiedAt: new Date() } },
    );
    const drill = await request(server())
      .post('/api/v1/safety/sos/trigger')
      .set(authHeader(drillUser.accessToken!))
      .send({ isTestMode: true })
      .expect(201);
    expect(drill.body.data.incident.dispatchStatus).toBe('simulated');
    const drillDeliveries = await request(server())
      .get(`/api/v1/safety/sos/${drill.body.data.incident._id}/deliveries`)
      .set(authHeader(drillUser.accessToken!))
      .expect(200);
    expect(drillDeliveries.body.data.deliveryConfirmed).toBe(false);
    expect(drillDeliveries.body.data.attempts[0].status).toBe('simulated');
  });
});
