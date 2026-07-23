import mongoose from 'mongoose';
import { UserSchema } from '../schemas/user.schema';
import { SessionSchema } from '../schemas/session.schema';
import { CycleSchema, DailyLogSchema } from '../schemas/cycle.schema';
import { PregnancySchema } from '../schemas/pregnancy.schema';
import { NotificationOutboxSchema } from '../schemas/notification.schema';
import { DirectoryServiceSchema } from '../schemas/directory.schema';
import { HealthVaultDocSchema } from '../schemas/health-vault.schema';
import { SafetyIncidentSchema } from '../schemas/safety.schema';
import { AuditLogSchema } from '../schemas/audit-log.schema';

export async function runIndexMigration(dbUri?: string) {
  const uri = dbUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/obiren_development';
  console.log(`🛠 Running Explicit MongoDB Index Migration against: ${uri}`);

  let conn: typeof mongoose;
  if (mongoose.connection.readyState === 1) {
    conn = mongoose;
  } else {
    conn = await mongoose.connect(uri);
  }

  const models = [
    { name: 'User', schema: UserSchema, collection: 'users' },
    { name: 'Session', schema: SessionSchema, collection: 'sessions' },
    { name: 'Cycle', schema: CycleSchema, collection: 'cycles' },
    { name: 'DailyLog', schema: DailyLogSchema, collection: 'daily_logs' },
    { name: 'Pregnancy', schema: PregnancySchema, collection: 'pregnancies' },
    { name: 'NotificationOutbox', schema: NotificationOutboxSchema, collection: 'notification_outbox' },
    { name: 'DirectoryService', schema: DirectoryServiceSchema, collection: 'directory_services' },
    { name: 'HealthVaultDoc', schema: HealthVaultDocSchema, collection: 'health_vault_documents' },
    { name: 'SafetyIncident', schema: SafetyIncidentSchema, collection: 'safety_incidents' },
    { name: 'AuditLog', schema: AuditLogSchema, collection: 'audit_logs' },
  ];

  for (const m of models) {
    const model = conn.model(m.name, m.schema, m.collection);
    console.log(`Syncing indexes for collection [${m.collection}]...`);
    await model.syncIndexes();
    const indexes = await model.listIndexes();
    console.log(`Indexes created on [${m.collection}]:`, indexes.map((i) => i.name));
  }

  console.log('✅ Explicit Index Migration Completed Successfully.');
}

if (require.main === module) {
  runIndexMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Index Migration Failed:', err);
      process.exit(1);
    });
}
