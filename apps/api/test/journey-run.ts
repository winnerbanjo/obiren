/**
 * Final acceptance test: boots the REAL compiled API with production-grade
 * env validation and runs the complete user journey over HTTP.
 */
process.env.NODE_ENV = 'test';
process.env.PORT = '4550';

// Start an in-memory MongoDB for the journey (simulates a live DB).
const { MongoMemoryServer } = require('mongodb-memory-server');
let mongod: any = null;

async function startDb() {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('obiren_e2e_final');
}
process.env.JWT_ACCESS_SECRET = 'final-acceptance-access-secret-0123456789abcdef';
process.env.JWT_REFRESH_SECRET = 'final-acceptance-refresh-secret-0123456789abcdef';
process.env.CORS_ORIGINS = 'http://localhost:3001';
process.env.CRON_SECRET = 'final-acceptance-cron-secret-0123';

import * as request from 'supertest';

const results: Array<[string, boolean, string]> = [];
const check = (name: string, ok: boolean, detail = '') => { results.push([name, ok, detail]); };

async function main() {
  await startDb();
  // 1. Boot the real app (configureApp applied via createTestApp-equivalent)
  const { createTestApp } = await import('./helpers').then(m => ({ createTestApp: m.createTestApp }));
  const app = await createTestApp();
  const server = (request as any)(app.getHttpServer());
  const logCheck = (name: string, ok: boolean, detail = '') => { if (!ok) console.log(`  ✗ ${name} ${detail}`); };

  const email = `journey-${Date.now()}@obiren-e2e.com`;
  const password = 'JourneyPass123';

  // 2. Register
  const reg = await server.post('/api/v1/auth/register').send({ email, password, firstName: 'Journey', lastName: 'Tester', countryCode: 'NG' });
  check('1. register', reg.status === 201, `${reg.status}`);
  const verifyToken = reg.body?.data?.verificationToken;

  // 3. Verify email
  if (verifyToken) {
    const ver = await server.post('/api/v1/auth/verify-email').send({ token: verifyToken });
    check('2. verify email', ver.status === 200 && ver.body?.data?.emailVerified === true, `${ver.status}`);
  } else { check('2. verify email', false, 'no token returned'); }

  // 4. Sign in
  const login = await server.post('/api/v1/auth/login').send({ email, password, platform: 'web' });
  check('3. sign in', login.status === 200, `${login.status}`);
  const access = login.body?.data?.tokens?.accessToken;
  const refresh = login.body?.data?.tokens?.refreshToken;
  const auth = { Authorization: `Bearer ${access}` };

  // 5. Refresh (session restoration)
  const ref = await server.post('/api/v1/auth/refresh').send({ refreshToken: refresh });
  check('4. refresh token', ref.status === 200 && !!ref.body?.data?.accessToken, `${ref.status}`);
  const newAccess = ref.body?.data?.accessToken;
  const auth2 = { Authorization: `Bearer ${newAccess}` };

  // 6. Profile update
  const prof = await server.patch('/api/v1/users/me').set(auth2).send({ firstName: 'Ada', displayName: 'Ada J.' });
  check('5. update profile', prof.status === 200, `${prof.status}`);
  const me = await server.get('/api/v1/auth/me').set(auth2);
  check('5b. dashboard identity', me.status === 200 && me.body?.data?.profile?.displayName === 'Ada J.', `${me.status}`);

  // 7. Create real cycle data
  const start = await server.post('/api/v1/cycles/start-period').set(auth2).send({ date: '2026-09-01' });
  check('6. create cycle', start.status === 201 && start.body?.data?.cycle?.status === 'active', `${start.status}`);
  check('6b. prediction returned', !!start.body?.data?.prediction?.predictedStartDate, '');

  // 8. Daily log
  const log = await server.put('/api/v1/daily-logs/2026-09-03').set(auth2).send({ bleeding: { level: 'medium' }, pain: { level: 4 }, moods: ['Calm'], symptoms: ['Cramps'] });
  check('7. daily log', log.status === 200 || log.status === 201, `${log.status}`);

  // 9. Retrieve cycle data after refresh of tokens
  const hist = await server.get('/api/v1/cycles/history').set(auth2);
  check('8. history persists', hist.status === 200 && (hist.body?.data?.length || 0) >= 1, `${hist.status}`);
  const cur = await server.get('/api/v1/cycles/current').set(auth2);
  check('8b. current cycle', cur.status === 200 && cur.body?.data?.status === 'active', `${cur.status}`);

  // 10. Safety PIN + SOS round trip
  const pin = await server.post('/api/v1/safety/pin').set(auth2).send({ pin: '9876' });
  check('9. safety pin create', pin.status === 201 || pin.status === 200, `${pin.status}`);
  const sos = await server.post('/api/v1/safety/sos/trigger').set(auth2).send({ isTestMode: true });
  check('9b. sos trigger', sos.status === 201 || sos.status === 200, `${sos.status}`);
  const badCancel = await server.post('/api/v1/safety/sos/cancel').set(auth2).send({ pin: '1111' });
  check('9c. wrong pin rejected', badCancel.status === 401, `${badCancel.status}`);
  const cancel = await server.post('/api/v1/safety/sos/cancel').set(auth2).send({ pin: '9876' });
  check('9d. correct pin cancels', cancel.status === 200 || cancel.status === 201, `${cancel.status}`);

  // 11. Directory access
  const dir = await server.get('/api/v1/directory/search?countryCode=NG&limit=5');
  check('10. directory search', dir.status === 200 && (dir.body?.data?.length || 0) > 0, `${dir.status}`);

  // 12. Sign out
  const out = await server.post('/api/v1/auth/logout').send({ refreshToken: ref.body?.data?.refreshToken || refresh });
  check('11. sign out', out.status === 200, `${out.status}`);

  // 13. Protected access after logout fails
  const afterLogout = await server.post('/api/v1/auth/refresh').send({ refreshToken: refresh });
  check('12. revoked after logout', afterLogout.status === 401, `${afterLogout.status}`);

  // 14. Admin enforcement: user blocked
  const adminBlocked = await server.get('/api/v1/admin/metrics').set(auth2);
  check('13. user blocked from admin', adminBlocked.status === 403, `${adminBlocked.status}`);

  // 15. Admin can sign in via DB role
  const mongoose = require('mongoose');
  const db = (app as any).get(require('@nestjs/mongoose').getConnectionToken());
  await db.collection('users').updateOne({ emailNormalized: email }, { $set: { roles: ['super_admin'] } });
  const adminMetrics = await server.get('/api/v1/admin/metrics').set(auth2);
  check('14. admin access after DB role', adminMetrics.status === 200 && adminMetrics.body?.data?.totalUsers !== undefined, `${adminMetrics.status}`);

  // 16. Malformed request rejected
  const bad = await server.post('/api/v1/auth/register').send({ email: 'not-an-email', password: 'x', isAdmin: true });
  check('15. malformed request rejected', bad.status === 400, `${bad.status}`);

  // 17. Waitlist persists durably
  const wl = await server.post('/api/v1/waitlist').send({ email: `wl-${Date.now()}@example.com`, firstName: 'Persist', source: 'final-test' });
  check('16. waitlist signup', wl.status === 201 || wl.status === 200, `${wl.status}`);
  const wlCount = await db.collection('waitlist_entries').countDocuments();
  check('16b. waitlist persisted', wlCount >= 1, `${wlCount}`);

  await app.close();
  if (mongod) await mongod.stop();

  const passed = results.filter(r => r[1]).length;
  console.log(`\nE2E JOURNEY: ${passed}/${results.length} checks passed`);
  results.forEach(([n, ok]) => console.log(`  ${ok ? '✓' : '✗'} ${n}`));
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => { console.error('E2E FAILURE:', e); process.exit(1); });
