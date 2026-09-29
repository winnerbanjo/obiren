/**
 * Proves production fail-fast: boots the real env validator in production
 * mode with missing secrets and expects a hard refusal.
 */
process.env.NODE_ENV = 'production';
delete process.env.JWT_ACCESS_SECRET;
delete process.env.JWT_REFRESH_SECRET;
delete process.env.MONGODB_URI;
delete process.env.CORS_ORIGINS;

const { env } = require('../src/config/env.validation');
try {
  env();
  console.log('FAILFAST: FAILED - production booted without secrets');
  process.exit(1);
} catch {
  console.log('FAILFAST: PASS - production refused to start with missing secrets');
  process.exit(0);
}
