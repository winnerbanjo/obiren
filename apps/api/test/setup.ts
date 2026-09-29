import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod: MongoMemoryServer | null = null;

module.exports = async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('obiren_test');
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test-only-access-secret-value-0000000000000000';
  process.env.JWT_REFRESH_SECRET = 'test-only-refresh-secret-value-000000000000000';
  process.env.CORS_ORIGINS = 'http://localhost:3000,http://localhost:3001';
  (global as any).__MONGOD__ = mongod;
};

module.exports.teardown = async () => {
  await mongoose.disconnect().catch(() => undefined);
  if (mongod) await mongod.stop().catch(() => undefined);
};
