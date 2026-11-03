/**
 * Creates the sign-in accounts needed to walk through Obiren's three surfaces:
 *
 *   - an administrator for the internal console (`/user` on admin.obiren.co)
 *   - a test patient for the mobile app
 *   - verified, publicly listed doctors with a weekly schedule, for the portal
 *     (doctors.obiren.co/doctor/login) and for booking from the app
 *
 * This is the operational counterpart to `seed-demo.ts`: that one refuses to
 * run against a production configuration, while this one is meant for the
 * staging deployment, where the API boots with NODE_ENV=production. It is
 * therefore guarded explicitly rather than silently.
 *
 *   cd apps/api
 *   npx ts-node --transpile-only scripts/seed-accounts.ts --force
 *
 * Existing accounts are left untouched unless `--reset` is passed, so running
 * this twice can never silently overwrite a password somebody already changed.
 *
 * The seeded password is a development credential. Delete these accounts (or
 * change their passwords) before the platform handles real users.
 */
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import * as argon2 from 'argon2';
import mongoose, { Types } from 'mongoose';
import { UserSchema, UserProfileSchema } from '../src/database/schemas/user.schema';
import {
  ClinicianSchema,
  DoctorAvailabilityRuleSchema,
} from '../src/database/schemas/care.schema';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DEFAULT_PASSWORD = 'Obiren#Seed2026';
const EMAIL_DOMAIN = 'demo.obiren.co';

interface SeedAccount {
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  countryCode: 'NG' | 'GH';
  timeZone: string;
  label: string;
}

const ACCOUNTS: SeedAccount[] = [
  {
    email: `admin@${EMAIL_DOMAIN}`,
    firstName: 'Obiren',
    lastName: 'Admin',
    roles: ['user', 'super_admin'],
    countryCode: 'NG',
    timeZone: 'Africa/Lagos',
    label: 'Admin console (/user)',
  },
  {
    email: `patient@${EMAIL_DOMAIN}`,
    firstName: 'Maya',
    lastName: 'Adeyemi',
    roles: ['user'],
    countryCode: 'NG',
    timeZone: 'Africa/Lagos',
    label: 'Test patient (mobile app)',
  },
  {
    email: `doctor@${EMAIL_DOMAIN}`,
    firstName: 'Amaka',
    lastName: 'Obi',
    roles: ['user', 'clinician'],
    countryCode: 'NG',
    timeZone: 'Africa/Lagos',
    label: 'Doctor portal',
  },
  {
    email: `doctor.gh@${EMAIL_DOMAIN}`,
    firstName: 'Kofi',
    lastName: 'Mensah',
    roles: ['user', 'clinician'],
    countryCode: 'GH',
    timeZone: 'Africa/Accra',
    label: 'Doctor portal (second country)',
  },
];

interface DoctorSeed {
  email: string;
  displayName: string;
  professionalTitle: string;
  profession: string;
  specialties: string[];
  licenceNumber: string;
  yearsOfExperience: number;
  clinicName: string;
  clinicAddress: string;
  phoneNumber: string;
  languages: string[];
  bio: string;
  certifications: string[];
  /** Prices in the minor unit of the country currency (kobo/pesewa). */
  feeBySessionType: Record<string, number>;
}

const DOCTORS: DoctorSeed[] = [
  {
    email: `doctor@${EMAIL_DOMAIN}`,
    displayName: 'Dr. Amaka Obi',
    professionalTitle: 'Consultant Obstetrician & Gynaecologist',
    profession: 'Gynaecology',
    specialties: ['gynaecology', 'obstetrics'],
    licenceNumber: 'MDCN-SEED-1001',
    yearsOfExperience: 12,
    clinicName: 'Obiren Partner Clinic, Lekki',
    clinicAddress: '12 Admiralty Way, Lekki Phase 1, Lagos',
    phoneNumber: '+2348011110001',
    languages: ['en', 'ig'],
    bio: 'Obstetrician and gynaecologist supporting patients through cycle health, fertility and pregnancy care.',
    certifications: ['MBBS', 'FWACS (Obstetrics & Gynaecology)'],
    feeBySessionType: { video: 1500000, audio: 1000000, text: 500000 },
  },
  {
    email: `doctor.gh@${EMAIL_DOMAIN}`,
    displayName: 'Dr. Kofi Mensah',
    professionalTitle: 'Family Physician',
    profession: 'General practice',
    specialties: ['general_practice', 'womens_health'],
    licenceNumber: 'MDC-GH-SEED-1002',
    yearsOfExperience: 8,
    clinicName: 'Obiren Partner Clinic, Accra',
    clinicAddress: '5 Independence Avenue, Accra',
    phoneNumber: '+233201111002',
    languages: ['en', 'tw'],
    bio: 'Family physician with a focus on women’s health, contraception counselling and preventive care.',
    certifications: ['MBChB', 'MGCP'],
    feeBySessionType: { video: 1200000, clinic: 1800000 },
  },
];

/** Minutes from local midnight, Monday-Friday 09:00-16:00, Saturday 10:00-13:00. */
const WEEKLY_SCHEDULE = [
  { dayOfWeek: 1, startMinutes: 9 * 60, endMinutes: 16 * 60, sessionType: 'video' },
  { dayOfWeek: 2, startMinutes: 9 * 60, endMinutes: 16 * 60, sessionType: 'video' },
  { dayOfWeek: 3, startMinutes: 9 * 60, endMinutes: 16 * 60, sessionType: 'video' },
  { dayOfWeek: 4, startMinutes: 9 * 60, endMinutes: 16 * 60, sessionType: 'video' },
  { dayOfWeek: 5, startMinutes: 9 * 60, endMinutes: 16 * 60, sessionType: 'video' },
  { dayOfWeek: 6, startMinutes: 10 * 60, endMinutes: 13 * 60, sessionType: 'clinic' },
];

interface SeedOptions {
  uri: string;
  password: string;
  reset: boolean;
  log?: (message: string) => void;
}

export interface SeedResult {
  created: string[];
  updated: string[];
  skipped: string[];
  password: string;
}

/**
 * Idempotent. A brand-new account is created with an already-verified email and
 * active status so it can sign in immediately (the invitation flow exists for
 * doctors created by an administrator, not for seeding).
 */
export async function seedAccounts(options: SeedOptions): Promise<SeedResult> {
  const log = options.log ?? (() => undefined);
  const users = model('User', UserSchema);
  const profiles = model('UserProfile', UserProfileSchema);
  const clinicians = model('Clinician', ClinicianSchema);
  const rules = model('DoctorAvailabilityRule', DoctorAvailabilityRuleSchema);

  await mongoose.connect(options.uri);
  const passwordHash = await argon2.hash(options.password, { type: argon2.argon2id });
  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];
  const userIdByEmail = new Map<string, Types.ObjectId>();

  for (const account of ACCOUNTS) {
    const existing = await users.findOne({ emailNormalized: account.email });

    if (existing && !options.reset) {
      skipped.push(account.email);
      userIdByEmail.set(account.email, existing._id as Types.ObjectId);
      log(`  = ${account.email} already exists (skipped; pass --reset to set its password)`);
      continue;
    }

    if (existing) {
      await users.updateOne(
        { _id: existing._id },
        {
          $set: {
            passwordHash,
            roles: account.roles,
            status: 'active',
            authProviders: ['password'],
            emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
            countryCode: account.countryCode,
            timeZone: account.timeZone,
          },
        },
      );
      userIdByEmail.set(account.email, existing._id as Types.ObjectId);
      updated.push(account.email);
      log(`  ~ ${account.email} reset (roles: ${account.roles.join(', ')})`);
    } else {
      const user = await users.create({
        email: account.email,
        emailNormalized: account.email,
        passwordHash,
        status: 'active',
        roles: account.roles,
        authProviders: ['password'],
        countryCode: account.countryCode,
        timeZone: account.timeZone,
        emailVerifiedAt: new Date(),
      });
      userIdByEmail.set(account.email, user._id as Types.ObjectId);
      created.push(account.email);
      log(`  + ${account.email} (roles: ${account.roles.join(', ')})`);
    }

    const userId = userIdByEmail.get(account.email);
    if (!userId) continue;

    const profileSet = {
      firstName: account.firstName,
      lastName: account.lastName,
      displayName: `${account.firstName} ${account.lastName}`,
      countryCode: account.countryCode,
      timeZone: account.timeZone,
    };
    await profiles.updateOne(
      { userId },
      {
        $set: profileSet,
        // The patient surface expects a completed baseline before Home renders.
        $setOnInsert: { onboardingStatus: 'COMPLETED', trackingGoal: 'CYCLE_TRACKING' },
      },
      { upsert: true },
    );
  }

  for (const doctor of DOCTORS) {
    const account = ACCOUNTS.find((candidate) => candidate.email === doctor.email);
    const userId = userIdByEmail.get(doctor.email);
    if (!account || !userId) continue;

    const clinician = await clinicians.findOneAndUpdate(
      { userId },
      {
        $set: {
          displayName: doctor.displayName,
          professionalTitle: doctor.professionalTitle,
          profession: doctor.profession,
          specialties: doctor.specialties,
          languages: doctor.languages,
          countryCode: account.countryCode,
          timeZone: account.timeZone,
          certifications: doctor.certifications,
          licenceNumber: doctor.licenceNumber,
          yearsOfExperience: doctor.yearsOfExperience,
          bio: doctor.bio,
          clinicName: doctor.clinicName,
          clinicAddress: doctor.clinicAddress,
          phoneNumber: doctor.phoneNumber,
          consultationDurationMinutes: 45,
          bufferMinutes: 0,
          // Instant booking, so a user's booking is confirmed without waiting
          // for a doctor action. Switch to `manual` to exercise the approval
          // flow instead.
          bookingApprovalMode: 'instant',
          feeBySessionType: doctor.feeBySessionType,
          verificationStatus: 'verified',
          verificationEvidenceRef: `licence:${doctor.licenceNumber}`,
          reviewedAt: new Date(),
          // Listed means it appears in user-facing discovery and can be booked.
          active: true,
        },
        $setOnInsert: { credentialReviewRequired: false },
      },
      { upsert: true, new: true },
    );

    const clinicianId = clinician._id as Types.ObjectId;
    // Replace the schedule so re-running the script cannot duplicate periods.
    await rules.deleteMany({ clinicianId });
    await rules.insertMany(
      WEEKLY_SCHEDULE.map((rule) => ({
        clinicianId,
        dayOfWeek: rule.dayOfWeek,
        startMinutes: rule.startMinutes,
        endMinutes: rule.endMinutes,
        sessionType: rule.sessionType,
        active: true,
      })),
    );
    log(`  ${doctor.displayName}: verified, listed, weekly schedule set (${doctor.licenceNumber})`);
  }

  return { created, updated, skipped, password: options.password };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const force = args.has('--force');
  const reset = args.has('--reset');
  const isProduction = process.env.NODE_ENV === 'production';
  const password = process.env.SEED_PASSWORD?.trim() || DEFAULT_PASSWORD;

  console.log('Obiren account seed');
  console.log(`  database: ${process.env.MONGODB_URI ? redact(process.env.MONGODB_URI) : '(MONGODB_URI not set)'}`);
  console.log(`  NODE_ENV: ${process.env.NODE_ENV || '(unset)'}`);
  console.log(`  mode:     ${reset ? 'reset existing accounts' : 'create missing accounts only'}`);

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required. Run from apps/api so its .env is loaded, or export it.');
  }
  if (isProduction && !force) {
    throw new Error(
      'Refusing to seed accounts into a production database. Re-run with --force if this is the staging deployment.',
    );
  }

  const result = await seedAccounts({
    uri: process.env.MONGODB_URI,
    password,
    reset,
    log: (message) => console.log(message),
  });

  console.log('');
  console.log(`Created ${result.created.length}, updated ${result.updated.length}, skipped ${result.skipped.length}.`);
  console.log('');
  console.log('Sign in with (password shown once):');
  console.log(`  password: ${result.password}`);
  for (const account of ACCOUNTS) {
    const state = result.skipped.includes(account.email) ? 'existing password' : result.password;
    console.log(`  ${account.email.padEnd(26)} ${state.padEnd(18)} ${account.label}`);
  }
  console.log('');
  console.log('Surfaces:');
  console.log(`  admin console  ${process.env.ADMIN_APP_URL || 'https://admin.obiren.co'}/user`);
  console.log(`  doctor portal  ${process.env.DOCTOR_PORTAL_URL || 'https://doctors.obiren.co'}/doctor/login`);
  console.log('');
  console.log('These are development credentials. Change their passwords or delete the');
  console.log('accounts before the platform carries real user data.');
  console.log('Skipped accounts keep their existing password; pass --reset to overwrite it.');

  await mongoose.disconnect();
}

/** Reuse a registered model so the seed can run twice in one process (tests). */
function model(name: string, schema: mongoose.Schema): mongoose.Model<any> {
  return (mongoose.models[name] as mongoose.Model<any>) ?? mongoose.model(name, schema);
}

function redact(uri: string): string {
  return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:/@]+):[^@]*@/, '$1:***@');
}

if (require.main === module) {
  main().catch(async (error) => {
    console.error('Account seed failed:', error instanceof Error ? error.message : error);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });
}
