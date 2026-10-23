import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import { authHeader, createTestApp, getDb, registerAndLogin } from './helpers';
import { backfillDailyLogNotes } from '../src/database/migrations/backfill-daily-log-notes';

describe('Daily-log private note encryption (e2e)', () => {
  let app: INestApplication;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await mongoose.disconnect().catch(() => undefined);
    await app.close();
  });

  it('never stores plaintext, decrypts for the owner, and clears ciphertext on delete', async () => {
    const { user } = await registerAndLogin(app);
    const headers = authHeader(user.accessToken!);
    const note = 'confidential note about my body';

    const saved = await request(server())
      .put('/api/v1/daily-logs/2026-10-05')
      .set(headers)
      .send({ symptoms: ['fatigue'], notes: note })
      .expect(200);
    expect(saved.body.data.notes).toBe(note);
    expect(saved.body.data).not.toHaveProperty('notesEncrypted');

    const raw = await getDb(app).collection('daily_logs').findOne({ userId: new mongoose.Types.ObjectId(user.userId!), date: '2026-10-05' });
    expect(raw).toBeTruthy();
    expect(raw).not.toHaveProperty('notes');
    expect(typeof raw!.notesEncrypted).toBe('string');
    expect(JSON.stringify(raw)).not.toContain(note);

    const fetched = await request(server()).get('/api/v1/daily-logs/2026-10-05').set(headers).expect(200);
    expect(fetched.body.data.notes).toBe(note);

    const calendar = await request(server()).get('/api/v1/daily-logs?from=2026-10-01&to=2026-10-07').set(headers).expect(200);
    expect(JSON.stringify(calendar.body)).not.toContain(note);
    expect(JSON.stringify(calendar.body)).not.toContain('notesEncrypted');

    const exported = await request(server()).get('/api/v1/users/me/export').set(headers).expect(200);
    expect(exported.body.data.exportVersion).toBe('1.3');
    const exportedLog = (exported.body.data.dailyLogs as Array<{ date: string; notes?: string }>).find((entry) => entry.date === '2026-10-05');
    expect(exportedLog.notes).toBe(note);
    expect(JSON.stringify(exported.body)).not.toContain('notesEncrypted');

    await request(server())
      .patch('/api/v1/daily-logs/2026-10-05')
      .set(headers)
      .send({ version: saved.body.data.version, notes: null })
      .expect(200);

    const cleared = await getDb(app).collection('daily_logs').findOne({ userId: new mongoose.Types.ObjectId(user.userId!), date: '2026-10-05' });
    expect(cleared).not.toHaveProperty('notesEncrypted');
    expect(cleared).not.toHaveProperty('notes');
  });

  it('backfills legacy plaintext notes idempotently and supports dry run', async () => {
    const { user } = await registerAndLogin(app);
    const db = getDb(app);
    const legacyNote = 'legacy plaintext entry';
    await db.collection('daily_logs').insertOne({
      userId: new mongoose.Types.ObjectId(user.userId!),
      date: '2020-01-01',
      notes: legacyNote,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const dryRun = await backfillDailyLogNotes(db, { dryRun: true });
    expect(dryRun.dryRun).toBe(true);
    expect(dryRun.encrypted).toBeGreaterThanOrEqual(1);
    const untouched = await db.collection('daily_logs').findOne({ userId: new mongoose.Types.ObjectId(user.userId!), date: '2020-01-01' });
    expect(untouched!.notes).toBe(legacyNote);

    const applied = await backfillDailyLogNotes(db, { dryRun: false });
    expect(applied.encrypted).toBeGreaterThanOrEqual(1);
    const migrated = await db.collection('daily_logs').findOne({ userId: new mongoose.Types.ObjectId(user.userId!), date: '2020-01-01' });
    expect(migrated).not.toHaveProperty('notes');
    expect(typeof migrated!.notesEncrypted).toBe('string');
    expect(JSON.stringify(migrated)).not.toContain(legacyNote);

    const rerun = await backfillDailyLogNotes(db, { dryRun: false });
    expect(rerun.scanned).toBe(0);
    expect(rerun.encrypted).toBe(0);
  });
});
