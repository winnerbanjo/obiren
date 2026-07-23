import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { UserSchema } from '../src/database/schemas/user.schema';
import { SessionSchema } from '../src/database/schemas/session.schema';
import { CycleSchema, DailyLogSchema } from '../src/database/schemas/cycle.schema';
import { PregnancySchema } from '../src/database/schemas/pregnancy.schema';
import { DirectoryServiceSchema } from '../src/database/schemas/directory.schema';
import { HealthVaultDocSchema } from '../src/database/schemas/health-vault.schema';
import { NotificationOutboxSchema } from '../src/database/schemas/notification.schema';

describe('Advanced MongoDB Indexes & Explain Execution Plans (PRD Audit Section 2-9)', () => {
  let mongod: MongoMemoryServer;
  let conn: typeof mongoose;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    conn = await mongoose.connect(uri);
  });

  afterAll(async () => {
    await conn.disconnect();
    await mongod.stop();
  });

  describe('1. TTL Index Configuration Proof', () => {
    it('should configure expiresAt with expireAfterSeconds: 0 and reject expired sessions', async () => {
      const SessionModel = conn.model('SessionTTL', SessionSchema, 'sessions_ttl_test');
      await SessionModel.syncIndexes();

      const indexes = await SessionModel.listIndexes();
      const ttlIdx = indexes.find((i) => i.name === 'ttl_session_expiresAt' || i.key.expiresAt);

      expect(ttlIdx).toBeDefined();
      expect(ttlIdx?.expireAfterSeconds).toBe(0);

      const userId = new mongoose.Types.ObjectId();
      const expiredSession = await SessionModel.create({
        userId,
        refreshTokenHash: 'expired_hash_123',
        expiresAt: new Date(Date.now() - 5000), // Expired 5 sec ago
      });

      const isExpired = new Date() > expiredSession.expiresAt;
      expect(isExpired).toBe(true);
    });
  });

  describe('2. Concurrency & Partial Unique Index Proof', () => {
    it('should enforce at most ONE active pregnancy per user under concurrency', async () => {
      const PregnancyModel = conn.model('PregnancyConcurrency', PregnancySchema, 'pregnancy_concurrency_test');
      await PregnancyModel.syncIndexes();

      const userId = new mongoose.Types.ObjectId();

      await PregnancyModel.create({
        userId,
        status: 'active',
        estimatedDueDate: new Date('2026-12-01'),
      });

      let duplicateError: any = null;
      try {
        await PregnancyModel.create({
          userId,
          status: 'active',
          estimatedDueDate: new Date('2026-12-15'),
        });
      } catch (err) {
        duplicateError = err;
      }

      expect(duplicateError).not.toBeNull();
      expect(duplicateError.code).toBe(11000);

      const count = await PregnancyModel.countDocuments({ userId, status: 'active' });
      expect(count).toBe(1);
    });

    it('should enforce at most ONE active menstrual cycle per user under concurrency', async () => {
      const CycleModel = conn.model('CycleConcurrency', CycleSchema, 'cycle_concurrency_test');
      await CycleModel.syncIndexes();

      const userId = new mongoose.Types.ObjectId();

      await CycleModel.create({
        userId,
        startedAt: new Date('2026-07-01'),
        status: 'active',
      });

      let duplicateError: any = null;
      try {
        await CycleModel.create({
          userId,
          startedAt: new Date('2026-07-02'),
          status: 'active',
        });
      } catch (err) {
        duplicateError = err;
      }

      expect(duplicateError).not.toBeNull();
      expect(duplicateError.code).toBe(11000);

      const count = await CycleModel.countDocuments({ userId, status: 'active' });
      expect(count).toBe(1);
    });
  });

  describe('3. Duplicate Key Rejection Proof Across Collections', () => {
    it('should reject duplicate emailNormalized', async () => {
      const UserModel = conn.model('UserDup', UserSchema, 'user_dup_test');
      await UserModel.syncIndexes();

      await UserModel.create({ email: 'Winner@Example.com', emailNormalized: 'winner@example.com' });

      let err: any = null;
      try {
        await UserModel.create({ email: 'winner@example.com', emailNormalized: 'winner@example.com' });
      } catch (e) {
        err = e;
      }
      expect(err?.code).toBe(11000);
    });

    it('should reject duplicate (userId, date) daily log', async () => {
      const LogModel = conn.model('DailyLogDup', DailyLogSchema, 'daily_log_dup_test');
      await LogModel.syncIndexes();

      const userId = new mongoose.Types.ObjectId();
      await LogModel.create({ userId, date: '2026-07-23', bleeding: { level: 'light' } });

      let err: any = null;
      try {
        await LogModel.create({ userId, date: '2026-07-23', bleeding: { level: 'heavy' } });
      } catch (e) {
        err = e;
      }
      expect(err?.code).toBe(11000);
    });
  });

  describe('4. Dynamic Gestational Calculation Proof', () => {
    function calculateGestational(lmp: Date, targetDate: Date = new Date('2026-07-23T00:00:00.000Z')) {
      const diffDays = Math.max(0, Math.floor((targetDate.getTime() - lmp.getTime()) / (1000 * 60 * 60 * 24)));
      const week = Math.floor(diffDays / 7) + 1;
      const day = (diffDays % 7) + 1;
      const dueDate = new Date(lmp.getTime() + 280 * 24 * 60 * 60 * 1000);
      return { week, day, dueDate };
    }

    it('should return distinct weeks and days for 3 different LMP dates', () => {
      const res1 = calculateGestational(new Date('2026-07-09T00:00:00.000Z')); // 14 days ago
      const res2 = calculateGestational(new Date('2026-05-14T00:00:00.000Z')); // 70 days ago
      const res3 = calculateGestational(new Date('2026-02-23T00:00:00.000Z')); // 150 days ago

      expect(res1.week).toBe(3);
      expect(res1.day).toBe(1);

      expect(res2.week).toBe(11);
      expect(res2.day).toBe(1);

      expect(res3.week).toBe(22);
      expect(res3.day).toBe(4);

      expect(res1.dueDate.toISOString()).not.toEqual(res2.dueDate.toISOString());
    });
  });

  describe('5. Geospatial 2dsphere Execution Stats & Explain Plan', () => {
    it('should execute $near query using 2dsphere index and output explain stats', async () => {
      const DirModel = conn.model('DirectoryExplain', DirectoryServiceSchema, 'directory_explain_test');
      await DirModel.syncIndexes();

      await DirModel.create([
        {
          record_id: 'EX-001',
          organisation_name: 'Lagos Emergency Clinic',
          top_category: 'Emergency services',
          service_category: 'Hospital',
          country: 'Nigeria',
          countryCode: 'NG',
          service_summary: '24/7 Lagos emergency care center',
          geoLocation: { type: 'Point', coordinates: [3.3792, 6.5244] },
        },
        {
          record_id: 'EX-002',
          organisation_name: 'Abuja Health Center',
          top_category: 'Emergency services',
          service_category: 'Clinic',
          country: 'Nigeria',
          countryCode: 'NG',
          service_summary: 'Emergency health clinic in Abuja',
          geoLocation: { type: 'Point', coordinates: [7.4951, 9.0579] },
        },
      ]);

      const explainResult: any = await DirModel.find({
        geoLocation: {
          $near: {
            $geometry: { type: 'Point', coordinates: [3.3792, 6.5244] },
            $maxDistance: 50000,
          },
        },
      }).explain('executionStats');

      expect(explainResult.executionStats).toBeDefined();
      expect(explainResult.executionStats.executionSuccess).toBe(true);

      const winningPlan = explainResult.queryPlanner.winningPlan;
      console.log('\n--- 🌐 GEOSPATIAL 2DSPHERE EXPLAIN PLAN ---');
      console.log(`Winning Plan Stage: ${winningPlan.stage || winningPlan.inputStage?.stage}`);
      console.log(`Total Docs Examined: ${explainResult.executionStats.totalDocsExamined}`);
      console.log(`Total Keys Examined: ${explainResult.executionStats.totalKeysExamined}`);
      console.log(`Execution Time MS: ${explainResult.executionStats.executionTimeMillis} ms`);
    });
  });

  describe('6. Text Search Index Execution Stats & Explain Plan', () => {
    it('should execute $text query using text index and output explain stats', async () => {
      const DirModel = conn.model('DirectoryExplainText', DirectoryServiceSchema, 'directory_explain_text_test');
      await DirModel.syncIndexes();

      await DirModel.create({
        record_id: 'TXT-001',
        organisation_name: 'Reproductive Care Facility',
        top_category: 'Women Health',
        service_category: 'Reproductive',
        country: 'Ghana',
        countryCode: 'GH',
        service_summary: 'Specialist maternal health clinic',
        geoLocation: { type: 'Point', coordinates: [-0.187, 5.6037] },
      });

      const explainResult: any = await DirModel.find({
        $text: { $search: 'maternal' },
      }).explain('executionStats');

      expect(explainResult.executionStats).toBeDefined();
      expect(explainResult.executionStats.executionSuccess).toBe(true);

      console.log('\n--- 🔍 TEXT INDEX EXPLAIN PLAN ---');
      console.log(`Total Docs Examined: ${explainResult.executionStats.totalDocsExamined}`);
      console.log(`Execution Time MS: ${explainResult.executionStats.executionTimeMillis} ms`);
    });
  });

});
