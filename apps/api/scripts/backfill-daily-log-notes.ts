/**
 * Re-encrypts legacy plaintext `daily_logs.notes`.
 *
 * Defaults to a dry run. Pass --apply to write. Refuses to run in production;
 * production rollout happens through the versioned migration runner.
 */
import mongoose from 'mongoose';
import { env } from '../src/config/env.validation';
import { backfillDailyLogNotes } from '../src/database/migrations/backfill-daily-log-notes';

async function main() {
  const config = env();
  if (config.nodeEnv === 'production') {
    throw new Error('Refusing to run this backfill with NODE_ENV=production. Use the versioned migration runner.');
  }
  if (!config.healthDataEncryptionKey) {
    throw new Error('HEALTH_DATA_ENCRYPTION_KEY is required to encrypt existing notes.');
  }

  const apply = process.argv.includes('--apply');
  const uri = config.mongoUri;
  // Show only the host/database, never credentials.
  const masked = uri.replace(/\/\/([^@]+)@/, '//***@');
  console.log(`Target: ${masked}`);
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN (pass --apply to write)'}`);

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    const result = await backfillDailyLogNotes(mongoose.connection.db!, { dryRun: !apply });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('Daily-log note backfill failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
