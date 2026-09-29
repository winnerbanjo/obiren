// Start in-memory Mongo then import the compiled Nest app (local preview).
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mainJs = pathToFileURL(path.resolve(__dirname, '../dist/apps/api/src/main.js')).href;

const mongod = await MongoMemoryServer.create();
process.env.NODE_ENV = 'development';
process.env.PORT = process.env.PORT || '3000';
process.env.MONGODB_URI = mongod.getUri('obiren_development');
process.env.JWT_ACCESS_SECRET = 'local-dev-access-secret-0123456789abcdef';
process.env.JWT_REFRESH_SECRET = 'local-dev-refresh-secret-0123456789abcdef';
process.env.CORS_ORIGINS = 'http://localhost:3000,http://localhost:3001,http://localhost:3002';
process.env.CRON_SECRET = 'local-dev-cron-secret-0123456789';
console.log('📦 In-memory MongoDB ready');
console.log('🚀 Launching Obiren API from', mainJs);
await import(mainJs);
