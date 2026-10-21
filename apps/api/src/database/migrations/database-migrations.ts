import mongoose from 'mongoose';
import * as crypto from 'crypto';

/**
 * mongodb-memory-server is an optional devDependency used only when running
 * migrations with no database URI (local sandboxes). Production always has
 * MONGODB_URI, so it is loaded lazily - production builds skip devDependencies
 * and must not import it statically.
 */
async function loadMemoryServer(): Promise<any> {
  // Computed specifier: tsc must not resolve this optional devDependency at
  // build time (production installs skip devDependencies).
  const pkgId = ['mongodb', 'memory', 'server'].join('-');
  try {
    return (await import(pkgId)).MongoMemoryServer;
  } catch {
    throw new Error('mongodb-memory-server is not installed. Install devDependencies to run migrations without a database URI.');
  }
}

export async function runVersionedMigrations(dbUri?: string): Promise<{ success: boolean; applied: string[] }> {
  let mongod: any | null = null;
  let uri = dbUri || process.env.MONGODB_URI;

  if (!uri) {
    const MongoMemoryServer = await loadMemoryServer();
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

    const mig002Id = '002_onboarding_consent_indexes';
    const mig002Name = 'Create unique onboarding draft and append-only consent history indexes';
    const mig002Checksum = crypto.createHash('sha256').update(mig002Id + mig002Name).digest('hex');
    const existing002 = await migrationsCollection.findOne({ migrationId: mig002Id, status: 'COMPLETED' });
    if (!existing002) {
      await migrationsCollection.updateOne(
        { migrationId: mig002Id },
        { $set: { name: mig002Name, checksum: mig002Checksum, startedAt: new Date(), status: 'PENDING', appVersion: '1.0.0' } },
        { upsert: true },
      );
      await db.collection('onboarding').createIndex({ userId: 1 }, { unique: true, name: 'uniq_onboarding_userId' });
      await db.collection('consent_events').createIndex(
        { userId: 1, purpose: 1, recordedAt: -1 },
        { name: 'idx_consent_user_purpose_recorded' },
      );
      await migrationsCollection.updateOne(
        { migrationId: mig002Id },
        { $set: { completedAt: new Date(), status: 'COMPLETED' } },
      );
      appliedMigrations.push(mig002Id);
    }

    const mig004Id = '004_pregnancy_logs';
    const mig004Name = 'Add owner/date pregnancy check-in indexes';
    const mig004Checksum = crypto.createHash('sha256').update(mig004Id + mig004Name).digest('hex');
    const existing004 = await migrationsCollection.findOne({ migrationId: mig004Id, status: 'COMPLETED' });
    if (!existing004) {
      await migrationsCollection.updateOne(
        { migrationId: mig004Id },
        { $set: { name: mig004Name, checksum: mig004Checksum, startedAt: new Date(), status: 'PENDING', appVersion: '1.0.0' } },
        { upsert: true },
      );
      await db.collection('pregnancy_logs').createIndex({ pregnancyId: 1, date: 1 }, { unique: true, name: 'uniq_pregnancy_log_parent_date' });
      await db.collection('pregnancy_logs').createIndex({ userId: 1, date: 1 }, { name: 'idx_pregnancy_log_user_date' });
      await migrationsCollection.updateOne(
        { migrationId: mig004Id },
        { $set: { completedAt: new Date(), status: 'COMPLETED' } },
      );
      appliedMigrations.push(mig004Id);
    }

    const mig005Id = '005_prd_milestones_2_5';
    const mig005Name = 'Add provider-neutral home, care, communications, guardian, and privacy job storage indexes';
    const mig005Checksum = crypto.createHash('sha256').update(mig005Id + mig005Name).digest('hex');
    const existing005 = await migrationsCollection.findOne({ migrationId: mig005Id, status: 'COMPLETED' });
    if (!existing005) {
      await migrationsCollection.updateOne(
        { migrationId: mig005Id },
        { $set: { name: mig005Name, checksum: mig005Checksum, startedAt: new Date(), status: 'PENDING', appVersion: '1.0.0' } },
        { upsert: true },
      );
      await db.collection('clinicians').createIndex({ verificationStatus: 1, active: 1, countryCode: 1 }, { name: 'idx_clinician_verified_active_country' });
      await db.collection('availability_slots').createIndex({ clinicianId: 1, startsAt: 1 }, { unique: true, name: 'uniq_clinician_slot_start' });
      await db.collection('availability_slots').createIndex({ status: 1, startsAt: 1, holdExpiresAt: 1 }, { name: 'idx_availability_status_start_expiry' });
      await db.collection('booking_holds').createIndex({ userId: 1, createdAt: -1 }, { name: 'idx_booking_hold_user_created' });
      await db.collection('booking_holds').createIndex({ slotId: 1, status: 1 }, { name: 'idx_booking_hold_slot_status' });
      await db.collection('booking_holds').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 2592000, name: 'ttl_booking_hold_retention' });
      await db.collection('notification_preferences').createIndex({ userId: 1 }, { unique: true, name: 'uniq_notification_preference_user' });
      await db.collection('consultation_messages').createIndex({ consultationId: 1, createdAt: -1 }, { name: 'idx_message_consultation_created' });
      await db.collection('health_shares').createIndex({ recipientUserId: 1, expiresAt: 1, revokedAt: 1 }, { name: 'idx_share_recipient_expiry_revoked' });
      await db.collection('privacy_jobs').createIndex({ userId: 1, type: 1, requestedAt: -1 }, { name: 'idx_privacy_job_owner_type_requested' });
      await db.collection('privacy_jobs').createIndex({ status: 1, availableAt: 1 }, { name: 'idx_privacy_job_worker' });
      await db.collection('guardian_contacts').createIndex({ ownerUserId: 1, phoneE164: 1 }, { unique: true, name: 'uniq_guardian_owner_phone' });
      await db.collection('guardian_invites').createIndex({ ownerUserId: 1, status: 1 }, { name: 'idx_guardian_invite_owner_status' });
      await db.collection('guardian_invites').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 2592000, name: 'ttl_guardian_invite_retention' });
      await db.collection('notification_outbox').createIndex({ userId: 1, createdAt: -1 }, { name: 'idx_notification_user_created' });
      await migrationsCollection.updateOne({ migrationId: mig005Id }, { $set: { completedAt: new Date(), status: 'COMPLETED' } });
      appliedMigrations.push(mig005Id);
    }

    const mig006Id = '006_consultation_device_delivery_indexes';
    const mig006Name = 'Add consultation, device token, and SOS delivery-attempt indexes';
    const mig006Checksum = crypto.createHash('sha256').update(mig006Id + mig006Name).digest('hex');
    const existing006 = await migrationsCollection.findOne({ migrationId: mig006Id, status: 'COMPLETED' });
    if (!existing006) {
      await migrationsCollection.updateOne(
        { migrationId: mig006Id },
        { $set: { name: mig006Name, checksum: mig006Checksum, startedAt: new Date(), status: 'PENDING', appVersion: '1.0.0' } },
        { upsert: true },
      );
      await db.collection('consultations').createIndex({ participantUserIds: 1, _id: -1 }, { name: 'idx_consultation_participant' });
      await db.collection('consultations').createIndex({ patientUserId: 1, createdAt: -1 }, { name: 'idx_consultation_patient' });
      await db.collection('consultations').createIndex({ clinicianUserId: 1, createdAt: -1 }, { name: 'idx_consultation_clinician' });
      await db.collection('devices').createIndex({ tokenHash: 1 }, { unique: true, name: 'uniq_device_token_hash' });
      await db.collection('devices').createIndex({ userId: 1, status: 1, lastSeenAt: -1 }, { name: 'idx_device_owner_status' });
      await db.collection('safety_delivery_attempts').createIndex({ incidentId: 1, createdAt: 1 }, { name: 'idx_delivery_attempt_incident' });
      await db.collection('safety_delivery_attempts').createIndex({ ownerUserId: 1, createdAt: -1 }, { name: 'idx_delivery_attempt_owner' });
      await migrationsCollection.updateOne({ migrationId: mig006Id }, { $set: { completedAt: new Date(), status: 'COMPLETED' } });
      appliedMigrations.push(mig006Id);
    }

    const mig003Id = '003_cycle_period_query_index';
    const mig003Name = 'Add cycle history date/status compound index';
    const mig003Checksum = crypto.createHash('sha256').update(mig003Id + mig003Name).digest('hex');
    const existing003 = await migrationsCollection.findOne({ migrationId: mig003Id, status: 'COMPLETED' });
    if (!existing003) {
      await migrationsCollection.updateOne(
        { migrationId: mig003Id },
        { $set: { name: mig003Name, checksum: mig003Checksum, startedAt: new Date(), status: 'PENDING', appVersion: '1.0.0' } },
        { upsert: true },
      );
      await db.collection('cycles').createIndex({ userId: 1, startedAt: 1, status: 1 }, { name: 'idx_cycle_user_started_status' });
      await migrationsCollection.updateOne(
        { migrationId: mig003Id },
        { $set: { completedAt: new Date(), status: 'COMPLETED' } },
      );
      appliedMigrations.push(mig003Id);
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
