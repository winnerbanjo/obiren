import * as request from 'supertest';
import * as crypto from 'crypto';
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import { createTestApp, getDb, registerAndLogin } from './helpers';

describe('Notification delivery truth and webhook security (e2e)', () => {
  let app: INestApplication;
  const oldToken = process.env.TWILIO_AUTH_TOKEN;
  const oldCron = process.env.CRON_SECRET;
  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => {
    if (oldToken === undefined) delete process.env.TWILIO_AUTH_TOKEN; else process.env.TWILIO_AUTH_TOKEN = oldToken;
    if (oldCron === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = oldCron;
    await mongoose.disconnect().catch(() => undefined); await app.close();
  });

  it('rejects unsigned status callbacks and rejects cron credentials with an unauthorized status', async () => {
    delete process.env.TWILIO_AUTH_TOKEN;
    await request(app.getHttpServer()).post('/api/v1/webhooks/twilio/whatsapp/status').type('form').send({ MessageSid: 'SMfake', MessageStatus: 'delivered' }).expect(401);
    delete process.env.CRON_SECRET;
    await request(app.getHttpServer()).get('/api/v1/internal/cron/process-notifications').expect(401);
  });

  it('marks missing external providers failed instead of simulating success', async () => {
    const { user } = await registerAndLogin(app);
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    const key = `provider-offline-${Date.now()}`;
    await getDb(app).collection('notification_outbox').insertOne({ userId: new mongoose.Types.ObjectId(user.userId!), recipient: { phoneNumber: '+2348012345678' }, type: 'HEALTH_REMINDER', category: 'REMINDER', channel: 'whatsapp', templateKey: 'reminder', templateData: { body: 'private payload' }, scheduledFor: new Date(Date.now() - 1000), status: 'pending', idempotencyKey: key });
    process.env.CRON_SECRET = 'test-cron-secret';
    await request(app.getHttpServer()).get('/api/v1/internal/cron/process-notifications').set('X-Cron-Secret', process.env.CRON_SECRET).expect(200);
    const stored = await getDb(app).collection('notification_outbox').findOne({ idempotencyKey: key });
    expect(stored.status).toBe('failed');
    expect(stored.providerMessageId).toBeUndefined();
    expect(stored.providerStatus).toBe('provider_not_configured');
  });

  it('authenticates scheduler calls with a Bearer CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'test-cron-secret';

    // Vercel Cron sends Authorization: Bearer <CRON_SECRET> on a GET.
    await request(app.getHttpServer())
      .get('/api/v1/internal/cron/process-notifications')
      .set('Authorization', `Bearer ${process.env.CRON_SECRET}`)
      .expect(200);

    // Retention is a preview by default, so a scheduled call cannot delete.
    const preview = await request(app.getHttpServer())
      .get('/api/v1/internal/cron/run-retention')
      .set('Authorization', `Bearer ${process.env.CRON_SECRET}`)
      .expect(200);
    expect(preview.body.data.dryRun).toBe(true);
    expect(preview.body.data.executed).toBe(false);

    // A wrong secret is rejected on both transports.
    await request(app.getHttpServer())
      .get('/api/v1/internal/cron/run-retention')
      .set('Authorization', 'Bearer not-the-secret')
      .expect(401);
  });

  it('accepts a correctly signed Twilio status callback', async () => {
    const token = 'twilio-test-auth-secret'; process.env.TWILIO_AUTH_TOKEN = token;
    const body = { MessageSid: 'SM123456789', MessageStatus: 'delivered' };
    const url = 'http://localhost/api/v1/webhooks/twilio/whatsapp/status';
    const canonical = Object.keys(body).sort().reduce((value, key) => value + key + body[key as keyof typeof body], url);
    const signature = crypto.createHmac('sha1', token).update(canonical).digest('base64');
    await request(app.getHttpServer()).post('/api/v1/webhooks/twilio/whatsapp/status').set('Host', 'localhost').set('X-Twilio-Signature', signature).type('form').send(body).expect(201);
  });
});
