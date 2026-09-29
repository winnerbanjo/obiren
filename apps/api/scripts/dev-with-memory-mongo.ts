/**
 * Local development launcher: boots an in-memory MongoDB (no local mongod
 * needed) and then starts the NestJS API against it.
 *
 * Usage: npx ts-node --transpile-only scripts/dev-with-memory-mongo.ts
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

async function main() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('obiren_development');

  process.env.NODE_ENV = 'development';
  process.env.PORT = process.env.PORT || '3000';
  process.env.MONGODB_URI = uri;
  process.env.JWT_ACCESS_SECRET = 'local-dev-access-secret-0123456789abcdef';
  process.env.JWT_REFRESH_SECRET = 'local-dev-refresh-secret-0123456789abcdef';
  process.env.CORS_ORIGINS = 'http://localhost:3000,http://localhost:3001,http://localhost:3002';
  process.env.CRON_SECRET = 'local-dev-cron-secret-0123456789';

  // eslint-disable-next-line no-console
  console.log('📦 In-memory MongoDB ready:', uri);

  require('../src/main');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start dev stack:', err);
  process.exit(1);
});
