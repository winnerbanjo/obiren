import { z } from 'zod';

/**
 * Authoritative API request schemas for the Obiren API.
 * Strict: unknown keys are rejected; inputs are normalized server-side.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('Please provide a valid email address')
  .max(320);
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid identifier format');

// ---------------- Auth ----------------

export const RegisterSchema = z
  .object({
    email,
    password,
    firstName: z.string().trim().min(1, 'First name is required').max(80),
    lastName: z.string().trim().min(1, 'Last name is required').max(80),
    countryCode: z.enum(['NG', 'GH', 'GB', 'US']).default('NG'),
    preferredLanguage: z.string().min(2).max(8).default('en'),
  })
  .strict();

export const LoginSchema = z
  .object({
    email,
    password: z.string().min(1, 'Password is required').max(128),
    platform: z.enum(['web', 'ios', 'android']).default('web'),
  })
  .strict();

export const RefreshSchema = z.object({ refreshToken: z.string().min(20).max(256) }).strict();

export const LogoutSchema = RefreshSchema;

export const ForgotPasswordSchema = z.object({ email }).strict();

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(20).max(256),
    newPassword: password,
  })
  .strict();

export const VerifyEmailSchema = z.object({ token: z.string().min(20).max(256) }).strict();

// ---------------- Users / profile ----------------

export const UpdateProfileSchema = z
  .object({
    firstName: z.string().trim().max(80).optional(),
    lastName: z.string().trim().max(80).optional(),
    displayName: z.string().trim().max(120).optional(),
    dateOfBirth: isoDate.optional(),
    phoneNumber: z.string().trim().max(32).optional(),
    countryCode: z.enum(['NG', 'GH', 'GB', 'US']).optional(),
    timeZone: z.string().max(64).optional(),
    trackingGoal: z
      .enum(['CYCLE_TRACKING', 'PREGNANCY', 'FERTILITY', 'GENERAL_WELLNESS'])
      .optional(),
    preferredLanguage: z.string().min(2).max(8).optional(),
    onboardingStatus: z.enum(['PENDING', 'COMPLETED']).optional(),
  })
  .strict();

// ---------------- Cycles ----------------

export const StartPeriodSchema = z
  .object({ date: isoDate.optional() })
  .strict();

export const EndPeriodSchema = z
  .object({ date: isoDate.optional() })
  .strict();

export const DailyLogUpsertSchema = z
  .object({
    bleeding: z
      .object({
        level: z.enum(['none', 'spotting', 'light', 'medium', 'heavy']),
        clots: z.boolean().optional(),
      })
      .optional(),
    pain: z
      .object({
        level: z.number().int().min(0).max(10),
        locations: z.array(z.string().max(40)).max(12).optional(),
      })
      .optional(),
    moods: z.array(z.string().max(40)).max(20).default([]),
    symptoms: z.array(z.string().max(40)).max(30).default([]),
    notes: z.string().max(2000).optional(),
  })
  .strict();

export const DailyLogDateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date route parameter must be YYYY-MM-DD');

// ---------------- Pregnancy ----------------

export const CreatePregnancySchema = z
  .object({
    lastMenstrualPeriod: isoDate.optional(),
    estimatedDueDate: isoDate.optional(),
    calculationSource: z
      .enum(['last_menstrual_period', 'ultrasound', 'medical_professional', 'user_entered'])
      .default('last_menstrual_period'),
    multiplePregnancy: z.boolean().default(false),
  })
  .strict()
  .refine(
    (v) => Boolean(v.lastMenstrualPeriod || v.estimatedDueDate),
    'Provide lastMenstrualPeriod or estimatedDueDate',
  );

export const EndPregnancySchema = z
  .object({
    reason: z.enum(['completed', 'loss', 'terminated', 'archived']),
  })
  .strict();

export const PregnancySymptomLogSchema = z
  .object({
    symptoms: z.array(z.string().min(1).max(60)).max(20).default([]),
    notes: z.string().max(2000).optional(),
    fetalMovement: z.enum(['normal', 'reduced', 'absent', 'not_assessed']).default('not_assessed'),
  })
  .strict();

export const MongoIdParam = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid identifier format');

// ---------------- Safety / SOS ----------------

export const TriggerSosSchema = z
  .object({
    isTestMode: z.boolean().default(false),
    gps: z.string().max(120).optional(),
    notes: z.string().max(1000).optional(),
  })
  .strict();

export const CancelSosSchema = z
  .object({
    pin: z.string().regex(/^\d{4,8}$/, 'Safety PIN must be 4-8 digits'),
  })
  .strict();

export const SetSafetyPinSchema = z
  .object({
    pin: z.string().regex(/^\d{4,8}$/, 'Safety PIN must be 4-8 digits'),
    currentPin: z.string().regex(/^\d{4,8}$/).optional(),
  })
  .strict();

export const ChangeSafetyPinSchema = z
  .object({
    currentPin: z.string().regex(/^\d{4,8}$/, 'Safety PIN must be 4-8 digits'),
    newPin: z.string().regex(/^\d{4,8}$/, 'Safety PIN must be 4-8 digits'),
  })
  .strict();

// ---------------- Health Vault ----------------

export const SaveVaultDocumentSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    documentType: z
      .enum([
        'laboratory_result',
        'prescription',
        'ultrasound',
        'scan',
        'referral',
        'vaccination',
        'medical_note',
        'other',
      ])
      .default('medical_note'),
    cloudinaryPublicId: z.string().trim().min(1).max(300),
    accessLevel: z.enum(['private', 'shared_with_trusted_circle', 'shared_with_professional']).default('private'),
    dateOfRecord: isoDate.optional(),
    healthcareProviderName: z.string().trim().max(160).optional(),
    tags: z.array(z.string().trim().max(40)).max(20).default([]),
  })
  .strict();

export const VaultDocumentIdParam = MongoIdParam;

// ---------------- Directory ----------------

export const DirectorySearchSchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    countryCode: z.enum(['NG', 'GH', 'GB', 'US', 'ALL']).optional(),
    category: z.string().trim().max(60).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const DirectoryNearbySchema = z
  .object({
    lng: z.coerce.number().min(-180).max(180),
    lat: z.coerce.number().min(-90).max(90),
    maxDistanceMeters: z.coerce.number().int().min(100).max(200000).default(50000),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

// ---------------- Notifications ----------------

export const QueueNotificationSchema = z
  .object({
    userId: objectId.optional(),
    recipient: z.object({ phoneNumber: z.string().min(5).max(32) }).strict(),
    type: z.enum(['HEALTH_REMINDER', 'APPOINTMENT', 'SOS_ALERT', 'SYSTEM']).default('HEALTH_REMINDER'),
    category: z.enum(['REMINDER', 'SUPPORT', 'SAFETY', 'SYSTEM']).default('REMINDER'),
    channel: z.enum(['whatsapp', 'sms', 'email', 'push']).default('whatsapp'),
    templateKey: z.string().max(80).default('reminder_default'),
    templateData: z.record(z.string(), z.string().max(500)).default({}),
    scheduledFor: z.coerce.date().optional(),
    idempotencyKey: z.string().min(8).max(120).optional(),
  })
  .strict();

// ---------------- Admin ----------------

export const AdminLoginSchema = z
  .object({
    email,
    password: z.string().min(1).max(128),
  })
  .strict();

export const DirectoryUpsertSchema = z
  .object({
    record_id: z.string().trim().min(1).max(40),
    organisation_name: z.string().trim().min(1).max(200),
    top_category: z.string().trim().min(1).max(80),
    service_summary: z.string().max(1000).default(''),
    countryCode: z.enum(['NG', 'GH', 'GB', 'US']),
    city: z.string().max(80).default(''),
    phone: z.string().max(60).default(''),
    verification_status: z.string().max(40).default('Pending'),
  })
  .strict();

export const UserStatusSchema = z
  .object({
    status: z.enum(['active', 'restricted', 'suspended', 'deleted']),
  })
  .strict();

// ---------------- Waitlist ----------------

export const WaitlistSignupSchema = z
  .object({
    email,
    firstName: z.string().trim().max(80).optional(),
    source: z.string().trim().max(60).default('web'),
    market: z.string().trim().max(60).optional(),
    referral: z.string().trim().max(120).optional(),
  })
  .strict();

export type RegisterInputDto = z.infer<typeof RegisterSchema>;
export type LoginInputDto = z.infer<typeof LoginSchema>;
export type StartPeriodInputDto = z.infer<typeof StartPeriodSchema>;
export type DailyLogUpsertInputDto = z.infer<typeof DailyLogUpsertSchema>;
export type CreatePregnancyInputDto = z.infer<typeof CreatePregnancySchema>;
export type TriggerSosInputDto = z.infer<typeof TriggerSosSchema>;
export type CancelSosInputDto = z.infer<typeof CancelSosSchema>;
export type SaveVaultDocumentInputDto = z.infer<typeof SaveVaultDocumentSchema>;
export type WaitlistSignupInputDto = z.infer<typeof WaitlistSignupSchema>;
