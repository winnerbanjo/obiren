import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import { createHmac } from 'crypto';
import { authHeader, createTestApp, getDb, idempotencyHeader, registerAndLogin, setUserRole } from './helpers';

const CLINICIAN_NAME = 'Dr Fail Closed';

/**
 * Payments must fail closed: without an approved policy version and
 * credentials, checkout and the webhook do nothing at all.
 */
describe('Payments fail closed when not approved (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    delete process.env.PAYMENT_ENABLED;
    delete process.env.PAYMENT_POLICY_VERSION;
    delete process.env.PAYSTACK_SECRET_KEY;
    app = await createTestApp();
  });

  afterAll(async () => {
    await getDb(app).collection('clinicians').deleteMany({ displayName: CLINICIAN_NAME }).catch(() => undefined);
    await mongoose.disconnect().catch(() => undefined);
    await app.close();
  });

  it('keeps holds free, refuses checkout, and never changes state from an unsigned webhook', async () => {
    const { user: clinicianUser } = await registerAndLogin(app);
    await setUserRole(app, clinicianUser.userId!, 'clinician');
    const clinicianId = new mongoose.Types.ObjectId();
    await getDb(app).collection('clinicians').insertOne({
      _id: clinicianId,
      userId: new mongoose.Types.ObjectId(clinicianUser.userId!),
      displayName: CLINICIAN_NAME,
      countryCode: 'NG',
      specialties: ['obgyn'],
      languages: ['en'],
      feeBySessionType: { video: 200_000 },
      verificationStatus: 'verified',
      active: true,
    });
    const startsAt = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const { insertedId: slotId } = await getDb(app).collection('availability_slots').insertOne({
      clinicianId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60_000),
      sessionType: 'video',
      status: 'open',
    });

    const { user } = await registerAndLogin(app);
    const hold = await request(app.getHttpServer())
      .post('/api/v1/bookings/hold')
      .set(authHeader(user.accessToken!))
      .set(idempotencyHeader('disabled-hold'))
      .send({ slotId: slotId.toString() })
      .expect(201);
    expect(hold.body.data.checkoutEnabled).toBe(false);
    const bookingId = hold.body.data.booking.id;

    const intent = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${bookingId}/payment-intent`)
      .set(authHeader(user.accessToken!))
      .set(idempotencyHeader('disabled-intent'))
      .send({})
      .expect(503);
    expect(intent.body.error.message).toContain('No payment was attempted');

    const booking = await request(app.getHttpServer())
      .get(`/api/v1/bookings/${bookingId}`)
      .set(authHeader(user.accessToken!))
      .expect(200);
    expect(booking.body.data.booking.status).toBe('held');
    expect(booking.body.data.payment).toBeNull();

    const payments = await getDb(app).collection('payments').countDocuments({ bookingId: new mongoose.Types.ObjectId(bookingId) });
    expect(payments).toBe(0);

    // Even a well-formed, correctly-signed payload cannot be processed.
    const payload = JSON.stringify({ event: 'charge.success', data: { id: 1, reference: 'obiren-unknown', amount: 200_000, currency: 'NGN' } });
    await request(app.getHttpServer())
      .post('/api/v1/webhooks/paystack')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', createHmac('sha512', 'unapproved').update(payload).digest('hex'))
      .send(payload)
      .expect(503);

    const unchanged = await getDb(app).collection('bookings').findOne({ _id: new mongoose.Types.ObjectId(bookingId) });
    expect(unchanged!.status).toBe('held');
  });
});
