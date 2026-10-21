import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import { createTestApp, registerAndLogin, authHeader, getDb, setUserRole } from './helpers';

/**
 * Published emergency resources are public reference data. The tests pin the
 * honest parts of the contract: an unreviewed record is never presented as
 * operationally confirmed, review writes are role-gated and audited, and an
 * operational confirmation cannot be recorded without evidence.
 */
describe('Emergency resources (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    await getDb(app).collection('emergency_resource_reviews').deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect().catch(() => undefined);
    await app.close();
  });

  it('serves country resources publicly without a token', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/safety/resources');

    expect(res.status).toBe(200);
    const payload = res.body.data;
    expect(payload.countryCode).toBe('NG');
    expect(payload.emergencyNumbers.medical).toBe('112');
    expect(payload.dispatchSupported).toBe(false);
    expect(payload.disclaimer).toContain('does not dispatch emergency services');
    expect(payload.resources.length).toBeGreaterThan(0);
    expect(payload.resources.every((resource: any) => resource.countryCode === 'NG')).toBe(true);
    // Emergency services are listed first for a person in crisis.
    expect(payload.resources[0].category).toBe('Emergency services');
    // No recorded staff review exists yet, so nothing claims confirmation.
    expect(
      payload.resources.every(
        (resource: any) =>
          resource.verification.freshness === 'unreviewed' &&
          resource.verification.operationallyConfirmed === false &&
          resource.verification.lastCheckedAt === null,
      ),
    ).toBe(true);
    // Internal editorial notes are never exposed on the public route.
    expect(payload.resources[0].editorialFollowUp).toBeUndefined();
    expect(res.body.meta.total).toBeGreaterThanOrEqual(res.body.meta.returned);
  });

  it('filters by country, category and free text', async () => {
    const server = app.getHttpServer();

    const ghana = await request(server).get('/api/v1/safety/resources?countryCode=GH');
    expect(ghana.status).toBe(200);
    expect(ghana.body.data.resources.every((resource: any) => resource.countryCode === 'GH')).toBe(true);

    const category = await request(server).get(
      '/api/v1/safety/resources?countryCode=NG&category=domestic',
    );
    expect(category.status).toBe(200);
    expect(category.body.data.resources.length).toBeGreaterThan(0);
    expect(
      category.body.data.resources.every((resource: any) =>
        `${resource.category} ${resource.serviceCategory}`.toLowerCase().includes('domestic'),
      ),
    ).toBe(true);

    const text = await request(server).get('/api/v1/safety/resources?countryCode=NG&q=warif');
    expect(text.status).toBe(200);
    expect(text.body.data.resources).toHaveLength(1);
    expect(text.body.data.resources[0].recordId).toBe('NG-007');

    const limited = await request(server).get('/api/v1/safety/resources?countryCode=NG&limit=2');
    expect(limited.status).toBe(200);
    expect(limited.body.data.resources).toHaveLength(2);
    expect(limited.body.meta.returned).toBe(2);
  });

  it('rejects unsupported countries, oversized pages and unknown query keys', async () => {
    const server = app.getHttpServer();

    const badCountry = await request(server).get('/api/v1/safety/resources?countryCode=KE');
    expect(badCountry.status).toBe(400);

    const tooMany = await request(server).get('/api/v1/safety/resources?limit=500');
    expect(tooMany.status).toBe(400);

    const unknownKey = await request(server).get('/api/v1/safety/resources?includePrivate=1');
    expect(unknownKey.status).toBe(400);
  });

  it('requires an administrative role to review or list reviews', async () => {
    const { user } = await registerAndLogin(app);
    const server = app.getHttpServer();

    const listAttempt = await request(server)
      .get('/api/v1/admin/safety/resources')
      .set(authHeader(user.accessToken!));
    expect(listAttempt.status).toBe(403);

    const reviewAttempt = await request(server)
      .put('/api/v1/admin/safety/resources/NG-001/review')
      .set(authHeader(user.accessToken!))
      .send({ verificationStatus: 'source_verified' });
    expect(reviewAttempt.status).toBe(403);

    const anonymous = await request(server)
      .put('/api/v1/admin/safety/resources/NG-001/review')
      .send({ verificationStatus: 'source_verified' });
    expect(anonymous.status).toBe(401);
  });

  it('records an audited review and reflects it on the public route', async () => {
    const { user } = await registerAndLogin(app);
    await setUserRole(app, user.userId!, 'platform_admin');
    const server = app.getHttpServer();

    const reviewed = await request(server)
      .put('/api/v1/admin/safety/resources/NG-001/review')
      .set(authHeader(user.accessToken!))
      .send({
        verificationStatus: 'operationally_confirmed',
        evidenceRef: 'call-log-2026-10-21-001',
        note: 'Called the hotline; 112 answered.',
      });
    expect(reviewed.status).toBe(200);
    expect(reviewed.body.data.verificationStatus).toBe('operationally_confirmed');
    expect(reviewed.body.data.operationallyConfirmed).toBe(true);
    expect(reviewed.body.data.freshness).toBe('current');

    const stored = await getDb(app).collection('emergency_resource_reviews').findOne({ recordId: 'NG-001' });
    expect(stored).toBeTruthy();
    expect(stored!.verificationStatus).toBe('operationally_confirmed');
    expect(stored!.evidenceRef).toBe('call-log-2026-10-21-001');
    expect(stored!.checkedByUserId.toString()).toBe(user.userId);
    expect(new Date(stored!.nextReviewDueAt).getTime()).toBeGreaterThan(Date.now());

    const audit = await getDb(app).collection('audit_logs').findOne({
      action: 'REVIEW_EMERGENCY_RESOURCE',
      targetResourceId: 'NG-001',
    });
    expect(audit).toBeTruthy();

    const publicRead = await request(server).get('/api/v1/safety/resources?countryCode=NG&q=112');
    const hotline = publicRead.body.data.resources.find((resource: any) => resource.recordId === 'NG-001');
    expect(hotline.verification.status).toBe('operationally_confirmed');
    expect(hotline.verification.operationallyConfirmed).toBe(true);
    expect(hotline.verification.lastCheckedAt).toBeTruthy();
    expect(hotline.verification.freshness).toBe('current');
    expect(publicRead.body.meta.reviewCounts.current).toBeGreaterThan(0);

    // Re-reviewing the same record updates one row rather than duplicating it.
    const updated = await request(server)
      .put('/api/v1/admin/safety/resources/NG-001/review')
      .set(authHeader(user.accessToken!))
      .send({ verificationStatus: 'source_verified', nextReviewDueAt: new Date(Date.now() - 60_000).toISOString() });
    expect(updated.status).toBe(400);

    const downgraded = await request(server)
      .put('/api/v1/admin/safety/resources/NG-001/review')
      .set(authHeader(user.accessToken!))
      .send({ verificationStatus: 'source_verified' });
    expect(downgraded.status).toBe(200);
    expect(downgraded.body.data.operationallyConfirmed).toBe(false);
    expect(await getDb(app).collection('emergency_resource_reviews').countDocuments({ recordId: 'NG-001' })).toBe(1);

    const adminList = await request(server)
      .get('/api/v1/admin/safety/resources?countryCode=NG')
      .set(authHeader(user.accessToken!));
    expect(adminList.status).toBe(200);
    const adminRecord = adminList.body.data.resources.find((resource: any) => resource.recordId === 'NG-001');
    expect(adminRecord.verificationStatus).toBe('source_verified');
    expect(adminRecord.freshness).toBe('current');
    expect(adminList.body.meta.freshnessCounts.current).toBeGreaterThan(0);

    const overdueFilter = await request(server)
      .get('/api/v1/admin/safety/resources?freshness=overdue')
      .set(authHeader(user.accessToken!));
    expect(overdueFilter.status).toBe(200);
    expect(overdueFilter.body.data.resources).toHaveLength(0);
  });

  it('refuses operational confirmation without evidence and unknown records', async () => {
    const { user } = await registerAndLogin(app);
    await setUserRole(app, user.userId!, 'emergency_manager');
    const server = app.getHttpServer();

    const noEvidence = await request(server)
      .put('/api/v1/admin/safety/resources/NG-002/review')
      .set(authHeader(user.accessToken!))
      .send({ verificationStatus: 'operationally_confirmed' });
    expect(noEvidence.status).toBe(400);

    const unknownRecord = await request(server)
      .put('/api/v1/admin/safety/resources/NG-999/review')
      .set(authHeader(user.accessToken!))
      .send({ verificationStatus: 'source_verified' });
    expect(unknownRecord.status).toBe(404);

    const badParam = await request(server)
      .put('/api/v1/admin/safety/resources/not-a-record/review')
      .set(authHeader(user.accessToken!))
      .send({ verificationStatus: 'source_verified' });
    expect(badParam.status).toBe(400);

    const unknownField = await request(server)
      .put('/api/v1/admin/safety/resources/NG-002/review')
      .set(authHeader(user.accessToken!))
      .send({ verificationStatus: 'source_verified', verifiedBy: 'someone' });
    expect(unknownField.status).toBe(400);
  });
});
