import * as http from 'http';
import { AddressInfo } from 'net';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import { createHmac } from 'crypto';
import { authHeader, createTestApp, getDb, idempotencyHeader, registerAndLogin, setUserRole } from './helpers';
import { resetEnvCache } from '../src/config/env.validation';

const PAYSTACK_SECRET = 'sk_test_sandbox_local';
const CLINICIAN_NAME = 'Dr Sandbox Booking';

/**
 * A local Paystack sandbox stub. The provider adapter talks real HTTP to it,
 * so initialization, server-side verification and amount handling are exercised
 * without live credentials.
 */
describe('Specialists, bookings and Paystack payments (e2e)', () => {
  let app: INestApplication;
  let stub: http.Server;
  let clinicianId: mongoose.Types.ObjectId;
  let verifiedAmount = 250_000;
  const initialized = new Map<string, { amount: number; currency: string }>();
  let lastInitializeBody: any = null;

  beforeAll(async () => {
    stub = http.createServer((req, res) => {
      const send = (status: number, body: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      if (req.method === 'POST' && req.url === '/transaction/initialize') {
        let raw = '';
        req.on('data', (chunk) => { raw += chunk; });
        req.on('end', () => {
          if (req.headers.authorization !== `Bearer ${PAYSTACK_SECRET}`) {
            return send(401, { status: false, message: 'unauthorized' });
          }
          const body = JSON.parse(raw);
          lastInitializeBody = body;
          initialized.set(body.reference, { amount: body.amount, currency: body.currency });
          return send(200, {
            status: true,
            data: {
              authorization_url: `https://checkout.paystack.local/${body.reference}`,
              access_code: `ac_${body.reference}`,
              reference: body.reference,
            },
          });
        });
        return;
      }
      if (req.method === 'GET' && req.url?.startsWith('/transaction/verify/')) {
        const reference = decodeURIComponent(req.url.split('/').pop()!);
        const recorded = initialized.get(reference);
        return send(200, {
          status: true,
          data: {
            status: 'success',
            id: 4242,
            reference,
            amount: verifiedAmount,
            currency: recorded?.currency ?? 'NGN',
          },
        });
      }
      return send(404, { status: false });
    });
    await new Promise<void>((resolve) => stub.listen(0, '127.0.0.1', resolve));
    const { port } = stub.address() as AddressInfo;

    process.env.PAYMENT_ENABLED = 'true';
    process.env.PAYMENT_POLICY_VERSION = 'approved:test-1';
    process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET;
    process.env.PAYSTACK_API_BASE = `http://127.0.0.1:${port}`;
    process.env.PAYSTACK_CURRENCY = 'NGN';
    resetEnvCache();

    app = await createTestApp();
  });

  afterAll(async () => {
    // Shared in-memory database: remove seeded specialists so catalog
    // assertions in other suites stay deterministic.
    await getDb(app).collection('clinicians').deleteMany({ displayName: CLINICIAN_NAME }).catch(() => undefined);
    await mongoose.disconnect().catch(() => undefined);
    await app.close();
    await new Promise<void>((resolve) => stub.close(() => resolve()));
    // process.env is shared between suites in one Jest worker: never leak an
    // enabled-payments configuration into another spec.
    delete process.env.PAYMENT_ENABLED;
    delete process.env.PAYMENT_POLICY_VERSION;
    delete process.env.PAYSTACK_SECRET_KEY;
    delete process.env.PAYSTACK_API_BASE;
    delete process.env.PAYSTACK_CURRENCY;
  });

  const server = () => app.getHttpServer();

  async function seedSpecialist(
    fees: Record<string, number>,
    options: { verificationStatus?: string; displayName?: string } = {},
  ) {
    const { user } = await registerAndLogin(app);
    await setUserRole(app, user.userId!, 'clinician');
    const id = new mongoose.Types.ObjectId();
    await getDb(app).collection('clinicians').insertOne({
      _id: id,
      userId: new mongoose.Types.ObjectId(user.userId!),
      displayName: options.displayName || CLINICIAN_NAME,
      profession: 'Obstetrician & Gynaecologist',
      bio: 'Sandbox specialist',
      countryCode: 'NG',
      specialties: ['obgyn'],
      languages: ['en'],
      certifications: ['MBBS'],
      feeBySessionType: fees,
      verificationStatus: options.verificationStatus || 'verified',
      active: true,
    });
    return { id, user };
  }

  async function seedSlot(ownerClinicianId: mongoose.Types.ObjectId, sessionType = 'video', startsInMinutes = 180) {
    const startsAt = new Date(Date.now() + startsInMinutes * 60_000);
    const { insertedId } = await getDb(app).collection('availability_slots').insertOne({
      clinicianId: ownerClinicianId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60_000),
      sessionType,
      status: 'open',
    });
    return insertedId.toString();
  }

  it('lists only verified specialists with priced session types', async () => {
    clinicianId = (await seedSpecialist({ video: 250_000, audio: 150_000 })).id;
    await seedSpecialist({ video: 100_000 }, { verificationStatus: 'pending', displayName: `${CLINICIAN_NAME} Pending` });

    const catalog = await request(server()).get('/api/v1/specialists').expect(200);
    const mine = catalog.body.data.specialists.find((entry: any) => entry.id === clinicianId.toString());
    expect(mine).toMatchObject({
      displayName: CLINICIAN_NAME,
      profession: 'Obstetrician & Gynaecologist',
      currency: 'NGN',
      feeBySessionType: { video: 250_000, audio: 150_000 },
      ratingAverage: null,
    });
    expect(catalog.body.data.specialists.some((entry: any) => entry.displayName === `${CLINICIAN_NAME} Pending`)).toBe(false);

    const detail = await request(server()).get(`/api/v1/specialists/${clinicianId}`).expect(200);
    expect(detail.body.data.id).toBe(clinicianId.toString());

    await getDb(app).collection('clinicians').deleteMany({ displayName: `${CLINICIAN_NAME} Pending` });
  });

  it('rejects a hidden or unknown specialist profile', async () => {
    const { user } = await registerAndLogin(app);
    await setUserRole(app, user.userId!, 'clinician');
    const pendingId = new mongoose.Types.ObjectId();
    await getDb(app).collection('clinicians').insertOne({
      _id: pendingId,
      userId: new mongoose.Types.ObjectId(user.userId!),
      displayName: `${CLINICIAN_NAME} Hidden`,
      countryCode: 'NG',
      specialties: [],
      languages: ['en'],
      verificationStatus: 'pending',
      active: true,
    });

    await request(server()).get(`/api/v1/specialists/${pendingId}`).expect(404);
    await request(server()).get(`/api/v1/specialists/${new mongoose.Types.ObjectId()}`).expect(404);

    await getDb(app).collection('clinicians').deleteOne({ _id: pendingId });
  });

  it('returns bookable slots for one specialist only', async () => {
    const slotId = await seedSlot(clinicianId, 'video');
    const other = await seedSpecialist({ video: 90_000 }, { displayName: `${CLINICIAN_NAME} Other` });
    await seedSlot(other.id, 'video');

    const from = new Date().toISOString();
    const to = new Date(Date.now() + 5 * 86400000).toISOString();
    const slots = await request(server())
      .get(`/api/v1/specialists/${clinicianId}/slots?from=${from}&to=${to}&sessionType=video`)
      .expect(200);
    expect(slots.body.data.specialist.id).toBe(clinicianId.toString());
    expect(slots.body.data.slots.map((slot: any) => slot.id)).toContain(slotId);
    expect(slots.body.data.slots.every((slot: any) => slot.sessionType === 'video')).toBe(true);

    await request(server()).get(`/api/v1/specialists/${new mongoose.Types.ObjectId()}/slots?from=${from}&to=${to}`).expect(404);

    // Clean up the second specialist so later assertions stay single-tenant.
    await getDb(app).collection('clinicians').deleteMany({ displayName: `${CLINICIAN_NAME} Other` });
  });

  it('requires an idempotency key and quotes the server-side price on hold', async () => {
    const slotId = await seedSlot(clinicianId);
    const { user } = await registerAndLogin(app);

    await request(server()).post('/api/v1/bookings/hold').set(authHeader(user.accessToken!)).send({ slotId }).expect(400);

    const hold = await request(server())
      .post('/api/v1/bookings/hold')
      .set(authHeader(user.accessToken!))
      .set(idempotencyHeader('hold'))
      .send({ slotId })
      .expect(201);

    expect(hold.body.data.booking).toMatchObject({
      status: 'held',
      sessionType: 'video',
      amountMinor: 250_000,
      currency: 'NGN',
    });
    expect(hold.body.data.checkoutEnabled).toBe(true);
    expect(hold.body.data.message).toContain('No appointment or payment is confirmed');

    // A second client cannot take the same slot.
    const { user: rival } = await registerAndLogin(app);
    await request(server())
      .post('/api/v1/bookings/hold')
      .set(authHeader(rival.accessToken!))
      .set(idempotencyHeader('hold-rival'))
      .send({ slotId })
      .expect(409);

    // Another account cannot read the booking.
    await request(server()).get(`/api/v1/bookings/${hold.body.data.booking.id}`).set(authHeader(rival.accessToken!)).expect(404);
  });

  it('refuses to hold a session type without an approved price and leaves the slot open', async () => {
    const textOnlySlot = await seedSlot(clinicianId, 'text');
    const { user } = await registerAndLogin(app);

    const refused = await request(server())
      .post('/api/v1/bookings/hold')
      .set(authHeader(user.accessToken!))
      .set(idempotencyHeader('hold-unpriced'))
      .send({ slotId: textOnlySlot })
      .expect(503);
    expect(refused.body.error.message).toContain('No payment was attempted');

    const slot = await getDb(app).collection('availability_slots').findOne({ _id: new mongoose.Types.ObjectId(textOnlySlot) });
    expect(slot!.status).toBe('open');
  });

  it('initializes checkout with a server-calculated amount, then confirms only a verified webhook', async () => {
    const slotId = await seedSlot(clinicianId);
    const { user } = await registerAndLogin(app);

    const hold = await request(server())
      .post('/api/v1/bookings/hold')
      .set(authHeader(user.accessToken!))
      .set(idempotencyHeader('hold-paid'))
      .send({ slotId })
      .expect(201);
    const bookingId = hold.body.data.booking.id;

    // Checkout cannot be read without an idempotency key.
    await request(server()).post(`/api/v1/bookings/${bookingId}/payment-intent`).set(authHeader(user.accessToken!)).expect(400);

    const intent = await request(server())
      .post(`/api/v1/bookings/${bookingId}/payment-intent`)
      .set(authHeader(user.accessToken!))
      .set(idempotencyHeader('intent-paid'))
      .send({})
      .expect(201);

    expect(intent.body.data.payment).toMatchObject({ status: 'initialized', amountMinor: 250_000, currency: 'NGN' });
    expect(intent.body.data.payment.authorizationUrl).toContain('checkout.paystack.local');
    const reference = intent.body.data.payment.reference as string;
    expect(lastInitializeBody).toMatchObject({ amount: 250_000, currency: 'NGN', reference });
    expect(lastInitializeBody.email).toBe(user.email);

    const pending = await request(server()).get(`/api/v1/bookings/${bookingId}`).set(authHeader(user.accessToken!)).expect(200);
    expect(pending.body.data.booking.status).toBe('pending_payment');

    // An unsigned or wrongly-signed webhook must never confirm a booking.
    const payload = JSON.stringify({ event: 'charge.success', data: { id: 4242, reference, amount: 250_000, currency: 'NGN' } });
    await request(server())
      .post('/api/v1/webhooks/paystack')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', 'not-a-valid-signature')
      .send(payload)
      .expect(401);

    const stillPending = await request(server()).get(`/api/v1/bookings/${bookingId}`).set(authHeader(user.accessToken!)).expect(200);
    expect(stillPending.body.data.booking.status).toBe('pending_payment');

    // Provider-verified amount that differs from the quote must not confirm.
    verifiedAmount = 1_000;
    const mismatch = await request(server())
      .post('/api/v1/webhooks/paystack')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', createHmac('sha512', PAYSTACK_SECRET).update(payload).digest('hex'))
      .send(payload)
      .expect(200);
    expect(mismatch.body.data.status).toBe('AMOUNT_MISMATCH');
    const afterMismatch = await request(server()).get(`/api/v1/bookings/${bookingId}`).set(authHeader(user.accessToken!)).expect(200);
    expect(afterMismatch.body.data.booking.status).toBe('pending_payment');
    expect(afterMismatch.body.data.payment.status).toBe('failed');

    // A fresh intent is required; the mismatched payment is not revived.
    verifiedAmount = 250_000;
    const retry = await request(server())
      .post(`/api/v1/bookings/${bookingId}/payment-intent`)
      .set(authHeader(user.accessToken!))
      .set(idempotencyHeader('intent-paid-retry'))
      .send({})
      .expect(201);
    const retryReference = retry.body.data.payment.reference as string;
    expect(retryReference).not.toBe(reference);

    // A valid, matching, server-verified event confirms exactly once.
    const confirmPayload = JSON.stringify({ event: 'charge.success', data: { id: 5555, reference: retryReference, amount: 250_000, currency: 'NGN' } });
    const confirmed = await request(server())
      .post('/api/v1/webhooks/paystack')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', createHmac('sha512', PAYSTACK_SECRET).update(confirmPayload).digest('hex'))
      .send(confirmPayload)
      .expect(200);
    expect(confirmed.body.data.status).toBe('CONFIRMED');

    const after = await request(server()).get(`/api/v1/bookings/${bookingId}`).set(authHeader(user.accessToken!)).expect(200);
    expect(after.body.data.booking.status).toBe('confirmed');
    const slot = await getDb(app).collection('availability_slots').findOne({ _id: new mongoose.Types.ObjectId(slotId) });
    expect(slot!.status).toBe('booked');

    // Replaying the same provider event never confirms twice.
    const replayed = await request(server())
      .post('/api/v1/webhooks/paystack')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', createHmac('sha512', PAYSTACK_SECRET).update(confirmPayload).digest('hex'))
      .send(confirmPayload)
      .expect(200);
    expect(replayed.body.data.duplicate).toBe(true);
  });

  it('confirms a fresh paid booking and exposes a receipt only after verification', async () => {
    verifiedAmount = 250_000;
    const slotId = await seedSlot(clinicianId);
    const { user } = await registerAndLogin(app);

    const hold = await request(server())
      .post('/api/v1/bookings/hold')
      .set(authHeader(user.accessToken!))
      .set(idempotencyHeader('hold-confirm'))
      .send({ slotId })
      .expect(201);
    const bookingId = hold.body.data.booking.id;

    // No receipt before payment.
    await request(server()).get(`/api/v1/receipts/${bookingId}`).set(authHeader(user.accessToken!)).expect(422);

    const intent = await request(server())
      .post(`/api/v1/bookings/${bookingId}/payment-intent`)
      .set(authHeader(user.accessToken!))
      .set(idempotencyHeader('intent-confirm'))
      .send({})
      .expect(201);
    const reference = intent.body.data.payment.reference as string;

    const payload = JSON.stringify({ event: 'charge.success', data: { id: 9001, reference, amount: 250_000, currency: 'NGN' } });
    const confirmed = await request(server())
      .post('/api/v1/webhooks/paystack')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', createHmac('sha512', PAYSTACK_SECRET).update(payload).digest('hex'))
      .send(payload)
      .expect(200);
    expect(confirmed.body.data.status).toBe('CONFIRMED');

    const booking = await request(server()).get(`/api/v1/bookings/${bookingId}`).set(authHeader(user.accessToken!)).expect(200);
    expect(booking.body.data.booking.status).toBe('confirmed');
    expect(booking.body.data.payment.status).toBe('succeeded');

    const slot = await getDb(app).collection('availability_slots').findOne({ _id: new mongoose.Types.ObjectId(slotId) });
    expect(slot!.status).toBe('booked');

    const receipt = await request(server()).get(`/api/v1/receipts/${bookingId}`).set(authHeader(user.accessToken!)).expect(200);
    expect(receipt.body.data).toMatchObject({ amountMinor: 250_000, currency: 'NGN', reference, refundStatus: 'none' });

    const payment = await request(server()).get(`/api/v1/payments/${receipt.body.data.paymentId}`).set(authHeader(user.accessToken!)).expect(200);
    expect(payment.body.data).toMatchObject({ status: 'succeeded', reference });

    // Another account cannot read the payment or receipt.
    const { user: other } = await registerAndLogin(app);
    await request(server()).get(`/api/v1/payments/${receipt.body.data.paymentId}`).set(authHeader(other.accessToken!)).expect(404);
    await request(server()).get(`/api/v1/receipts/${bookingId}`).set(authHeader(other.accessToken!)).expect(404);

    const listed = await request(server()).get('/api/v1/bookings?status=confirmed').set(authHeader(user.accessToken!)).expect(200);
    expect(listed.body.data.bookings.map((entry: any) => entry.id)).toContain(bookingId);
  });

  it('scopes the clinician booking read to the caller’s own profile', async () => {
    const specialist = await seedSpecialist({ video: 120_000 }, { displayName: `${CLINICIAN_NAME} Clinician` });
    const slotId = await seedSlot(specialist.id, 'video');
    const { user: patient } = await registerAndLogin(app);

    const hold = await request(server())
      .post('/api/v1/bookings/hold')
      .set(authHeader(patient.accessToken!))
      .set(idempotencyHeader('hold-clinician-view'))
      .send({ slotId })
      .expect(201);

    const own = await request(server())
      .get('/api/v1/clinician/bookings')
      .set(authHeader(specialist.user.accessToken!))
      .expect(200);
    expect(own.body.data.bookings.map((entry: any) => entry.id)).toContain(hold.body.data.booking.id);

    // A patient account without the clinician role cannot use the clinician view.
    await request(server()).get('/api/v1/clinician/bookings').set(authHeader(patient.accessToken!)).expect(403);

    await getDb(app).collection('clinicians').deleteMany({ displayName: `${CLINICIAN_NAME} Clinician` });
  });

  it('cancels an unpaid booking, releases the slot and states the refund position', async () => {
    const slotId = await seedSlot(clinicianId);
    const { user } = await registerAndLogin(app);

    const hold = await request(server())
      .post('/api/v1/bookings/hold')
      .set(authHeader(user.accessToken!))
      .set(idempotencyHeader('hold-cancel'))
      .send({ slotId })
      .expect(201);
    const bookingId = hold.body.data.booking.id;

    const cancelled = await request(server())
      .post(`/api/v1/bookings/${bookingId}/cancel`)
      .set(authHeader(user.accessToken!))
      .send({ reason: 'Schedule changed' })
      .expect(201);
    expect(cancelled.body.data.booking.status).toBe('cancelled');
    expect(cancelled.body.data.refund).toMatchObject({ status: 'not_required' });

    const slot = await getDb(app).collection('availability_slots').findOne({ _id: new mongoose.Types.ObjectId(slotId) });
    expect(slot!.status).toBe('open');

    // Cancelling twice is refused rather than silently repeated.
    await request(server())
      .post(`/api/v1/bookings/${bookingId}/cancel`)
      .set(authHeader(user.accessToken!))
      .send({})
      .expect(409);

    // The released slot can be held again by someone else.
    const { user: next } = await registerAndLogin(app);
    await request(server())
      .post('/api/v1/bookings/hold')
      .set(authHeader(next.accessToken!))
      .set(idempotencyHeader('hold-after-cancel'))
      .send({ slotId })
      .expect(201);
  });

  it('marks a paid booking refund-pending instead of pretending a refund happened', async () => {
    verifiedAmount = 250_000;
    const slotId = await seedSlot(clinicianId);
    const { user } = await registerAndLogin(app);

    const hold = await request(server())
      .post('/api/v1/bookings/hold')
      .set(authHeader(user.accessToken!))
      .set(idempotencyHeader('hold-refund'))
      .send({ slotId })
      .expect(201);
    const bookingId = hold.body.data.booking.id;

    const intent = await request(server())
      .post(`/api/v1/bookings/${bookingId}/payment-intent`)
      .set(authHeader(user.accessToken!))
      .set(idempotencyHeader('intent-refund'))
      .send({})
      .expect(201);
    const reference = intent.body.data.payment.reference as string;

    const payload = JSON.stringify({ event: 'charge.success', data: { id: 9100, reference, amount: 250_000, currency: 'NGN' } });
    await request(server())
      .post('/api/v1/webhooks/paystack')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', createHmac('sha512', PAYSTACK_SECRET).update(payload).digest('hex'))
      .send(payload)
      .expect(200);

    const cancelled = await request(server())
      .post(`/api/v1/bookings/${bookingId}/cancel`)
      .set(authHeader(user.accessToken!))
      .send({ reason: 'No longer needed' })
      .expect(201);
    expect(cancelled.body.data.booking.refundStatus).toBe('pending_policy');
    expect(cancelled.body.data.refund.message).toContain('no refund has been issued');
  });
});
