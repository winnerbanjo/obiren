/**
 * Sanitized demo seed: one account per supported role, plus one verified
 * clinician with priced sessions so the care endpoints are usable locally.
 *
 * Refuses to run against a production configuration, and never touches real
 * health data. Usage:
 *   npx ts-node --transpile-only scripts/seed-demo.ts
 */
import * as argon2 from 'argon2';
import mongoose from 'mongoose';
import { env } from '../src/config/env.validation';
import { UserSchema } from '../src/database/schemas/user.schema';
import { UserProfileSchema } from '../src/database/schemas/user.schema';
import { ClinicianSchema } from '../src/database/schemas/care.schema';

const DEMO_PASSWORD = 'DemoPass123';

const ACCOUNTS: Array<{ email: string; firstName: string; lastName: string; roles: string[] }> = [
  { email: 'patient@demo.obiren.app', firstName: 'Demo', lastName: 'Patient', roles: ['user'] },
  { email: 'guardian@demo.obiren.app', firstName: 'Demo', lastName: 'Guardian', roles: ['user', 'guardian'] },
  { email: 'clinician@demo.obiren.app', firstName: 'Demo', lastName: 'Clinician', roles: ['user', 'clinician'] },
  { email: 'reviewer@demo.obiren.app', firstName: 'Demo', lastName: 'Reviewer', roles: ['user', 'medical_reviewer'] },
  { email: 'admin@demo.obiren.app', firstName: 'Demo', lastName: 'Admin', roles: ['user', 'super_admin'] },
];

export async function seedDemo(uri: string) {
  if (env().nodeEnv === 'production') {
    throw new Error('Refusing to seed demo accounts in production');
  }

  await mongoose.connect(uri);
  const users = mongoose.model('User', UserSchema);
  const profiles = mongoose.model('UserProfile', UserProfileSchema);
  const clinicians = mongoose.model('Clinician', ClinicianSchema);

  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });
  const created: Array<{ email: string; roles: string[] }> = [];

  for (const account of ACCOUNTS) {
    const existing = await users.findOne({ emailNormalized: account.email });
    const user =
      existing ||
      (await users.create({
        email: account.email,
        emailNormalized: account.email,
        passwordHash,
        status: 'active',
        roles: account.roles,
        countryCode: 'NG',
        preferredLanguage: 'en',
        emailVerifiedAt: new Date(),
      }));

    await users.updateOne(
      { _id: user._id },
      { $set: { roles: account.roles, status: 'active', emailVerifiedAt: new Date() } },
    );
    await profiles.updateOne(
      { userId: user._id },
      {
        $setOnInsert: {
          firstName: account.firstName,
          lastName: account.lastName,
          displayName: `${account.firstName} ${account.lastName}`,
          countryCode: 'NG',
          timeZone: 'Africa/Lagos',
          onboardingStatus: 'COMPLETED',
        },
      },
      { upsert: true },
    );

    if (account.roles.includes('clinician')) {
      await clinicians.updateOne(
        { userId: user._id },
        {
          $set: {
            displayName: 'Dr. Demo Clinician',
            specialties: ['gynaecology'],
            languages: ['en'],
            countryCode: 'NG',
            profession: 'Gynaecologist',
            certifications: ['Demo certification'],
            // Minor units (kobo). A missing price makes checkout fail closed.
            feeBySessionType: { video: 500000, audio: 350000, text: 200000, clinic: 750000 },
            verificationStatus: 'verified',
            verificationEvidenceRef: 'demo-seed-evidence',
            active: true,
            reviewedAt: new Date(),
          },
        },
        { upsert: true },
      );
    }

    created.push({ email: account.email, roles: account.roles });
  }

  console.log('Seeded demo accounts (password: %s):', DEMO_PASSWORD);
  created.forEach((account) => console.log(` - ${account.email} [${account.roles.join(', ')}]`));

  return created;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required (use the in-memory dev launcher or a non-production database)');
  await seedDemo(uri);
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(async (error) => {
    console.error('Demo seed failed:', error);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });
}
