import { z } from "zod";

export const RegisterSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  countryCode: z.enum(["NG", "GH", "GB", "US"]),
  preferredLanguage: z.string().default("en"),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const DailyLogSchema = z.object({
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
  bleedingIntensity: z.enum(["NONE", "SPOTTING", "LIGHT", "MEDIUM", "HEAVY"]),
  painLevel: z.enum(["NONE", "MILD", "MODERATE", "SEVERE"]),
  symptoms: z.array(z.string()),
  moods: z.array(z.string()),
  energyLevel: z.number().min(1).max(5).optional(),
  sleepQuality: z.number().min(1).max(5).optional(),
  privateNote: z.string().max(1000).optional(),
});

export const TrustedContactInvitationSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(7, "Valid phone number required"),
  relationship: z.string().min(1, "Relationship is required"),
  alertChannels: z.array(z.enum(["SMS", "EMAIL", "PUSH", "WHATSAPP"])).min(1, "Select at least one alert channel"),
});

export const CycleRecordSchema = z.object({
  periodStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Valid start date required"),
  periodEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().optional(),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type DailyLogInput = z.infer<typeof DailyLogSchema>;
export type TrustedContactInvitationInput = z.infer<typeof TrustedContactInvitationSchema>;
export type CycleRecordInput = z.infer<typeof CycleRecordSchema>;
