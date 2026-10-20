import { z } from 'zod';

/**
 * Authoritative API request schemas for the Obiren API.
 * Strict: unknown keys are rejected; inputs are normalized server-side.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Date must be a valid calendar date');
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

export const OnboardingPatchSchema = z
  .object({
    step: z.number().int().min(1).max(8).optional(),
    objective: z.enum(['CYCLE_TRACKING', 'PREGNANCY', 'FERTILITY', 'GENERAL_WELLNESS']).optional(),
    lastMenstrualPeriod: isoDate.optional(),
    cycleLengthDays: z.number().int().min(20).max(45).optional(),
    bleedingDays: z.number().int().min(1).max(15).optional(),
    conditions: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    concerns: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
    notificationsEnabled: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one onboarding field');

export const RecordConsentSchema = z
  .object({
    purpose: z.enum([
      'terms_of_service_acknowledgement',
      'privacy_notice_acknowledgement',
      'health_data_processing',
      'care_communications',
      'health_sharing',
      'location_sharing',
      'marketing',
    ]),
    policyVersion: z.string().trim().min(1).max(40),
    granted: z.boolean(),
    source: z.enum(['onboarding', 'settings', 'feature_action']),
  })
  .strict();

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
  })
  .strict();

// ---------------- Cycles ----------------

export const StartPeriodSchema = z
  .object({ date: isoDate.optional() })
  .strict();

export const EndPeriodSchema = z
  .object({ date: isoDate.optional() })
  .strict();

export const UpdateCycleSchema = z
  .object({
    startDate: isoDate.optional(),
    endDate: isoDate.nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one cycle field to update');

export const CycleHistoryQuerySchema = z
  .object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    cursor: objectId.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
  .refine((value) => !value.from || !value.to || value.from <= value.to, 'from must be on or before to');

export const CycleIdParam = objectId;

const dailyLogBleedingSchema = z
  .object({
    level: z.enum(['none', 'spotting', 'light', 'medium', 'heavy']).optional(),
    clots: z.boolean().optional(),
  })
  .strict();
const dailyLogPainSchema = z
  .object({
    level: z.number().int().min(0).max(10).optional(),
    locations: z.array(z.string().max(40)).max(12).optional(),
  })
  .strict();
const dailyLogSexualActivitySchema = z
  .object({
    occurred: z.boolean().optional(),
    protection: z.string().max(40).optional(),
  })
  .strict();

export const DailyLogUpsertSchema = z
  .object({
    bleeding: z.object({ level: z.enum(['none', 'spotting', 'light', 'medium', 'heavy']), clots: z.boolean().optional() }).strict().optional().refine((value) => !value || Object.keys(value).length > 0),
    pain: z.object({ level: z.number().int().min(0).max(10), locations: z.array(z.string().max(40)).max(12).optional() }).strict().optional().refine((value) => !value || Object.keys(value).length > 0),
    sexualActivity: dailyLogSexualActivitySchema.refine((value) => !value || Object.keys(value).length > 0).optional(),
    moods: z.array(z.string().max(40)).max(20).default([]),
    symptoms: z.array(z.string().max(40)).max(30).default([]),
    notes: z.string().max(2000).optional(),
  })
  .strict();

export const DailyLogPatchSchema = z
  .object({
    version: z.number().int().min(1),
    bleeding: dailyLogBleedingSchema.refine((value) => Object.keys(value).length > 0).optional(),
    pain: dailyLogPainSchema.refine((value) => Object.keys(value).length > 0).optional(),
    moods: z.array(z.string().max(40)).max(20).optional(),
    symptoms: z.array(z.string().max(40)).max(30).optional(),
    sexualActivity: dailyLogSexualActivitySchema.refine((value) => Object.keys(value).length > 0).optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== 'version'), 'Provide at least one daily log field to update');

export const DailyLogVersionQuerySchema = z.object({ version: z.coerce.number().int().min(1) }).strict();

export const DailyLogDateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date route parameter must be YYYY-MM-DD');

// ---------------- Pregnancy ----------------

const pregnancyDateSource = z.enum(['last_menstrual_period', 'ultrasound', 'medical_professional', 'user_entered']);

export const CreatePregnancySchema = z
  .object({
    lastMenstrualPeriod: isoDate.optional(),
    estimatedDueDate: isoDate.optional(),
    calculationSource: pregnancyDateSource.optional(),
    dateConfidence: z.enum(['certain', 'approximate', 'unknown']).default('approximate'),
    multiplePregnancy: z.boolean().default(false),
  })
  .strict()
  .refine(
    (v) => Boolean(v.lastMenstrualPeriod || v.estimatedDueDate),
    'Provide lastMenstrualPeriod or estimatedDueDate',
  )
  .refine(
    (v) => v.calculationSource !== 'last_menstrual_period' || Boolean(v.lastMenstrualPeriod),
    'lastMenstrualPeriod is required when calculationSource is last_menstrual_period',
  )
  .refine(
    (v) => !v.calculationSource || v.calculationSource === 'last_menstrual_period' || Boolean(v.estimatedDueDate),
    'estimatedDueDate is required for a non-LMP calculation source',
  );

export const UpdatePregnancySchema = z
  .object({
    lastMenstrualPeriod: isoDate.nullable().optional(),
    estimatedDueDate: isoDate.optional(),
    calculationSource: pregnancyDateSource.optional(),
    dateConfidence: z.enum(['certain', 'approximate', 'unknown']).optional(),
    multiplePregnancy: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one pregnancy field to update')
  .refine(
    (v) => v.calculationSource !== 'last_menstrual_period' || (v.lastMenstrualPeriod !== undefined && v.lastMenstrualPeriod !== null),
    'A lastMenstrualPeriod date is required when switching to LMP dating',
  )
  .refine(
    (v) => !v.calculationSource || v.calculationSource === 'last_menstrual_period' || Boolean(v.estimatedDueDate),
    'estimatedDueDate is required for a non-LMP calculation source',
  )
  .refine(
    (v) => v.calculationSource !== 'last_menstrual_period' || v.lastMenstrualPeriod !== null || Boolean(v.estimatedDueDate),
    'estimatedDueDate is required when clearing LMP-based dating',
  );

export const PregnancyLogSchema = z
  .object({
    nausea: z.enum(['none', 'mild', 'moderate', 'severe']).optional(),
    symptoms: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
    mood: z.string().trim().max(40).optional(),
    energy: z.string().trim().max(40).optional(),
    water: z.number().int().min(0).max(30).optional(),
    vitamins: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
    nutrition: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
    selfCare: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
    fetalMovement: z.enum(['normal', 'reduced', 'absent', 'not_assessed']).default('not_assessed'),
    notes: z.string().max(2000).nullable().optional(),
  })
  .strict();

export const KickCountSchema = z
  .object({
    startedAt: z.string().datetime({ offset: true }),
    completedAt: z.string().datetime({ offset: true }),
    count: z.number().int().min(1).max(100),
  })
  .strict()
  .refine((v) => new Date(v.completedAt) > new Date(v.startedAt), 'completedAt must follow startedAt')
  .refine((v) => new Date(v.completedAt).getTime() - new Date(v.startedAt).getTime() <= 4 * 60 * 60 * 1000, 'Kick-count session cannot exceed four hours');

export const PregnancyHistoryQuerySchema = z
  .object({ cursor: objectId.optional(), limit: z.coerce.number().int().min(1).max(100).default(20) })
  .strict();

export const PregnancyLogDateParam = isoDate;

export const EndPregnancySchema = z
  .object({
    reason: z.enum(['completed', 'loss', 'terminated', 'archived']),
  })
  .strict();

export const PregnancyWellnessSchema = z
  .object({ water: z.number().int().min(0).max(30).optional(), vitamins: z.array(z.string().trim().min(1).max(60)).max(20).optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Provide water or vitamins');



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
export type DailyLogPatchInputDto = z.infer<typeof DailyLogPatchSchema>;
export type CreatePregnancyInputDto = z.infer<typeof CreatePregnancySchema>;
export type TriggerSosInputDto = z.infer<typeof TriggerSosSchema>;
export type CancelSosInputDto = z.infer<typeof CancelSosSchema>;
export type SaveVaultDocumentInputDto = z.infer<typeof SaveVaultDocumentSchema>;
export type WaitlistSignupInputDto = z.infer<typeof WaitlistSignupSchema>;
