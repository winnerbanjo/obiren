/**
 * Writes the one administrator credential for the internal console
 * (admin.obiren.co) into the database. There is deliberately no HTTP route that
 * can do this: the console's sign-in path reads the `admin_accounts` allowlist,
 * and a client can never add a row to it.
 *
 *   cd apps/api
 *   npx ts-node --transpile-only scripts/set-admin.ts \
 *     --email you@obiren.co --password 'Str0ngPass123'
 *
 * Against the database that MONGODB_URI points at, it:
 *   - creates or updates the User account and gives it the super_admin role;
 *   - hashes the password with Argon2id (the same scheme POST /auth/login uses);
 *   - makes that address the single *active* row in `admin_accounts`, disabling
 *     any other row, so a previous administrator immediately stops signing in;
 *   - reports every *other* account that still holds an admin role. Add
 *     `--demote-others` to strip those roles as well.
 *
 * The email is printed, the password never is.
 */
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import * as argon2 from 'argon2';
import mongoose, { Types } from 'mongoose';
import { UserSchema, UserProfileSchema } from '../src/database/schemas/user.schema';
import { AdminAccessSchema } from '../src/database/schemas/admin-access.schema';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

/** Roles the admin console and the admin API accept. */
export const ADMIN_ROLES = [
  'super_admin',
  'platform_admin',
  'emergency_manager',
  'compliance_officer',
  'content_manager',
  'medical_reviewer',
  'support_agent',
];

export interface SetAdminOptions {
  uri: string;
  email: string;
  password: string;
  displayName?: string;
  note?: string;
  demoteOthers?: boolean;
  log?: (message: string) => void;
}

export interface SetAdminResult {
  userId: string;
  email: string;
  created: boolean;
  disabledAccessRows: string[];
  otherAdminAccounts: string[];
  demoted: string[];
}

/** Same rule the API enforces on every password it stores. */
function assertEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized) || normalized.length > 320) {
    throw new Error(`"${email}" is not a valid email address.`);
  }
  return normalized;
}

function assertPassword(password: string): void {
  if (password.length < 8) throw new Error('Password must be at least 8 characters long.');
  if (password.length > 128) throw new Error('Password must be at most 128 characters long.');
  if (!/[A-Z]/.test(password)) throw new Error('Password must contain at least one uppercase letter.');
  if (!/[0-9]/.test(password)) throw new Error('Password must contain at least one number.');
}

export async function setAdminAccount(options: SetAdminOptions): Promise<SetAdminResult> {
  const log = options.log ?? (() => undefined);
  const emailNormalized = assertEmail(options.email);
  assertPassword(options.password);

  const connection = await mongoose
    .createConnection(options.uri, { serverSelectionTimeoutMS: 25000 })
    .asPromise();

  try {
    const users = connection.model('User', UserSchema);
    const profiles = connection.model('UserProfile', UserProfileSchema);
    const adminAccess = connection.model('AdminAccess', AdminAccessSchema);

    const passwordHash = await argon2.hash(options.password, { type: argon2.argon2id });
    const existing = await users.findOne({ emailNormalized }).lean().exec();

    let userId: Types.ObjectId;
    if (existing) {
      // Keep whatever else the account already had (a Google link, a clinician
      // role) and only add what the console needs.
      const roles = Array.from(new Set([...(existing.roles ?? []), 'user', 'super_admin']));
      const providers = Array.from(new Set([...(existing.authProviders ?? ['password']), 'password']));
      await users.updateOne(
        { _id: existing._id },
        {
          $set: {
            email: emailNormalized,
            passwordHash,
            roles,
            authProviders: providers,
            status: 'active',
            emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
          },
        },
      );
      userId = existing._id as Types.ObjectId;
      log(`  ~ ${emailNormalized} updated (roles: ${roles.join(', ')})`);
    } else {
      const createdUser = await users.create({
        email: emailNormalized,
        emailNormalized,
        passwordHash,
        roles: ['user', 'super_admin'],
        authProviders: ['password'],
        status: 'active',
        emailVerifiedAt: new Date(),
        countryCode: 'NG',
        timeZone: 'Africa/Lagos',
      });
      userId = createdUser._id as Types.ObjectId;
      log(`  + ${emailNormalized} created (roles: user, super_admin)`);
    }

    const displayName = options.displayName?.trim() || emailNormalized.split('@')[0];
    await profiles.updateOne(
      { userId },
      {
        $set: { displayName },
        $setOnInsert: {
          firstName: displayName,
          lastName: '',
          countryCode: 'NG',
          timeZone: 'Africa/Lagos',
          onboardingStatus: 'COMPLETED',
          trackingGoal: 'CYCLE_TRACKING',
        },
      },
      { upsert: true },
    );

    // One administrator, one row. Anything else that used to be active is
    // disabled before the new row is written.
    const previouslyActive = await adminAccess
      .find({ emailNormalized: { $ne: emailNormalized }, status: 'active' })
      .lean()
      .exec();
    if (previouslyActive.length > 0) {
      await adminAccess.updateMany(
        { emailNormalized: { $ne: emailNormalized } },
        { $set: { status: 'disabled' } },
      );
    }

    await adminAccess.updateOne(
      { emailNormalized },
      {
        $set: {
          userId,
          email: emailNormalized,
          status: 'active',
          ...(options.note ? { note: options.note } : {}),
        },
      },
      { upsert: true },
    );

    const otherAdminAccounts = await users
      .find({ emailNormalized: { $ne: emailNormalized }, roles: { $in: ADMIN_ROLES } })
      .select('email roles')
      .lean()
      .exec();

    const demoted: string[] = [];
    if (options.demoteOthers && otherAdminAccounts.length > 0) {
      for (const other of otherAdminAccounts) {
        const roles = (other.roles ?? []).filter((role) => !ADMIN_ROLES.includes(role));
        await users.updateOne({ _id: other._id }, { $set: { roles: roles.length > 0 ? roles : ['user'] } });
        demoted.push(other.email);
      }
    }

    return {
      userId: userId.toString(),
      email: emailNormalized,
      created: !existing,
      disabledAccessRows: previouslyActive.map((row) => row.emailNormalized),
      otherAdminAccounts: otherAdminAccounts.map((other) => other.email),
      demoted,
    };
  } finally {
    await connection.close().catch(() => undefined);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string) => args.includes(name);
  const value = (name: string, fallback?: string) => {
    const index = args.indexOf(name);
    if (index === -1) return fallback;
    const next = args[index + 1];
    if (!next || next.startsWith('--')) throw new Error(`${name} needs a value.`);
    return next;
  };

  const email = value('--email') || process.env.ADMIN_EMAIL;
  const password = value('--password') || process.env.ADMIN_PASSWORD;
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is required. Run from apps/api so its .env is loaded, or export it.');
  }
  if (!email || !password) {
    throw new Error(
      'Usage: npx ts-node --transpile-only scripts/set-admin.ts --email you@obiren.co --password \'Str0ngPass123\' [--name "Full Name"] [--demote-others]',
    );
  }

  console.log('Obiren admin console credential');
  console.log(`  database: ${targetDatabase(uri)}`);
  console.log(`  NODE_ENV: ${process.env.NODE_ENV || '(unset)'}`);
  console.log('');

  const result = await setAdminAccount({
    uri,
    email,
    password,
    displayName: value('--name'),
    note: value('--note') ?? `set by scripts/set-admin.ts on ${new Date().toISOString().slice(0, 10)}`,
    demoteOthers: flag('--demote-others'),
    log: (message) => console.log(message),
  });

  if (result.disabledAccessRows.length > 0) {
    console.log(`  - disabled previous allowlist row(s): ${result.disabledAccessRows.join(', ')}`);
  }

  console.log('');
  console.log(`Admin console sign-in is now limited to ${result.email}.`);
  console.log(`  console: ${process.env.ADMIN_APP_URL || 'https://admin.obiren.co'}/user`);

  if (result.otherAdminAccounts.length > 0) {
    console.log('');
    console.log('WARNING: these accounts still hold admin roles and can reach the admin API');
    console.log('through POST /auth/login, even though the console will refuse them:');
    for (const account of result.otherAdminAccounts) console.log(`  ! ${account}`);
    if (result.demoted.length > 0) {
      console.log(`  roles removed from: ${result.demoted.join(', ')}`);
    } else {
      console.log('  Re-run with --demote-others to strip those roles, or change their status');
      console.log('  to "suspended" in the admin API.');
    }
  }
}

/** Prints only the database name, never the credentials in the URI. */
function targetDatabase(uri: string): string {
  const withoutQuery = uri.split('?')[0];
  const name = withoutQuery.slice(withoutQuery.lastIndexOf('/') + 1);
  return name || '(driver default)';
}

if (require.main === module) {
  main().catch(async (error) => {
    console.error('Admin credential setup failed:', error instanceof Error ? error.message : error);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });
}
