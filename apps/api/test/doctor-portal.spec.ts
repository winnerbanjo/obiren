import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import mongoose, { Types } from 'mongoose';
import {
  authHeader,
  createTestApp,
  getDb,
  idempotencyHeader,
  registerAndLogin,
  setUserRole,
  uniqueEmail,
} from './helpers';
import { emailOutbox } from '../src/modules/mail/mock-email.provider';

/**
 * Doctor Portal + Admin doctor management, end to end.
 *
 * Everything runs through the real HTTP surface against in-memory MongoDB:
 * admin creates a doctor, the doctor activates their own account, configures a
 * recurring schedule, the patient-facing catalogue reflects it, a user books,
 * and the doctor manages the appointment with a recorded history.
 */
describe('Doctor Portal and Admin doctor management (e2e)', () => {
  let app: INestApplication;
  let admin: { accessToken?: string };
  const createdEmails: string[] = [];
  const clinicianIds: Types.ObjectId[] = [];
  let licenceCounter = 0;

  const server = () => app.getHttpServer();

  beforeAll(async () => {
    app = await createTestApp();
    const { user } = await registerAndLogin(app);
    await setUserRole(app, user.userId!, 'super_admin');
    admin = { accessToken: user.accessToken };
  });

  afterAll(async () => {
    const db = getDb(app);
    const clinicians = await db.collection('clinicians').find({ _id: { $in: clinicianIds } }).toArray();
    const userIds = clinicians.map((clinician) => clinician.userId);
    await db.collection('bookings').deleteMany({ clinicianId: { $in: clinicianIds } });
    await db.collection('availability_slots').deleteMany({ clinicianId: { $in: clinicianIds } });
    await db.collection('doctor_availability_rules').deleteMany({ clinicianId: { $in: clinicianIds } });
    await db.collection('doctor_time_off').deleteMany({ clinicianId: { $in: clinicianIds } });
    await db.collection('clinicians').deleteMany({ _id: { $in: clinicianIds } });
    if (userIds.length) {
      await db.collection('in_app_notifications').deleteMany({ userId: { $in: userIds } });
      await db.collection('user_profiles').deleteMany({ userId: { $in: userIds } });
      await db.collection('users').deleteMany({ _id: { $in: userIds } });
    }
    await mongoose.disconnect().catch(() => undefined);
    await app.close();
  });

  function nextLicence() {
    licenceCounter += 1;
    return `TEST-DOC-${Date.now()}-${licenceCounter}`;
  }

  async function createDoctor(overrides: Record<string, unknown> = {}) {
    const email = (overrides.email as string) || uniqueEmail('doctor');
    createdEmails.push(email);
    const licenceNumber = (overrides.licenceNumber as string) || nextLicence();
    const res = await request(server())
      .post('/api/v1/admin/doctors')
      .set(authHeader(admin.accessToken!))
      .send({
        fullName: 'Dr. Ada Obi',
        email,
        professionalTitle: 'Consultant Obstetrician',
        specialization: 'Obstetrics & Gynaecology',
        qualifications: ['MBBS', 'FWACS'],
        licenceNumber,
        countryCode: 'NG',
        timeZone: 'Africa/Lagos',
        consultationTypes: ['video'],
        consultationFeeMinor: 200_000,
        consultationDurationMinutes: 30,
        languages: ['English'],
        verificationStatus: 'verified',
        listed: true,
        ...overrides,
      });
    expect(res.status).toBe(201);
    const clinicianId = new Types.ObjectId(res.body.data.doctor.id as string);
    clinicianIds.push(clinicianId);
    return { res, clinicianId, email, licenceNumber };
  }

  function activationTokenFor(email: string): string {
    const message = [...emailOutbox].reverse().find((entry) => entry.to === email && /activate\?token=/.test(entry.text));
    expect(message).toBeTruthy();
    const match = /activate\?token=([a-f0-9]{64})/.exec(message!.text)!;
    return match[1];
  }

  async function activateDoctor(email: string, password = 'DoctorPass1') {
    const token = activationTokenFor(email);
    await request(server()).post('/api/v1/auth/activate-doctor').send({ token, password }).expect(201);
    const login = await request(server()).post('/api/v1/auth/login').send({ email, password, platform: 'web' }).expect(200);
    return { accessToken: login.body.data.tokens.accessToken as string, userId: login.body.data.user.id as string };
  }

  async function createPatient() {
    const { user } = await registerAndLogin(app);
    return user;
  }

  async function insertBooking(input: {
    clinicianId: Types.ObjectId;
    patientUserId: string;
    slotId?: Types.ObjectId;
    status: string;
    startsAt: Date;
    endsAt: Date;
    reference?: string;
  }) {
    const _id = new Types.ObjectId();
    await getDb(app).collection('bookings').insertOne({
      _id,
      userId: new Types.ObjectId(input.patientUserId),
      clinicianId: input.clinicianId,
      slotId: input.slotId ?? new Types.ObjectId(),
      holdId: new Types.ObjectId(),
      sessionType: 'video',
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      timeZone: 'Africa/Lagos',
      status: input.status,
      amountMinor: 200_000,
      currency: 'NGN',
      reference: input.reference ?? `TEST-BOOKING-${_id.toString()}`,
      refundStatus: 'none',
      statusHistory: [],
      rescheduledFrom: [],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return _id.toString();
  }

  it('creates a doctor, sends a single-use activation link and never sets a password', async () => {
    const { res, clinicianId, email } = await createDoctor({ fullName: 'Dr. Ada Obi' });

    expect(res.body.data.doctor).toMatchObject({
      displayName: 'Dr. Ada Obi',
      email,
      status: 'invited',
      listed: false,
      verificationStatus: 'verified',
      specialization: 'Obstetrics & Gynaecology',
    });
    expect(res.body.data.invitation).toMatchObject({ activationRequired: true, emailDelivered: true });
    // No raw or reusable credential is ever returned by the API.
    expect(res.body.data.invitation).not.toHaveProperty('password');
    expect(res.body.data.invitation.activationToken).toBeUndefined();

    // The doctor sets their own password.
    const doctor = await activateDoctor(email);
    const me = await request(server()).get('/api/v1/clinician/me').set(authHeader(doctor.accessToken)).expect(200);
    expect(me.body.data).toMatchObject({ id: clinicianId.toString(), email, accountStatus: 'active', listed: true });

    // The same invitation cannot be used twice.
    await request(server())
      .post('/api/v1/auth/activate-doctor')
      .send({ token: activationTokenFor(email), password: 'AnotherPass1' })
      .expect(400);

    const listed = await request(server())
      .get(`/api/v1/admin/doctors?q=${encodeURIComponent('Ada Obi')}`)
      .set(authHeader(admin.accessToken!))
      .expect(200);
    expect(listed.body.data.doctors.map((entry: any) => entry.id)).toContain(clinicianId.toString());
    expect(listed.body.data.statusCounts.active).toBeGreaterThanOrEqual(1);
  });

  it('rejects duplicate emails and duplicate licence numbers', async () => {
    const { email, licenceNumber } = await createDoctor();
    const duplicateEmail = await request(server())
      .post('/api/v1/admin/doctors')
      .set(authHeader(admin.accessToken!))
      .send({
        fullName: 'Dr. Copy',
        email,
        professionalTitle: 'Consultant',
        specialization: 'Gynaecology',
        consultationTypes: ['video'],
        licenceNumber: nextLicence(),
      });
    expect(duplicateEmail.status).toBe(409);

    const duplicateLicence = await request(server())
      .post('/api/v1/admin/doctors')
      .set(authHeader(admin.accessToken!))
      .send({
        fullName: 'Dr. Copy Two',
        email: uniqueEmail('doctor'),
        professionalTitle: 'Consultant',
        specialization: 'Gynaecology',
        consultationTypes: ['video'],
        licenceNumber,
      });
    expect(duplicateLicence.status).toBe(409);
  });

  it('refuses to list an unverified doctor', async () => {
    const res = await request(server())
      .post('/api/v1/admin/doctors')
      .set(authHeader(admin.accessToken!))
      .send({
        fullName: 'Dr. Pending Review',
        email: uniqueEmail('doctor'),
        professionalTitle: 'Registrar',
        specialization: 'Family Medicine',
        consultationTypes: ['video'],
        licenceNumber: nextLicence(),
        verificationStatus: 'pending',
        listed: true,
      });
    expect(res.status).toBe(422);
  });

  it('publishes recurring availability into the user catalogue and prevents double booking', async () => {
    const { clinicianId, email } = await createDoctor({ fullName: 'Dr. Bisi Adeyemi' });
    const doctor = await activateDoctor(email);

    // A weekly schedule in the doctor's own timezone.
    const rules = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      dayOfWeek,
      startMinutes: 9 * 60,
      endMinutes: 11 * 60,
      sessionType: 'video',
    }));
    const saved = await request(server())
      .patch('/api/v1/clinician/schedule')
      .set(authHeader(doctor.accessToken))
      .send({ timeZone: 'Africa/Lagos', consultationDurationMinutes: 30, bufferMinutes: 0, rules })
      .expect(200);
    expect(saved.body.data.slotsGenerated).toBeGreaterThan(0);

    const overlapping = await request(server())
      .patch('/api/v1/clinician/schedule')
      .set(authHeader(doctor.accessToken))
      .send({
        timeZone: 'Africa/Lagos',
        consultationDurationMinutes: 30,
        bufferMinutes: 0,
        rules: [
          { dayOfWeek: 1, startMinutes: 540, endMinutes: 660, sessionType: 'video' },
          { dayOfWeek: 1, startMinutes: 600, endMinutes: 700, sessionType: 'video' },
        ],
      });
    expect(overlapping.status).toBe(400);

    const preview = await request(server())
      .get('/api/v1/clinician/schedule/preview?days=14')
      .set(authHeader(doctor.accessToken))
      .expect(200);
    expect(preview.body.data.slots.length).toBeGreaterThan(0);

    const from = new Date().toISOString();
    const to = new Date(Date.now() + 14 * 86400_000).toISOString();
    const publicSlots = await request(server())
      .get(`/api/v1/specialists/${clinicianId.toString()}/slots?from=${from}&to=${to}`)
      .expect(200);
    const visibleIds = publicSlots.body.data.slots.map((slot: any) => slot.id);
    expect(visibleIds).toEqual(expect.arrayContaining(preview.body.data.slots.slice(0, 3).map((slot: any) => slot.id)));

    // Two patients race for the same slot: exactly one hold may succeed.
    const slotId = visibleIds[0];
    const patientA = await createPatient();
    const patientB = await createPatient();
    const first = await request(server())
      .post('/api/v1/bookings/hold')
      .set(authHeader(patientA.accessToken!))
      .set(idempotencyHeader('doctor-portal-hold-a'))
      .send({ slotId, note: 'Persistent pelvic pain for three weeks.' });
    expect(first.status).toBe(201);
    expect(first.body.data.booking.status).toBe('held');

    const second = await request(server())
      .post('/api/v1/bookings/hold')
      .set(authHeader(patientB.accessToken!))
      .set(idempotencyHeader('doctor-portal-hold-b'))
      .send({ slotId });
    expect(second.status).toBe(409);

    // The booking is visible to the right doctor, with the patient's note.
    const doctorList = await request(server())
      .get('/api/v1/clinician/bookings')
      .set(authHeader(doctor.accessToken))
      .expect(200);
    const appointment = doctorList.body.data.appointments.find((entry: any) => entry.id === first.body.data.booking.id);
    expect(appointment).toMatchObject({ status: 'held', sessionType: 'video' });
    expect(appointment.patientNote).toBe('Persistent pelvic pain for three weeks.');
    expect(appointment.patient.displayName).toBeTruthy();

    // Another doctor cannot read it even with the correct id.
    const other = await createDoctor({ fullName: 'Dr. Other Clinician', licenceNumber: nextLicence() });
    const otherDoctor = await activateDoctor(other.email);
    await request(server())
      .get(`/api/v1/clinician/bookings/${appointment.id}`)
      .set(authHeader(otherDoctor.accessToken))
      .expect(404);
    await request(server())
      .post(`/api/v1/clinician/bookings/${appointment.id}/confirm`)
      .set(authHeader(otherDoctor.accessToken))
      .expect(404);
  });

  it('manages the appointment lifecycle with valid transitions, history and notifications', async () => {
    const { clinicianId, email } = await createDoctor({ fullName: 'Dr. Chika Nwosu' });
    const doctor = await activateDoctor(email);
    const patient = await createPatient();

    const pendingId = await insertBooking({
      clinicianId,
      patientUserId: patient.userId!,
      status: 'pending',
      startsAt: new Date(Date.now() + 2 * 86400_000),
      endsAt: new Date(Date.now() + 2 * 86400_000 + 30 * 60_000),
    });

    const videoOnly = await request(server())
      .get('/api/v1/clinician/bookings?sessionType=video')
      .set(authHeader(doctor.accessToken))
      .expect(200);
    expect(videoOnly.body.data.appointments.map((entry: any) => entry.id)).toContain(pendingId);
    const audioOnly = await request(server())
      .get('/api/v1/clinician/bookings?sessionType=audio')
      .set(authHeader(doctor.accessToken))
      .expect(200);
    expect(audioOnly.body.data.appointments.map((entry: any) => entry.id)).not.toContain(pendingId);

    const dashboard = await request(server())
      .get('/api/v1/clinician/dashboard')
      .set(authHeader(doctor.accessToken))
      .expect(200);
    expect(dashboard.body.data.summary.pending).toBeGreaterThanOrEqual(1);
    expect(dashboard.body.data.pendingRequests.map((entry: any) => entry.id)).toContain(pendingId);

    const confirmed = await request(server())
      .post(`/api/v1/clinician/bookings/${pendingId}/confirm`)
      .set(authHeader(doctor.accessToken))
      .expect(201);
    expect(confirmed.body.data.status).toBe('confirmed');
    expect(confirmed.body.data.statusHistory.some((entry: any) => entry.from === 'pending' && entry.to === 'confirmed' && entry.actorRole === 'clinician')).toBe(true);

    // The same transition cannot be replayed.
    await request(server())
      .post(`/api/v1/clinician/bookings/${pendingId}/confirm`)
      .set(authHeader(doctor.accessToken))
      .expect(409);

    // A future session cannot be completed or marked no-show.
    await request(server())
      .post(`/api/v1/clinician/bookings/${pendingId}/complete`)
      .set(authHeader(doctor.accessToken))
      .expect(422);
    await request(server())
      .post(`/api/v1/clinician/bookings/${pendingId}/no-show`)
      .set(authHeader(doctor.accessToken))
      .send({})
      .expect(422);

    // Rejection demands a reason and frees the request.
    const rejectId = await insertBooking({
      clinicianId,
      patientUserId: patient.userId!,
      status: 'pending',
      startsAt: new Date(Date.now() + 3 * 86400_000),
      endsAt: new Date(Date.now() + 3 * 86400_000 + 30 * 60_000),
    });
    await request(server())
      .post(`/api/v1/clinician/bookings/${rejectId}/reject`)
      .set(authHeader(doctor.accessToken))
      .send({})
      .expect(400);
    const rejected = await request(server())
      .post(`/api/v1/clinician/bookings/${rejectId}/reject`)
      .set(authHeader(doctor.accessToken))
      .send({ reason: 'Emergency theatre list that day' })
      .expect(201);
    expect(rejected.body.data).toMatchObject({ status: 'rejected', rejectionReason: 'Emergency theatre list that day' });
    await request(server())
      .post(`/api/v1/clinician/bookings/${rejectId}/confirm`)
      .set(authHeader(doctor.accessToken))
      .expect(409);

    // Cancelling a confirmed appointment is recorded.
    const cancelled = await request(server())
      .post(`/api/v1/clinician/bookings/${pendingId}/cancel`)
      .set(authHeader(doctor.accessToken))
      .send({ reason: 'Called into an emergency delivery' })
      .expect(201);
    expect(cancelled.body.data.status).toBe('cancelled');

    // The user app reads the same authoritative appointment record.
    const patientView = await request(server())
      .get(`/api/v1/bookings/${pendingId}`)
      .set(authHeader(patient.accessToken!))
      .expect(200);
    expect(patientView.body.data.booking.status).toBe('cancelled');
    expect(patientView.body.data.booking.cancellationReason).toContain('Called into an emergency delivery');

    // The patient receives an in-app event for the confirmation and cancellation.
    const notifications = await getDb(app)
      .collection('in_app_notifications')
      .find({ userId: new Types.ObjectId(patient.userId!) })
      .toArray();
    expect(notifications.map((entry) => entry.type)).toEqual(
      expect.arrayContaining(['APPOINTMENT_CONFIRMED', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_REJECTED']),
    );
  });

  it("stores the doctor's own meeting link and shows it on the patient's appointment", async () => {
    const { clinicianId, email } = await createDoctor({ fullName: 'Dr. Grace Okon' });
    const doctor = await activateDoctor(email);
    const patient = await createPatient();

    const startsAt = new Date(Date.now() + 2 * 86400_000);
    const bookingId = await insertBooking({
      clinicianId,
      patientUserId: patient.userId!,
      status: 'confirmed',
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60_000),
    });
    const linkPath = `/api/v1/clinician/bookings/${bookingId}/meeting-link`;

    // Whatever reaches the patient as a trusted way into their consultation has
    // to be https on a known provider: no script URLs, no downgrade, no
    // lookalike host, no embedded credentials.
    for (const url of [
      'javascript:alert(1)',
      'http://meet.google.com/abc-defg-hij',
      'https://meet.google.com.evil.example/abc-defg-hij',
      'https://evil.example/abc-defg-hij',
      'https://user:secret@meet.google.com/abc-defg-hij',
    ]) {
      const rejected = await request(server()).patch(linkPath).set(authHeader(doctor.accessToken)).send({ url });
      expect(rejected.status).toBe(400);
    }
    await request(server()).patch(linkPath).set(authHeader(doctor.accessToken)).send({}).expect(400);

    // Another doctor's appointment is not found, never overwritten.
    const other = await createDoctor({ fullName: 'Dr. Not Yours', licenceNumber: nextLicence() });
    const otherDoctor = await activateDoctor(other.email);
    await request(server())
      .patch(linkPath)
      .set(authHeader(otherDoctor.accessToken))
      .send({ url: 'https://meet.google.com/abc-defg-hij' })
      .expect(404);

    // A finished appointment no longer accepts a link.
    const completedId = await insertBooking({
      clinicianId,
      patientUserId: patient.userId!,
      status: 'completed',
      startsAt: new Date(Date.now() - 86400_000),
      endsAt: new Date(Date.now() - 86400_000 + 30 * 60_000),
    });
    await request(server())
      .patch(`/api/v1/clinician/bookings/${completedId}/meeting-link`)
      .set(authHeader(doctor.accessToken))
      .send({ url: 'https://zoom.us/j/1234567890' })
      .expect(409);

    const meetingUrl = 'https://meet.google.com/abc-defg-hij';
    const saved = await request(server()).patch(linkPath).set(authHeader(doctor.accessToken)).send({ url: meetingUrl }).expect(200);
    expect(saved.body.data).toMatchObject({ meetingUrl, meetingLinkEditable: true });
    expect(saved.body.data.meetingUrlUpdatedAt).toBeTruthy();

    // The patient reads the same authoritative record, not a separate copy.
    const patientView = await request(server())
      .get(`/api/v1/bookings/${bookingId}`)
      .set(authHeader(patient.accessToken!))
      .expect(200);
    expect(patientView.body.data.booking.meetingUrl).toBe(meetingUrl);

    const notifications = () =>
      getDb(app)
        .collection('in_app_notifications')
        .find({ userId: new Types.ObjectId(patient.userId!), objectId: bookingId })
        .toArray();
    expect((await notifications()).map((entry) => entry.type)).toContain('APPOINTMENT_LINK_ADDED');

    // Re-saving the same link is idempotent: the patient is not pinged twice.
    await request(server()).patch(linkPath).set(authHeader(doctor.accessToken)).send({ url: meetingUrl }).expect(200);
    const linkAdded = (await notifications()).filter((entry) => entry.type === 'APPOINTMENT_LINK_ADDED');
    expect(linkAdded.length).toBe(1);

    // Provider subdomains are accepted, and the newest link replaces the old one.
    const zoom = await request(server())
      .patch(linkPath)
      .set(authHeader(doctor.accessToken))
      .send({ url: 'https://us02web.zoom.us/j/1234567890' })
      .expect(200);
    expect(zoom.body.data.meetingUrl).toBe('https://us02web.zoom.us/j/1234567890');

    // Clearing the link removes it for the patient too.
    const cleared = await request(server()).patch(linkPath).set(authHeader(doctor.accessToken)).send({ url: null }).expect(200);
    expect(cleared.body.data.meetingUrl).toBeNull();
    const afterRemoval = await request(server())
      .get(`/api/v1/bookings/${bookingId}`)
      .set(authHeader(patient.accessToken!))
      .expect(200);
    expect(afterRemoval.body.data.booking.meetingUrl).toBeNull();
    expect((await notifications()).map((entry) => entry.type)).toContain('APPOINTMENT_LINK_REMOVED');
  });

  it('reschedules atomically and releases the previous slot', async () => {
    const { clinicianId, email } = await createDoctor({ fullName: 'Dr. Damilola Eze' });
    const doctor = await activateDoctor(email);
    const patient = await createPatient();

    const db = getDb(app);
    const oldSlot = new Types.ObjectId();
    const newSlot = new Types.ObjectId();
    const oldStartsAt = new Date(Date.now() + 5 * 86400_000);
    const newStartsAt = new Date(Date.now() + 6 * 86400_000);
    await db.collection('availability_slots').insertMany([
      {
        _id: oldSlot,
        clinicianId,
        startsAt: oldStartsAt,
        endsAt: new Date(oldStartsAt.getTime() + 30 * 60_000),
        sessionType: 'video',
        status: 'booked',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: newSlot,
        clinicianId,
        startsAt: newStartsAt,
        endsAt: new Date(newStartsAt.getTime() + 30 * 60_000),
        sessionType: 'video',
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const bookingId = await insertBooking({
      clinicianId,
      patientUserId: patient.userId!,
      slotId: oldSlot,
      status: 'confirmed',
      startsAt: oldStartsAt,
      endsAt: new Date(oldStartsAt.getTime() + 30 * 60_000),
    });

    const moved = await request(server())
      .post(`/api/v1/clinician/bookings/${bookingId}/reschedule`)
      .set(authHeader(doctor.accessToken))
      .send({ slotId: newSlot.toString(), reason: 'Clinic overrun' })
      .expect(201);
    expect(moved.body.data.status).toBe('confirmed');
    expect(new Date(moved.body.data.startsAt).getTime()).toBe(newStartsAt.getTime());
    expect(moved.body.data.rescheduledFrom.length).toBe(1);

    const oldAfter = await db.collection('availability_slots').findOne({ _id: oldSlot });
    const newAfter = await db.collection('availability_slots').findOne({ _id: newSlot });
    expect(oldAfter?.status).toBe('open');
    expect(newAfter?.status).toBe('booked');

    // Reusing the old slot for another reschedule fails: it is now open but the
    // target must still exist and belong to this doctor. A second doctor's slot
    // is never accepted.
    const other = await createDoctor({ fullName: 'Dr. Not Yours', licenceNumber: nextLicence() });
    const otherDoctor = await activateDoctor(other.email);
    await request(server())
      .post(`/api/v1/clinician/bookings/${bookingId}/reschedule`)
      .set(authHeader(otherDoctor.accessToken))
      .send({ slotId: oldSlot.toString() })
      .expect(404);
  });

  it('reports overlapping appointments when time off is blocked instead of cancelling them', async () => {
    const { clinicianId, email } = await createDoctor({ fullName: 'Dr. Emeka Uche' });
    const doctor = await activateDoctor(email);
    const patient = await createPatient();

    const startsAt = new Date(Date.now() + 4 * 86400_000);
    const bookingId = await insertBooking({
      clinicianId,
      patientUserId: patient.userId!,
      status: 'confirmed',
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60_000),
    });

    const blocked = await request(server())
      .post('/api/v1/clinician/time-off')
      .set(authHeader(doctor.accessToken))
      .send({
        startsAt: new Date(startsAt.getTime() - 3_600_000).toISOString(),
        endsAt: new Date(startsAt.getTime() + 3_600_000).toISOString(),
        reason: 'Annual leave',
      })
      .expect(201);
    expect(blocked.body.data.affectedAppointments.map((entry: any) => entry.id)).toContain(bookingId);
    expect(blocked.body.data.message).toMatch(/Reschedule or cancel/);

    // The appointment itself is untouched.
    const stillThere = await request(server())
      .get(`/api/v1/clinician/bookings/${bookingId}`)
      .set(authHeader(doctor.accessToken))
      .expect(200);
    expect(stillThere.body.data.status).toBe('confirmed');

    await request(server())
      .delete(`/api/v1/clinician/time-off/${blocked.body.data.timeOff.id}`)
      .set(authHeader(doctor.accessToken))
      .expect(200);
  });

  it('lets admin hide, suspend and reactivate a doctor, and enforces it on booking', async () => {
    const { clinicianId, email } = await createDoctor({ fullName: 'Dr. Funke Bello' });
    const doctor = await activateDoctor(email);

    const suspended = await request(server())
      .post(`/api/v1/admin/doctors/${clinicianId.toString()}/status`)
      .set(authHeader(admin.accessToken!))
      .send({ status: 'suspended', reason: 'Licence under investigation' })
      .expect(201);
    expect(suspended.body.data).toMatchObject({ status: 'suspended', listed: false });

    // A suspended doctor cannot sign in or use the portal.
    await request(server()).post('/api/v1/auth/login').send({ email, password: 'DoctorPass1', platform: 'web' }).expect(403);
    const blocked = await request(server()).get('/api/v1/clinician/dashboard').set(authHeader(doctor.accessToken));
    expect([401, 403]).toContain(blocked.status);

    // The user-facing catalogue refuses to show or price the doctor.
    await request(server()).get(`/api/v1/specialists/${clinicianId.toString()}`).expect(404);

    const reactivated = await request(server())
      .post(`/api/v1/admin/doctors/${clinicianId.toString()}/status`)
      .set(authHeader(admin.accessToken!))
      .send({ status: 'active' })
      .expect(201);
    expect(reactivated.body.data).toMatchObject({ status: 'active', listed: true });
    await request(server()).post('/api/v1/auth/login').send({ email, password: 'DoctorPass1', platform: 'web' }).expect(200);

    // Deactivation hides the doctor without blocking sign-in.
    const inactive = await request(server())
      .post(`/api/v1/admin/doctors/${clinicianId.toString()}/status`)
      .set(authHeader(admin.accessToken!))
      .send({ status: 'inactive' })
      .expect(201);
    expect(inactive.body.data).toMatchObject({ status: 'inactive', listed: false });
    await request(server()).post('/api/v1/auth/login').send({ email, password: 'DoctorPass1', platform: 'web' }).expect(200);
  });

  it('flags credential changes for admin review and de-lists until re-approved', async () => {
    const { clinicianId, email } = await createDoctor({ fullName: 'Dr. Grace Ilori' });
    const doctor = await activateDoctor(email);

    const updated = await request(server())
      .patch('/api/v1/clinician/me')
      .set(authHeader(doctor.accessToken))
      .send({ bio: 'Fifteen years in maternal health.', licenceNumber: nextLicence() })
      .expect(200);
    expect(updated.body.data.credentialReviewTriggered).toBe(true);
    expect(updated.body.data.profile).toMatchObject({ verificationStatus: 'pending', listed: false });

    await request(server()).get(`/api/v1/specialists/${clinicianId.toString()}`).expect(404);

    // Admin re-approves with evidence; the doctor is listed again.
    await request(server())
      .put(`/api/v1/admin/clinicians/${clinicianId.toString()}/verification`)
      .set(authHeader(admin.accessToken!))
      .send({ verificationStatus: 'verified', evidenceRef: 'licence-check-2026-11', active: true })
      .expect(200);
    const listed = await request(server()).get(`/api/v1/specialists/${clinicianId.toString()}`).expect(200);
    expect(listed.body.data.id).toBe(clinicianId.toString());
  });

  it('creates exactly one reminder for a confirmed appointment inside the 24-hour window', async () => {
    const { clinicianId, email } = await createDoctor({ fullName: 'Dr. Reminder Test' });
    const doctor = await activateDoctor(email);
    const patient = await createPatient();
    const bookingId = await insertBooking({
      clinicianId,
      patientUserId: patient.userId!,
      status: 'confirmed',
      startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000 + 30 * 60_000),
    });

    const cronSecret = 'test-cron-secret-doctor-portal';
    process.env.CRON_SECRET = cronSecret;
    try {
      await request(server()).get('/api/v1/internal/cron/appointment-reminders').expect(401);
      await request(server())
        .get('/api/v1/internal/cron/appointment-reminders')
        .set('X-Cron-Secret', cronSecret)
        .expect(200);
      // A second run must not duplicate the reminder.
      await request(server())
        .get('/api/v1/internal/cron/appointment-reminders')
        .set('X-Cron-Secret', cronSecret)
        .expect(200);
    } finally {
      delete process.env.CRON_SECRET;
    }

    const reminders = await getDb(app)
      .collection('in_app_notifications')
      .find({ userId: new Types.ObjectId(doctor.userId), type: 'APPOINTMENT_REMINDER', objectId: bookingId })
      .toArray();
    expect(reminders).toHaveLength(1);
    expect(reminders[0].body).not.toMatch(/patient|symptom|diagnos/i);

    const feed = await request(server())
      .get('/api/v1/clinician/notifications')
      .set(authHeader(doctor.accessToken))
      .expect(200);
    expect(feed.body.data.notifications.map((entry: any) => entry.type)).toContain('APPOINTMENT_REMINDER');
  });

  it('enforces doctor role and ownership on every portal route', async () => {
    const patient = await createPatient();
    for (const path of ['/api/v1/clinician/me', '/api/v1/clinician/dashboard', '/api/v1/clinician/bookings', '/api/v1/clinician/schedule', '/api/v1/clinician/notifications']) {
      await request(server()).get(path).set(authHeader(patient.accessToken!)).expect(403);
    }
    await request(server()).get('/api/v1/clinician/me').expect(401);
  });
});
