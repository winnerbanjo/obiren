import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import { createTestApp, registerAndLogin, authHeader, getDb } from './helpers';

describe('Safety PIN & SOS (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await mongoose.disconnect().catch(() => undefined);
    await app.close();
  });

  it('creates a PIN, triggers SOS, cancels only with the correct PIN', async () => {
    const { user } = await registerAndLogin(app);
    const server = app.getHttpServer();

    // PIN is stored only as an argon2 hash.
    const setPin = await request(server)
      .post('/api/v1/safety/pin')
      .set(authHeader(user.accessToken!))
      .send({ pin: '4821' });
    expect(setPin.status).toBe(201);

    const pinDoc = await getDb(app).collection('safety_pins').findOne({
      userId: new mongoose.Types.ObjectId(user.userId!),
    });
    expect(pinDoc).toBeTruthy();
    expect(pinDoc!.pinHash).not.toBe('4821');
    expect(pinDoc!.pinHash.startsWith('$argon2')).toBe(true);

    const status = await request(server)
      .get('/api/v1/safety/pin/status')
      .set(authHeader(user.accessToken!));
    expect(status.body.data.hasSafetyPin).toBe(true);

    // Trigger (idempotent within the hour).
    const trigger = await request(server)
      .post('/api/v1/safety/sos/trigger')
      .set(authHeader(user.accessToken!))
      .send({ isTestMode: false });
    expect(trigger.status).toBe(201);
    expect(trigger.body.data.incident.status).toBe('active');

    // Wrong PIN rejected; SOS stays active.
    const wrong = await request(server)
      .post('/api/v1/safety/sos/cancel')
      .set(authHeader(user.accessToken!))
      .send({ pin: '9999' });
    expect(wrong.status).toBe(401);

    const stillActive = await request(server)
      .get('/api/v1/safety/incidents')
      .set(authHeader(user.accessToken!));
    expect(stillActive.body.data[0].status).toBe('active');

    // Correct PIN cancels.
    const cancel = await request(server)
      .post('/api/v1/safety/sos/cancel')
      .set(authHeader(user.accessToken!))
      .send({ pin: '4821' });
    expect(cancel.status).toBe(201);
    expect(cancel.body.data.status).toBe('cancelled');
  });

  it('cancelling without any PIN configured fails cleanly', async () => {
    const { user } = await registerAndLogin(app);
    const server = app.getHttpServer();

    await request(server)
      .post('/api/v1/safety/sos/trigger')
      .set(authHeader(user.accessToken!))
      .send({ isTestMode: true });

    const cancel = await request(server)
      .post('/api/v1/safety/sos/cancel')
      .set(authHeader(user.accessToken!))
      .send({ pin: '1234' });
    expect(cancel.status).toBe(400);
  });

  it('rate-limits repeated wrong PIN attempts (lockout)', async () => {
    const { user } = await registerAndLogin(app);
    const server = app.getHttpServer();

    await request(server).post('/api/v1/safety/pin').set(authHeader(user.accessToken!)).send({ pin: '7777' });
    await request(server)
      .post('/api/v1/safety/sos/trigger')
      .set(authHeader(user.accessToken!))
      .send({ isTestMode: true });

    for (let i = 0; i < 5; i++) {
      await request(server)
        .post('/api/v1/safety/sos/cancel')
        .set(authHeader(user.accessToken!))
        .send({ pin: '0000' });
    }

    // 6th attempt - even the CORRECT pin - is locked out.
    const locked = await request(server)
      .post('/api/v1/safety/sos/cancel')
      .set(authHeader(user.accessToken!))
      .send({ pin: '7777' });
    expect(locked.status).toBe(429);
  });

  it('rejects malformed PIN payloads', async () => {
    const { user } = await registerAndLogin(app);

    const res = await request(app.getHttpServer())
      .post('/api/v1/safety/pin')
      .set(authHeader(user.accessToken!))
      .send({ pin: 'abc' });
    expect(res.status).toBe(400);
  });
});

describe('Health Vault (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await mongoose.disconnect().catch(() => undefined);
    await app.close();
  });

  it('saves and lists documents for the owner only', async () => {
    const { user: owner } = await registerAndLogin(app, { firstName: 'Owner' });
    const { user: other } = await registerAndLogin(app, { firstName: 'Other' });
    const server = app.getHttpServer();

    const save = await request(server)
      .post('/api/v1/health-vault/documents')
      .set(authHeader(owner.accessToken!))
      .send({
        title: 'Pelvic Ultrasound',
        documentType: 'ultrasound',
        cloudinaryPublicId: `test-doc-${Date.now()}`,
        accessLevel: 'private',
      });
    expect(save.status).toBe(201);
    const docId = save.body.data._id || save.body.data.id;

    const ownerList = await request(server)
      .get('/api/v1/health-vault/documents')
      .set(authHeader(owner.accessToken!));
    expect(ownerList.body.data).toHaveLength(1);

    // Owner gets a signed URL when storage is configured; without Cloudinary
    // credentials (test env) the endpoint degrades honestly with 503. Either
    // way, a non-owner must NEVER receive a URL.
    const download = await request(server)
      .get(`/api/v1/health-vault/documents/${docId}`)
      .set(authHeader(owner.accessToken!));
    expect([200, 503]).toContain(download.status);
    if (download.status === 200) {
      expect(download.body.data.signedDownloadUrl).toContain('cloudinary.com');
      expect(download.body.data.expiresInSeconds).toBe(300);
    }

    // Another user is DENIED (IDOR check).
    const denied = await request(server)
      .get(`/api/v1/health-vault/documents/${docId}`)
      .set(authHeader(other.accessToken!));
    expect(denied.status).toBe(403);

    // Denied access is audit-logged.
    const logs = await getDb(app)
      .collection('health_vault_access_logs')
      .find({ documentId: new mongoose.Types.ObjectId(docId), action: 'DOWNLOAD_DENIED_NOT_OWNER' })
      .toArray();
    expect(logs.length).toBeGreaterThan(0);
  });

  it('owner can delete their own document; others cannot', async () => {
    const { user: owner } = await registerAndLogin(app);
    const { user: other } = await registerAndLogin(app);
    const server = app.getHttpServer();

    const save = await request(server)
      .post('/api/v1/health-vault/documents')
      .set(authHeader(owner.accessToken!))
      .send({ title: 'Lab Panel', cloudinaryPublicId: `del-${Date.now()}` });
    const docId = save.body.data._id || save.body.data.id;

    const denied = await request(server)
      .delete(`/api/v1/health-vault/documents/${docId}`)
      .set(authHeader(other.accessToken!));
    expect(denied.status).toBe(403);

    const del = await request(server)
      .delete(`/api/v1/health-vault/documents/${docId}`)
      .set(authHeader(owner.accessToken!));
    expect(del.status).toBe(200);

    const after = await request(server)
      .get('/api/v1/health-vault/documents')
      .set(authHeader(owner.accessToken!));
    expect(after.body.data).toHaveLength(0);
  });

  it('upload intent fails cleanly (503) when Cloudinary is not configured', async () => {
    const { user } = await registerAndLogin(app);
    // Test env has no Cloudinary credentials.
    const res = await request(app.getHttpServer())
      .post('/api/v1/health-vault/upload-intent')
      .set(authHeader(user.accessToken!))
      .send({});
    expect(res.status).toBe(503);
  });
});

describe('Waitlist (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await mongoose.disconnect().catch(() => undefined);
    await app.close();
  });

  it('accepts a valid signup and persists it durably', async () => {
    const email = `waitlist-${Date.now()}@example.com`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/waitlist')
      .send({ email, firstName: 'Amara', source: 'web-test' });

    expect(res.status).toBe(201);
    expect(res.body.data.alreadyJoined).toBe(false);

    const persisted = await getDb(app)
      .collection('waitlist_entries')
      .findOne({ normalizedEmail: email });
    expect(persisted).toBeTruthy();
    expect(persisted!.firstName).toBe('Amara');
    expect(persisted!.status).toBe('pending');
  });

  it('rejects invalid emails', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/waitlist')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('handles duplicate signups gracefully without enumeration', async () => {
    const email = `dup-${Date.now()}@example.com`;
    const server = app.getHttpServer();

    const first = await request(server).post('/api/v1/waitlist').send({ email });
    expect(first.status).toBe(201);
    expect(first.body.data.alreadyJoined).toBe(false);

    const second = await request(server).post('/api/v1/waitlist').send({ email });
    expect(second.status).toBe(201);
    expect(second.body.data.alreadyJoined).toBe(true);
  });

  it('exposes only aggregate stats publicly', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/waitlist');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data).not.toHaveProperty('entries');
  });
});
