import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer | null = null;

module.exports = async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('obiren_test');
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test-only-access-secret-value-0000000000000000';
  process.env.JWT_REFRESH_SECRET = 'test-only-refresh-secret-value-000000000000000';
  process.env.CORS_ORIGINS = 'http://localhost:3000,http://localhost:3001';
  process.env.HEALTH_DATA_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  process.env.HEALTH_DATA_ENCRYPTION_KEY_ID = 'test-key';
  process.env.WEB_APP_URL = 'http://localhost:3001';
  // Rate-limit enforcement itself is covered by a dedicated spec with low
  // limits; the shared e2e database must not throttle ordinary flows.
  process.env.THROTTLE_TTL_MS = '60000';
  process.env.THROTTLE_LIMIT = '100000';
  process.env.THROTTLE_AUTH_TTL_MS = '60000';
  process.env.THROTTLE_AUTH_LIMIT = '100000';
  process.env.IDEMPOTENCY_TTL_SECONDS = '3600';
  delete process.env.RESEND_API_KEY;
  delete process.env.REDIS_URL;

  (globalThis as unknown as { __MONGOD__?: MongoMemoryServer }).__MONGOD__ = mongod;
};
