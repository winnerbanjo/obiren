import mongoose from 'mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Jest globalTeardown. Runs in the same parent process as globalSetup, where
 * `global.__MONGOD__` holds the in-memory MongoDB instance. Without this the
 * mongod child process keeps Jest alive and forces `--forceExit`.
 */
module.exports = async () => {
  await mongoose.disconnect().catch(() => undefined);
  const server = (globalThis as unknown as { __MONGOD__?: MongoMemoryServer }).__MONGOD__;
  if (server && typeof server.stop === 'function') {
    await server.stop().catch(() => undefined);
  }
};
