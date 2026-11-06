import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import { createTestApp, getDb, registerUser, setUserRole, uniqueEmail } from './helpers';
import { setAdminAccount } from '../scripts/set-admin';

/**
 * The internal console is not an ordinary client: only the address recorded in
 * `admin_accounts` may sign in, every other address is refused before its
 * password is looked at, and refusals are written to the audit log.
 */
describe('Admin console access (e2e)', () => {
  let app: INestApplication;
  let adminEmail: string;
  const adminPassword = 'ConsolePass123';

  const consoleLogin = (email: string, password: string) =>
    request(app.getHttpServer()).post('/api/v1/auth/admin/login').send({ email, password });

  beforeAll(async () => {
    app = await createTestApp();

    // Provisioned the way an operator would: the server-side script writes the
    // account and the allowlist row, not any HTTP route.
    adminEmail = uniqueEmail('console-admin');
    await setAdminAccount({
      uri: process.env.MONGODB_URI as string,
      email: adminEmail,
      password: adminPassword,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect().catch(() => undefined);
    await app.close();
  });

  it('signs in the allowlisted administrator and stamps the console access', async () => {
    const res = await consoleLogin(adminEmail, adminPassword);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(adminEmail);
    expect(res.body.data.user.roles).toContain('super_admin');
    expect(typeof res.body.data.tokens.accessToken).toBe('string');
    expect(res.headers['set-cookie']).toBeDefined();

    const access = await getDb(app)
      .collection('admin_accounts')
      .findOne({ emailNormalized: adminEmail });
    expect(access?.status).toBe('active');
    expect(access?.lastConsoleLoginAt).toBeInstanceOf(Date);
  });

  it('refuses a non-allowlisted email before checking its password and logs the attempt', async () => {
    // A real, working account holding super_admin: correct password, and the
    // console must still refuse it because the address is not the allowlisted one.
    const outsider = await registerUser(app, { password: 'OutsiderPass123' });
    await setUserRole(app, outsider.userId!, 'super_admin');

    const res = await consoleLogin(outsider.email, outsider.password);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('AUTH_ADMIN_EMAIL_BLOCKED');
    expect(res.body.data).toBeUndefined();
    expect(res.headers['set-cookie']).toBeUndefined();

    const attempt = await getDb(app)
      .collection('audit_logs')
      .findOne({ targetResourceId: outsider.email.toLowerCase(), action: 'auth.admin_login.blocked' });
    expect(attempt).not.toBeNull();
    expect(attempt?.details).toContain(outsider.email.toLowerCase());
    expect(attempt?.module).toBe('auth');
    expect(typeof attempt?.ipAddress).toBe('string');
    expect(attempt?.timestamp).toBeInstanceOf(Date);
  });

  it('rejects a wrong password for the allowlisted administrator and logs it', async () => {
    const res = await consoleLogin(adminEmail, 'WrongPass123');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');

    const attempt = await getDb(app)
      .collection('audit_logs')
      .findOne({
        targetResourceId: adminEmail,
        details: { $regex: '^invalid_credentials' },
      });
    expect(attempt).not.toBeNull();
  });

  it('offers no client route that can create admin credentials', async () => {
    const email = uniqueEmail('wannabe-admin');

    // Registration is strict: an admin role in the body is rejected outright.
    const rejected = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email,
      password: 'SecurePass123',
      firstName: 'Wannabe',
      lastName: 'Admin',
      roles: ['super_admin'],
    });
    expect(rejected.status).toBe(400);

    // An ordinary registration creates a plain user and no console row.
    const user = await registerUser(app, { email, password: 'SecurePass123' });
    const db = getDb(app);
    const stored = await db
      .collection('users')
      .findOne({ _id: new mongoose.Types.ObjectId(user.userId!) });
    expect(stored?.roles).toEqual(['user']);
    expect(await db.collection('admin_accounts').countDocuments({ emailNormalized: email })).toBe(0);

    // And that account cannot get into the console.
    const blocked = await consoleLogin(email, 'SecurePass123');
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('AUTH_ADMIN_EMAIL_BLOCKED');
  });
});
