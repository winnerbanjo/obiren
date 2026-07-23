import mongoose from 'mongoose';
import * as crypto from 'crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';

export async function runVersionedMigrations(dbUri?: string): Promise<{ success: boolean; applied: string[] }> {
  let mongod: MongoMemoryServer | null = null;
  let uri = dbUri || process.env.MONGODB_URI;

  if (!uri) {
    mongod = await MongoMemoryServer.create();
    uri = mongod.getUri();
  }

  const envName = uri.includes('staging') ? 'obiren_staging' : uri.includes('127.0.0.1') || uri.includes('localhost') ? 'obiren_development' : 'production';
  
  console.log(`🛡 Running Versioned Migration Framework on Database [${envName}]...`);

  let conn: typeof mongoose;
  if (mongoose.connection.readyState === 1) {
    conn = mongoose;
  } else {
    conn = await mongoose.connect(uri);
  }

  const db = conn.connection.db;
  if (!db) {
    throw new Error('Database connection unavailable');
  }

  const migrationsCollection = db.collection('database_migrations');
  const locksCollection = db.collection('migration_locks');

  const now = new Date();
  const lockExpiry = new Date(now.getTime() + 5 * 60 * 1000);
  const lockId = 'global_migration_lock';
  const workerId = `worker_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const acquiredLock = await locksCollection.findOneAndUpdate(
    {
      _id: lockId as any,
      $or: [{ lockedUntil: { $exists: false } }, { lockedUntil: { $lt: now } }],
    },
    {
      $set: {
        lockedUntil: lockExpiry,
        workerId,
        acquiredAt: now,
      },
    },
    { upsert: true, returnDocument: 'after' },
  );

  if (!acquiredLock) {
    console.log('⚠️ Migration lock held by another process/instance. Skipping concurrent migration.');
    return { success: true, applied: [] };
  }

  const appliedMigrations: string[] = [];

  try {
    const mig001Id = '001_core_platform_indexes';
    const mig001Name = 'Create core indexes for Users, Sessions, Cycles, DailyLogs, Pregnancies, Notifications, Directory, Vault, Safety, AuditLogs';
    const mig001Checksum = crypto.createHash('sha256').update(mig001Id + mig001Name).digest('hex');

    const existing = await migrationsCollection.findOne({ migrationId: mig001Id, status: 'COMPLETED' });

    if (!existing) {
      console.log(`Executing Migration [${mig001Id}]: ${mig001Name}...`);
      const startTime = new Date();

      await migrationsCollection.updateOne(
        { migrationId: mig001Id },
        {
          $set: {
            name: mig001Name,
            checksum: mig001Checksum,
            startedAt: startTime,
            status: 'PENDING',
            appVersion: '1.0.0',
          },
        },
        { upsert: true },
      );

      // 1. Users Indexes
      const usersColl = db.collection('users');
      await usersColl.createIndex({ emailNormalized: 1 }, { unique: true, name: 'uniq_emailNormalized' });
      await usersColl.createIndex({ status: 1, createdAt: -1 }, { name: 'idx_user_status_created' });

      // 2. User Profiles
      const profilesColl = db.collection('user_profiles');
      await profilesColl.createIndex({ userId: 1 }, { unique: true, name: 'uniq_user_profile_userId' });

      // 3. Sessions (TTL Index)
      const sessionsColl = db.collection('sessions');
      await sessionsColl.createIndex({ refreshTokenHash: 1 }, { unique: true, name: 'uniq_refreshTokenHash' });
      await sessionsColl.createIndex({ userId: 1, revokedAt: 1 }, { name: 'idx_session_userId_revoked' });
      await sessionsColl.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_session_expiresAt' });

      // 4. Daily Logs (Compound Unique)
      const logsColl = db.collection('daily_logs');
      await logsColl.createIndex({ userId: 1, date: 1 }, { unique: true, name: 'uniq_user_daily_log_date' });

      // 5. Cycles (Partial Unique Active Cycle)
      const cyclesColl = db.collection('cycles');
      await cyclesColl.createIndex(
        { userId: 1 },
        { unique: true, partialFilterExpression: { status: 'active' }, name: 'unique_active_cycle_per_user' },
      );
      await cyclesColl.createIndex({ userId: 1, startedAt: -1 }, { name: 'idx_cycle_userId_started' });

      // 6. Pregnancies (Partial Unique Active Pregnancy)
      const pregnancyColl = db.collection('pregnancies');
      await pregnancyColl.createIndex(
        { userId: 1 },
        { unique: true, partialFilterExpression: { status: 'active' }, name: 'unique_active_pregnancy_per_user' },
      );
      await pregnancyColl.createIndex({ userId: 1, status: 1 }, { name: 'idx_pregnancy_userId_status' });

      // 7. Notification Outbox
      const notifColl = db.collection('notification_outbox');
      await notifColl.createIndex({ idempotencyKey: 1 }, { unique: true, name: 'uniq_notif_idempotency' });
      await notifColl.createIndex({ status: 1, scheduledFor: 1, lockedUntil: 1 }, { name: 'idx_outbox_claim_worker' });
      await notifColl.createIndex({ userId: 1, createdAt: -1 }, { name: 'idx_notif_userId_created' });

      // 8. Directory Services (2dsphere + Text)
      const directoryColl = db.collection('directory_services');
      await directoryColl.createIndex({ record_id: 1 }, { unique: true, name: 'uniq_directory_record_id' });
      await directoryColl.createIndex({ geoLocation: '2dsphere' }, { name: 'geo_2dsphere_location' });
      await directoryColl.createIndex(
        { organisation_name: 'text', service_summary: 'text' },
        { name: 'text_search_org_summary' },
      );
      await directoryColl.createIndex({ countryCode: 1, city: 1 }, { name: 'idx_dir_country_city' });
      await directoryColl.createIndex({ top_category: 1, verification_status: 1 }, { name: 'idx_dir_cat_status' });

      // 9. Health Vault Documents
      const vaultColl = db.collection('health_vault_documents');
      await vaultColl.createIndex({ cloudinaryPublicId: 1 }, { unique: true, name: 'uniq_cloudinaryPublicId' });
      await vaultColl.createIndex({ userId: 1, createdAt: -1 }, { name: 'idx_vault_userId_created' });

      // 10. Safety Incidents
      const safetyColl = db.collection('safety_incidents');
      await safetyColl.createIndex({ userId: 1, createdAt: -1 }, { name: 'idx_safety_userId_created' });
      await safetyColl.createIndex({ status: 1, createdAt: -1 }, { name: 'idx_safety_status_created' });

      // 11. Audit Logs
      const auditColl = db.collection('audit_logs');
      await auditColl.createIndex({ actorUserId: 1, timestamp: -1 }, { name: 'idx_audit_actor_timestamp' });
      await auditColl.createIndex({ module: 1, timestamp: -1 }, { name: 'idx_audit_module_timestamp' });

      await migrationsCollection.updateOne(
        { migrationId: mig001Id },
        {
          $set: {
            completedAt: new Date(),
            status: 'COMPLETED',
          },
        },
      );

      appliedMigrations.push(mig001Id);
      console.log(`✅ Migration [${mig001Id}] Completed Successfully.`);
    } else {
      console.log(`Migration [${mig001Id}] already applied. Skipping.`);
    }
  } catch (err: any) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    await locksCollection.deleteOne({ _id: lockId as any, workerId });
    if (mongod) {
      await mongoose.disconnect();
      await mongod.stop();
    }
  }

  return { success: true, applied: appliedMigrations };
}

if (require.main === module) {
  runVersionedMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Versioned Migration Runner Error:', err);
      process.exit(1);
    });
}
