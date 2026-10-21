import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import mongoose, { Types } from 'mongoose';
import {
  createTestApp,
  registerAndLogin,
  authHeader,
  getDb,
  setUserRole,
} from './helpers';
import { totpCodeForCounter } from '../src/common/auth/totp';

const currentTotp = (secret: string) => totpCodeForCounter(secret, Math.floor(Date.now() / 1000 / 30));

async function createClinician(app: INestApplication) {
  const { user } = await registerAndLogin(app);
  await setUserRole(app, user.userId!, 'clinician');
  const clinicianId = new Types.ObjectId();
  await getDb(app).collection('clinicians').insertOne({
    _id: clinicianId,
    userId: new Types.ObjectId(user.userId!),
    displayName: 'Dr. Probe',
    specialties: ['gynaecology'],
    languages: ['en'],
    countryCode: 'NG',
    feeBySessionType: { video: 500000 },
    verificationStatus: 'verified',
    verificationEvidenceRef: 'test-evidence',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { user, clinicianId };
}

describe('Expanded API surface (e2e)', () => {
  let app: INestApplication;
  let server: any;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    // Other suites assert the verified-clinician catalogue is empty, and this
    // suite shares one in-memory database, so remove the fixtures it created.
    await getDb(app).collection('clinicians').deleteMany({ displayName: 'Dr. Probe' }).catch(() => undefined);
    await mongoose.disconnect().catch(() => undefined);
    await app.close();
  });

  describe('support', () => {
    it('serves public FAQ copy with its review state', async () => {
      const res = await request(server).get('/api/v1/support/faqs');
      expect(res.status).toBe(200);
      expect(res.body.data.version).toMatch(/^support-faq-/);
      expect(res.body.data.reviewStatus).toBe('provisional_pending_product_review');
      expect(res.body.data.faqs.length).toBeGreaterThan(0);
      expect(res.body.data.faqs.every((faq: any) => faq.reviewStatus === 'provisional')).toBe(true);

      const filtered = await request(server).get('/api/v1/support/faqs?category=safety');
      expect(filtered.status).toBe(200);
      expect(filtered.body.data.faqs.every((faq: any) => faq.category === 'safety')).toBe(true);

      const badCategory = await request(server).get('/api/v1/support/faqs?category=nope');
      expect(badCategory.status).toBe(400);
    });

    it('keeps tickets owner-scoped and lets staff respond', async () => {
      const { user } = await registerAndLogin(app);
      const other = await registerAndLogin(app);

      const created = await request(server)
        .post('/api/v1/support/tickets')
        .set(authHeader(user.accessToken!))
        .send({ subject: 'Cannot update my profile', category: 'account', message: 'Saving my display name fails every time.' });
      expect(created.status).toBe(201);
      expect(created.body.data.reference).toMatch(/^SUP-[0-9A-F]{6}$/);
      expect(created.body.data.status).toBe('open');
      const ticketId = created.body.data.id;

      const forbidden = await request(server)
        .get(`/api/v1/support/tickets/${ticketId}`)
        .set(authHeader(other.user.accessToken!));
      expect(forbidden.status).toBe(404);

      const reply = await request(server)
        .patch(`/api/v1/support/tickets/${ticketId}`)
        .set(authHeader(user.accessToken!))
        .send({ body: 'It still fails after reinstalling.' });
      expect(reply.status).toBe(200);
      expect(reply.body.data.replies).toHaveLength(1);
      expect(reply.body.data.replies[0].authorRole).toBe('user');

      const agent = await registerAndLogin(app);
      await setUserRole(app, agent.user.userId!, 'support_agent');
      const queue = await request(server)
        .get('/api/v1/admin/support/tickets?status=open')
        .set(authHeader(agent.user.accessToken!));
      expect(queue.status).toBe(200);
      expect(queue.body.data.tickets.some((ticket: any) => ticket.id === ticketId)).toBe(true);

      const resolved = await request(server)
        .put(`/api/v1/admin/support/tickets/${ticketId}`)
        .set(authHeader(agent.user.accessToken!))
        .send({ status: 'resolved', reply: 'Fixed in the latest build.' });
      expect(resolved.status).toBe(200);
      expect(resolved.body.data.status).toBe('resolved');
      expect(resolved.body.data.replies.some((entry: any) => entry.authorRole === 'support')).toBe(true);
      expect(resolved.body.data.resolvedAt).toBeTruthy();

      const nonStaff = await request(server)
        .get('/api/v1/admin/support/tickets')
        .set(authHeader(user.accessToken!));
      expect(nonStaff.status).toBe(403);
    });
  });

  describe('articles', () => {
    it('only publishes medically approved content and resets review on edit', async () => {
      const author = await registerAndLogin(app);
      await setUserRole(app, author.user.userId!, 'content_manager');

      const created = await request(server)
        .post('/api/v1/admin/articles')
        .set(authHeader(author.user.accessToken!))
        .send({
          slug: `cycle-basics-${Date.now()}`,
          title: 'Understanding your cycle',
          summary: 'A short, reviewed overview of a typical menstrual cycle.',
          body: 'This is medically reviewed education copy long enough to satisfy the minimum body length requirement for articles.',
          category: 'cycle',
          tags: ['basics'],
        });
      expect(created.status).toBe(201);
      expect(created.body.data.status).toBe('draft');
      expect(created.body.data.medicalReviewStatus).toBe('pending');
      const articleId = created.body.data.id;
      const slug = created.body.data.slug;

      const hidden = await request(server).get(`/api/v1/articles/${slug}`);
      expect(hidden.status).toBe(404);

      const existing = await getDb(app).collection('articles').findOne({ _id: new Types.ObjectId(articleId) });
      expect(existing!.publishedAt ?? null).toBeNull();

      const prematurePublish = await request(server)
        .post(`/api/v1/admin/articles/${articleId}/publish`)
        .set(authHeader(author.user.accessToken!));
      expect(prematurePublish.status).toBe(422);

      const reviewer = await registerAndLogin(app);
      await setUserRole(app, reviewer.user.userId!, 'medical_reviewer');

      const noEvidence = await request(server)
        .put(`/api/v1/admin/articles/${articleId}/review`)
        .set(authHeader(reviewer.user.accessToken!))
        .send({ medicalReviewStatus: 'approved' });
      expect(noEvidence.status).toBe(400);

      const approved = await request(server)
        .put(`/api/v1/admin/articles/${articleId}/review`)
        .set(authHeader(reviewer.user.accessToken!))
        .send({ medicalReviewStatus: 'approved', reviewEvidenceRef: 'clinical-review-2026-10' });
      expect(approved.status).toBe(200);
      expect(approved.body.data.medicalReviewStatus).toBe('approved');

      const published = await request(server)
        .post(`/api/v1/admin/articles/${articleId}/publish`)
        .set(authHeader(author.user.accessToken!));
      expect(published.status).toBe(201);

      const publicRead = await request(server).get(`/api/v1/articles/${slug}`);
      expect(publicRead.status).toBe(200);
      expect(publicRead.body.data.body).toBeTruthy();
      expect(publicRead.body.data.disclaimer).toContain('does not replace');

      // Editing content invalidates the approval and removes it from the public list.
      const edited = await request(server)
        .put(`/api/v1/admin/articles/${articleId}`)
        .set(authHeader(author.user.accessToken!))
        .send({ summary: 'Updated summary that still needs a fresh clinical review.' });
      expect(edited.status).toBe(200);
      expect(edited.body.data.status).toBe('draft');
      expect(edited.body.data.medicalReviewStatus).toBe('pending');

      const unlisted = await request(server).get(`/api/v1/articles/${slug}`);
      expect(unlisted.status).toBe(404);
    });
  });

  describe('privacy settings', () => {
    it('reports undecided purposes and appends consent events on update', async () => {
      const { user } = await registerAndLogin(app);

      const initial = await request(server)
        .get('/api/v1/privacy-settings')
        .set(authHeader(user.accessToken!));
      expect(initial.status).toBe(200);
      const marketing = initial.body.data.purposes.find((entry: any) => entry.purpose === 'marketing');
      expect(marketing.granted).toBeNull();
      expect(marketing.decided).toBe(false);
      expect(initial.body.data.preferences.shareAnalytics).toBe(false);

      const updated = await request(server)
        .patch('/api/v1/privacy-settings')
        .set(authHeader(user.accessToken!))
        .send({
          purposes: [{ purpose: 'marketing', granted: true, policyVersion: 'privacy-1.0' }],
          shareAnalytics: true,
        });
      expect(updated.status).toBe(200);
      expect(updated.body.data.changedPurposes).toEqual(['marketing']);

      const refreshed = await request(server)
        .get('/api/v1/privacy-settings')
        .set(authHeader(user.accessToken!));
      const refreshedMarketing = refreshed.body.data.purposes.find((entry: any) => entry.purpose === 'marketing');
      expect(refreshedMarketing.granted).toBe(true);
      expect(refreshedMarketing.policyVersion).toBe('privacy-1.0');
      expect(refreshed.body.data.preferences.shareAnalytics).toBe(true);

      const events = await getDb(app)
        .collection('consent_events')
        .find({ userId: new mongoose.Types.ObjectId(user.userId!), purpose: 'marketing' })
        .toArray();
      expect(events).toHaveLength(1);
      expect(events[0].source).toBe('settings');

      const empty = await request(server)
        .patch('/api/v1/privacy-settings')
        .set(authHeader(user.accessToken!))
        .send({});
      expect(empty.status).toBe(400);
    });
  });

  describe('promotions and entitlements', () => {
    it('quotes a promo without applying it and never invents a plan', async () => {
      const admin = await registerAndLogin(app);
      await setUserRole(app, admin.user.userId!, 'super_admin');
      const { clinicianId } = await createClinician(app);

      const code = `PROMO${Date.now().toString().slice(-6)}`;
      const created = await request(server)
        .post('/api/v1/admin/promo-codes')
        .set(authHeader(admin.user.accessToken!))
        .send({ code, percentOff: 25, policyVersion: 'pricing-1.0' });
      expect(created.status).toBe(201);
      expect(created.body.data.code).toBe(code);

      const { user } = await registerAndLogin(app);
      const quoted = await request(server)
        .post('/api/v1/promo-codes/validate')
        .set(authHeader(user.accessToken!))
        .send({ code: code.toLowerCase(), clinicianId: clinicianId.toString(), sessionType: 'video' });
      expect(quoted.status).toBe(201);
      expect(quoted.body.data.originalAmountMinor).toBe(500000);
      expect(quoted.body.data.discountMinor).toBe(125000);
      expect(quoted.body.data.payableAmountMinor).toBe(375000);
      expect(quoted.body.data.applied).toBe(false);
      expect(quoted.body.data.reason).toBe('promotion_policy_pending');

      const unknown = await request(server)
        .post('/api/v1/promo-codes/validate')
        .set(authHeader(user.accessToken!))
        .send({ code: 'NOPE123', clinicianId: clinicianId.toString(), sessionType: 'video' });
      expect(unknown.status).toBe(404);

      const unpriced = await request(server)
        .post('/api/v1/promo-codes/validate')
        .set(authHeader(user.accessToken!))
        .send({ code, clinicianId: clinicianId.toString(), sessionType: 'audio' });
      expect(unpriced.status).toBe(503);

      const subscription = await request(server)
        .get('/api/v1/subscriptions/me')
        .set(authHeader(user.accessToken!));
      expect(subscription.status).toBe(200);
      expect(subscription.body.data.subscription.plan).toBeNull();
      expect(subscription.body.data.subscription.catalog).toBe('pending_product_approval');
      expect(subscription.body.data.policyPending).toBe(true);
      expect(Array.isArray(subscription.body.data.entitlements)).toBe(true);
    });
  });

  describe('health briefs', () => {
    it('generates a deterministic, note-free brief and honours revocation', async () => {
      const { user: owner } = await registerAndLogin(app);
      const { user: clinicianUser, clinicianId } = await createClinician(app);

      const withoutConsent = await request(server)
        .post('/api/v1/briefs/generate')
        .set(authHeader(owner.accessToken!))
        .send({
          recipientUserId: clinicianUser.userId,
          scopes: ['cycles'],
          from: '2026-01-01',
          to: '2026-12-31',
          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        });
      expect(withoutConsent.status).toBe(404);

      await request(server)
        .post('/api/v1/consents')
        .set(authHeader(owner.accessToken!))
        .send({ purpose: 'health_sharing', policyVersion: 'privacy-1.0', granted: true, source: 'settings' })
        .expect(201);

      // A daily log with a free-text note: the note must not reach the brief.
      await getDb(app).collection('daily_logs').insertOne({
        userId: new mongoose.Types.ObjectId(owner.userId!),
        date: '2026-05-02',
        bleeding: { level: 'light' },
        notes: 'private note that must not be shared',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const payload = {
        recipientUserId: clinicianUser.userId,
        scopes: ['daily_logs'],
        from: '2026-01-01',
        to: '2026-12-31',
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      };
      const first = await request(server)
        .post('/api/v1/briefs/generate')
        .set(authHeader(owner.accessToken!))
        .send(payload);
      expect(first.status).toBe(201);
      expect(first.body.data.recordCounts.dailyLogs).toBe(1);
      expect(first.body.data.notesIncluded).toBe(false);

      const second = await request(server)
        .post('/api/v1/briefs/generate')
        .set(authHeader(owner.accessToken!))
        .send(payload);
      expect(second.body.data.contentHash).toBe(first.body.data.contentHash);

      const asRecipient = await request(server)
        .get(`/api/v1/briefs/${first.body.data.id}`)
        .set(authHeader(clinicianUser.accessToken!));
      expect(asRecipient.status).toBe(200);
      expect(asRecipient.body.data.viewerRole).toBe('recipient');
      expect(JSON.stringify(asRecipient.body.data.snapshot)).not.toContain('private note');

      const sharedList = await request(server)
        .get('/api/v1/specialists/me/shared-briefs')
        .set(authHeader(clinicianUser.accessToken!));
      expect(sharedList.status).toBe(200);
      expect(sharedList.body.data.briefs.some((brief: any) => brief.id === first.body.data.id)).toBe(true);

      const revoke = await request(server)
        .delete(`/api/v1/briefs/${first.body.data.id}`)
        .set(authHeader(owner.accessToken!));
      expect(revoke.status).toBe(200);

      const afterRevoke = await request(server)
        .get(`/api/v1/briefs/${first.body.data.id}`)
        .set(authHeader(clinicianUser.accessToken!));
      expect(afterRevoke.status).toBe(404);

      // The seeded clinician id is only used to prove the profile existed.
      expect(clinicianId).toBeTruthy();
    });
  });

  describe('safety maintenance', () => {
    it('reissues invitations, updates scopes and exposes one SOS event', async () => {
      const { user } = await registerAndLogin(app);
      const created = await request(server)
        .post('/api/v1/safety/guardians')
        .set(authHeader(user.accessToken!))
        .send({ name: 'Ada', phoneE164: '+2348012345678', scopes: ['sos_alert'] })
        .set('Idempotency-Key', `guardian-${Date.now()}`);
      expect(created.status).toBe(201);
      const guardianId = created.body.data.contact._id;

      const resent = await request(server)
        .post(`/api/v1/safety/guardians/${guardianId}/resend`)
        .set(authHeader(user.accessToken!));
      expect(resent.status).toBe(201);
      expect(resent.body.data.invitationDelivery).toBe('disabled_pending_approved_channel');
      expect(resent.body.data.inviteId).toBeTruthy();

      const tooSoon = await request(server)
        .post(`/api/v1/safety/guardians/${guardianId}/resend`)
        .set(authHeader(user.accessToken!));
      expect(tooSoon.status).toBe(429);

      const scopes = await request(server)
        .patch(`/api/v1/safety/guardians/${guardianId}/scopes`)
        .set(authHeader(user.accessToken!))
        .send({ scopes: ['sos_alert', 'check_in'] });
      expect(scopes.status).toBe(200);
      expect(scopes.body.data.scopes).toEqual(['sos_alert', 'check_in']);

      const sos = await request(server)
        .post('/api/v1/safety/sos/trigger')
        .set(authHeader(user.accessToken!))
        .set('Idempotency-Key', `sos-expand-${Date.now()}`)
        .send({ isTestMode: true });
      expect(sos.status).toBe(201);
      const incidentId = sos.body.data.incident._id;

      const event = await request(server)
        .get(`/api/v1/safety/sos-events/${incidentId}`)
        .set(authHeader(user.accessToken!));
      expect(event.status).toBe(200);
      expect(event.body.data.id).toBe(incidentId);
      expect(event.body.data.dispatchStatus).toBe('simulated');
      expect(event.body.data.deliveryConfirmed).toBe(false);
    });
  });

  describe('clinician bookings and attachments', () => {
    it('completes only a started confirmed session', async () => {
      const { user: clinicianUser, clinicianId } = await createClinician(app);
      const { user: patient } = await registerAndLogin(app);
      const bookingId = new Types.ObjectId();
      await getDb(app).collection('bookings').insertOne({
        _id: bookingId,
        userId: new Types.ObjectId(patient.userId!),
        clinicianId,
        slotId: new Types.ObjectId(),
        holdId: new Types.ObjectId(),
        sessionType: 'video',
        startsAt: new Date(Date.now() - 3600_000),
        endsAt: new Date(Date.now() - 1800_000),
        timeZone: 'Africa/Lagos',
        status: 'confirmed',
        amountMinor: 500000,
        currency: 'NGN',
        refundStatus: 'none',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const completed = await request(server)
        .post(`/api/v1/clinician/bookings/${bookingId.toString()}/complete`)
        .set(authHeader(clinicianUser.accessToken!));
      expect(completed.status).toBe(201);
      expect(completed.body.data.booking.status).toBe('completed');
      expect(completed.body.data.paymentChanged).toBe(false);

      const again = await request(server)
        .post(`/api/v1/clinician/bookings/${bookingId.toString()}/complete`)
        .set(authHeader(clinicianUser.accessToken!));
      expect(again.status).toBe(409);

      const futureId = new Types.ObjectId();
      await getDb(app).collection('bookings').insertOne({
        _id: futureId,
        userId: new Types.ObjectId(patient.userId!),
        clinicianId,
        slotId: new Types.ObjectId(),
        holdId: new Types.ObjectId(),
        sessionType: 'video',
        startsAt: new Date(Date.now() + 86400_000),
        endsAt: new Date(Date.now() + 90000_000),
        timeZone: 'Africa/Lagos',
        status: 'confirmed',
        amountMinor: 500000,
        currency: 'NGN',
        refundStatus: 'none',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const tooEarly = await request(server)
        .post(`/api/v1/clinician/bookings/${futureId.toString()}/complete`)
        .set(authHeader(clinicianUser.accessToken!));
      expect(tooEarly.status).toBe(422);
    });

    it('registers attachment metadata and refuses downloads until scanning exists', async () => {
      const { user: patient } = await registerAndLogin(app);
      const { user: clinicianUser } = await createClinician(app);
      const consultationId = new Types.ObjectId();
      await getDb(app).collection('consultations').insertOne({
        _id: consultationId,
        patientUserId: new Types.ObjectId(patient.userId!),
        clinicianUserId: new Types.ObjectId(clinicianUser.userId!),
        participantUserIds: [new Types.ObjectId(patient.userId!), new Types.ObjectId(clinicianUser.userId!)],
        status: 'open',
        lastMessageAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const created = await request(server)
        .post(`/api/v1/consultations/${consultationId.toString()}/attachments`)
        .set(authHeader(patient.accessToken!))
        .send({
          fileName: 'scan.pdf',
          contentType: 'application/pdf',
          sizeBytes: 120000,
          storagePublicId: 'obiren/test/scan',
        });
      expect(created.status).toBe(201);
      expect(created.body.data.scanStatus).toBe('not_configured');
      expect(created.body.data.downloadAvailable).toBe(false);
      const attachmentId = created.body.data.id;

      const listed = await request(server)
        .get(`/api/v1/consultations/${consultationId.toString()}/attachments`)
        .set(authHeader(clinicianUser.accessToken!));
      expect(listed.status).toBe(200);
      expect(listed.body.data.attachments).toHaveLength(1);
      expect(listed.body.data.attachments[0].storagePublicId).toBeUndefined();

      const download = await request(server)
        .get(`/api/v1/attachments/${attachmentId}/download`)
        .set(authHeader(clinicianUser.accessToken!));
      expect(download.status).toBe(503);

      const outsider = await registerAndLogin(app);
      const denied = await request(server)
        .get(`/api/v1/consultations/${consultationId.toString()}/attachments`)
        .set(authHeader(outsider.user.accessToken!));
      expect(denied.status).toBe(404);
    });
  });

  describe('multi-factor authentication', () => {
    it('requires a second factor once enrolled', async () => {
      const { user } = await registerAndLogin(app);

      const enrolled = await request(server)
        .post('/api/v1/auth/mfa/enroll')
        .set(authHeader(user.accessToken!))
        .send();
      expect(enrolled.status).toBe(201);
      const secret = enrolled.body.data.secret;
      expect(secret).toBeTruthy();
      expect(enrolled.body.data.recoveryCodes).toHaveLength(8);
      expect(enrolled.body.data.otpauthUrl).toContain('otpauth://totp/');

      const stored = await getDb(app).collection('mfa_credentials').findOne({
        userId: new mongoose.Types.ObjectId(user.userId!),
      });
      expect(stored!.secretCiphertext).not.toContain(secret);
      expect(stored!.status).toBe('pending');

      const wrong = await request(server)
        .post('/api/v1/auth/mfa/verify')
        .set(authHeader(user.accessToken!))
        .send({ code: '000000' });
      expect(wrong.status).toBe(401);

      const verified = await request(server)
        .post('/api/v1/auth/mfa/verify')
        .set(authHeader(user.accessToken!))
        .send({ code: currentTotp(secret) });
      expect(verified.status).toBe(201);
      expect(verified.body.data.enabled).toBe(true);

      const login = await request(server)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password, platform: 'web' });
      expect(login.status).toBe(200);
      expect(login.body.data.mfaRequired).toBe(true);
      expect(login.body.data.tokens).toBeUndefined();

      const challenge = await request(server)
        .post('/api/v1/auth/mfa/challenge')
        .send({ mfaToken: login.body.data.mfaToken, code: currentTotp(secret), platform: 'web' });
      expect(challenge.status).toBe(200);
      expect(challenge.body.data.tokens.accessToken).toBeTruthy();

      const badChallenge = await request(server)
        .post('/api/v1/auth/mfa/challenge')
        .send({ mfaToken: login.body.data.mfaToken, code: '111111', platform: 'web' });
      expect(badChallenge.status).toBe(401);

      const status = await request(server)
        .get('/api/v1/auth/mfa/status')
        .set(authHeader(user.accessToken!));
      expect(status.body.data.enabled).toBe(true);
      expect(status.body.data.recoveryCodesRemaining).toBe(8);

      const disabled = await request(server)
        .post('/api/v1/auth/mfa/disable')
        .set(authHeader(user.accessToken!))
        .send({ code: currentTotp(secret) });
      expect(disabled.status).toBe(201);

      const plainLogin = await request(server)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password, platform: 'web' });
      expect(plainLogin.body.data.tokens.accessToken).toBeTruthy();
    });
  });

  describe('retention job', () => {
    let previousSecret: string | undefined;

    beforeAll(() => {
      previousSecret = process.env.CRON_SECRET;
      process.env.CRON_SECRET = 'test-retention-secret';
    });

    afterAll(() => {
      if (previousSecret === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = previousSecret;
    });

    it('reports a dry run by default and refuses callers without the secret', async () => {
      const unauthenticated = await request(server).post('/api/v1/internal/cron/run-retention');
      expect(unauthenticated.status).toBe(401);

      // An expired refresh session is exactly what the job may remove.
      await getDb(app).collection('sessions').insertOne({
        userId: new Types.ObjectId(),
        refreshTokenHash: `expired-${Date.now()}`,
        platform: 'web',
        expiresAt: new Date(Date.now() - 3600_000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(server)
        .post('/api/v1/internal/cron/run-retention')
        .set('X-Cron-Secret', 'test-retention-secret');
      expect(res.status).toBe(201);
      expect(res.body.data.dryRun).toBe(true);
      expect(res.body.data.executed).toBe(false);
      expect(Array.isArray(res.body.data.results)).toBe(true);
      const session = res.body.data.results.find((row: any) => row.collection === 'sessions');
      expect(session.matched).toBeGreaterThan(0);
      expect(session.deleted).toBe(0);
    });

    it('deletes expired operational records only when execution is enabled', async () => {
      const previous = process.env.RETENTION_EXECUTION_ENABLED;
      process.env.RETENTION_EXECUTION_ENABLED = 'true';
      try {
        await getDb(app).collection('location_sessions').insertOne({
          ownerUserId: new Types.ObjectId(),
          startedAt: new Date(Date.now() - 7200_000),
          expiresAt: new Date(Date.now() - 3600_000),
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        const res = await request(server)
          .post('/api/v1/internal/cron/run-retention')
          .set('X-Cron-Secret', 'test-retention-secret');
        expect(res.status).toBe(201);
        expect(res.body.data.executed).toBe(true);
        const sessions = res.body.data.results.find((row: any) => row.collection === 'location_sessions');
        expect(sessions.deleted).toBeGreaterThan(0);
      } finally {
        if (previous === undefined) delete process.env.RETENTION_EXECUTION_ENABLED;
        else process.env.RETENTION_EXECUTION_ENABLED = previous;
      }
    });
  });
});
