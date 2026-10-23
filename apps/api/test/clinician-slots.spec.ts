import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import { authHeader, createTestApp, getDb, registerAndLogin, setUserRole } from './helpers';

/**
 * PRD `CLINICIAN /clinician/slots`: a verified clinician maintains their own
 * availability and can never read or change another clinician's inventory.
 */
describe('Clinician availability (e2e)', () => {
  let app: INestApplication;
  const server = () => app.getHttpServer();
  // The database is shared across suites; leave the verified catalog as found.
  const createdClinicianIds: mongoose.Types.ObjectId[] = [];

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    if (createdClinicianIds.length > 0) {
      const db = getDb(app);
      await db.collection('availability_slots').deleteMany({ clinicianId: { $in: createdClinicianIds } });
      await db.collection('clinicians').deleteMany({ _id: { $in: createdClinicianIds } });
    }
    await mongoose.disconnect().catch(() => undefined);
    await app.close();
  });

  const makeClinician = async (displayName: string) => {
    const { user } = await registerAndLogin(app);
    await setUserRole(app, user.userId!, 'clinician');
    const clinicianId = new mongoose.Types.ObjectId();
    createdClinicianIds.push(clinicianId);
    await getDb(app).collection('clinicians').insertOne({
      _id: clinicianId,
      userId: new mongoose.Types.ObjectId(user.userId!),
      displayName,
      countryCode: 'NG',
      specialties: ['obgyn'],
      languages: ['en'],
      verificationStatus: 'verified',
      active: true,
      feeBySessionType: { video: 2500000, audio: 1500000 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { user, clinicianId };
  };

  // Availability must sit on whole-minute boundaries (server rule).
  const future = (hours: number) => {
    const at = new Date(Date.now() + hours * 60 * 60 * 1000);
    at.setSeconds(0, 0);
    return at.toISOString();
  };

  it('creates, lists, updates and deletes the caller’s own slots', async () => {
    const { user } = await makeClinician('Dr Slot Owner');
    const headers = authHeader(user.accessToken!);

    const created = await request(server())
      .post('/api/v1/clinician/slots')
      .set(headers)
      .send({ startsAt: future(2), endsAt: future(3), sessionType: 'video' })
      .expect(201);
    const slotId = created.body.data.id as string;
    expect(created.body.data).toMatchObject({ sessionType: 'video', status: 'open' });
    expect(created.body.data.holdExpiresAt).toBeNull();

    const listed = await request(server()).get('/api/v1/clinician/slots').set(headers).expect(200);
    expect((listed.body.data.slots as Array<{ id: string }>).map((slot) => slot.id)).toContain(slotId);

    const updated = await request(server())
      .patch(`/api/v1/clinician/slots/${slotId}`)
      .set(headers)
      .send({ sessionType: 'audio', startsAt: future(4), endsAt: future(5) })
      .expect(200);
    expect(updated.body.data).toMatchObject({ id: slotId, sessionType: 'audio', status: 'open' });
    expect(new Date(updated.body.data.startsAt).getTime()).toBeGreaterThan(Date.now());

    const removed = await request(server()).delete(`/api/v1/clinician/slots/${slotId}`).set(headers).expect(200);
    expect(removed.body.data).toMatchObject({ slotId, deleted: true });

    const afterDelete = await request(server()).get('/api/v1/clinician/slots').set(headers).expect(200);
    expect(afterDelete.body.data.slots).toHaveLength(0);
  });

  it('rejects malformed or past slots', async () => {
    const { user } = await makeClinician('Dr Slot Validation');
    const headers = authHeader(user.accessToken!);

    await request(server())
      .post('/api/v1/clinician/slots')
      .set(headers)
      .send({ startsAt: future(-3), endsAt: future(-1), sessionType: 'video' })
      .expect(400);

    await request(server())
      .post('/api/v1/clinician/slots')
      .set(headers)
      .send({ startsAt: future(2), endsAt: future(1), sessionType: 'video' })
      .expect(400);

    // Unknown fields are rejected rather than silently dropped.
    await request(server())
      .post('/api/v1/clinician/slots')
      .set(headers)
      .send({ startsAt: future(2), endsAt: future(3), sessionType: 'video', price: 100 })
      .expect(400);
  });

  it('never lets a clinician read or mutate another clinician’s slot', async () => {
    const owner = await makeClinician('Dr Ownership');
    const intruder = await makeClinician('Dr Intruder');

    const created = await request(server())
      .post('/api/v1/clinician/slots')
      .set(authHeader(owner.user.accessToken!))
      .send({ startsAt: future(6), endsAt: future(7), sessionType: 'video' })
      .expect(201);
    const slotId = created.body.data.id as string;

    const intruderList = await request(server()).get('/api/v1/clinician/slots').set(authHeader(intruder.user.accessToken!)).expect(200);
    expect((intruderList.body.data.slots as Array<{ id: string }>).map((slot) => slot.id)).not.toContain(slotId);

    await request(server())
      .patch(`/api/v1/clinician/slots/${slotId}`)
      .set(authHeader(intruder.user.accessToken!))
      .send({ sessionType: 'text' })
      .expect(404);
    await request(server())
      .delete(`/api/v1/clinician/slots/${slotId}`)
      .set(authHeader(intruder.user.accessToken!))
      .expect(404);
  });

  it('refuses to change a slot that is held or booked', async () => {
    const { user, clinicianId } = await makeClinician('Dr Held Slot');
    const headers = authHeader(user.accessToken!);

    const created = await request(server())
      .post('/api/v1/clinician/slots')
      .set(headers)
      .send({ startsAt: future(8), endsAt: future(9), sessionType: 'video' })
      .expect(201);
    const slotId = created.body.data.id as string;

    await getDb(app)
      .collection('availability_slots')
      .updateOne({ _id: new mongoose.Types.ObjectId(slotId) }, { $set: { status: 'booked' } });

    await request(server())
      .patch(`/api/v1/clinician/slots/${slotId}`)
      .set(headers)
      .send({ sessionType: 'audio' })
      .expect(409);
    await request(server()).delete(`/api/v1/clinician/slots/${slotId}`).set(headers).expect(409);

    // The slot still exists and still belongs to the original clinician.
    const stored = await getDb(app)
      .collection('availability_slots')
      .findOne({ _id: new mongoose.Types.ObjectId(slotId) });
    expect(stored?.status).toBe('booked');
    expect(stored?.clinicianId.toString()).toBe(clinicianId.toString());
  });

  it('requires the clinician role and a verified profile', async () => {
    const { user } = await registerAndLogin(app);
    await request(server()).get('/api/v1/clinician/slots').set(authHeader(user.accessToken!)).expect(403);

    // Role alone is not enough: verification is required.
    const { user: unverified } = await registerAndLogin(app);
    await setUserRole(app, unverified.userId!, 'clinician');
    const res = await request(server()).get('/api/v1/clinician/slots').set(authHeader(unverified.accessToken!)).expect(403);
    expect(res.body.error.message).toMatch(/verified clinician profile/i);
  });
});
