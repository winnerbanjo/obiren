// Obiren Domain Types & Interfaces

export type UserRole =
  | "USER"
  | "TRUSTED_CONTACT"
  | "HEALTHCARE_PROFESSIONAL"
  | "SUPPORT_AGENT"
  | "CONTENT_MANAGER"
  | "MEDICAL_REVIEWER"
  | "EMERGENCY_MANAGER"
  | "ADMIN"
  | "SUPER_ADMIN";

export type CountryCode = "NG" | "GH" | "GB" | "US";

export interface User {
  id: string;
  email: string;
  phone?: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  status: "ACTIVE" | "SUSPENDED" | "PENDING_DELETION";
  twoFactorEnabled: boolean;
  roles: UserRole[];
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  countryCode: CountryCode;
  state?: string;
  city?: string;
  preferredLanguage: string;
  bloodGroup?: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
  heightCm?: number;
  weightKg?: number;
  goals: string[];
}

export interface Cycle {
  id: string;
  userId: string;
  periodStartDate: string; // YYYY-MM-DD
  periodEndDate?: string; // YYYY-MM-DD
  cycleLengthDays?: number;
  periodLengthDays?: number;
  isConfirmed: boolean;
  isExcludedFromPredictions: boolean;
  notes?: string;
  createdAt: string;
}

export type BleedingIntensity = "NONE" | "SPOTTING" | "LIGHT" | "MEDIUM" | "HEAVY";
export type PainLevel = "NONE" | "MILD" | "MODERATE" | "SEVERE";

export interface DailyHealthLog {
  id: string;
  userId: string;
  logDate: string; // YYYY-MM-DD
  bleedingIntensity: BleedingIntensity;
  painLevel: PainLevel;
  symptoms: string[];
  moods: string[];
  energyLevel?: number; // 1-5
  sleepQuality?: number; // 1-5
  basalTemperatureCelsius?: number;
  weightKg?: number;
  medicationsTaken?: Array<{ name: string; time: string }>;
  privateNote?: string;
  createdAt: string;
}

export interface CyclePrediction {
  userId: string;
  predictedStartDate: string;
  predictedEndDate: string;
  rangeStart: string;
  rangeEnd: string;
  estimatedFertileWindowStart?: string;
  estimatedFertileWindowEnd?: string;
  estimatedOvulationDate?: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  calculationVersion: string;
  explanationCode: "MODERATE_VARIATION" | "REGULAR_HISTORY" | "INSUFFICIENT_DATA";
  generatedAt: string;
}

export interface PregnancyProfile {
  id: string;
  userId: string;
  status: "ACTIVE" | "COMPLETED" | "PAUSED";
  calculationMethod: "LAST_MENSTRUAL_PERIOD" | "CONCEPTION_DATE" | "CLINICIAN_CONFIRMED";
  estimatedDueDate: string;
  clinicianConfirmedDueDate?: string;
  currentWeek: number;
  kickCounts?: Array<{ timestamp: string; count: number }>;
  contractionLogs?: Array<{ start: string; end: string; durationSeconds: number }>;
}

export interface TrustedContact {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  relationship: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "REMOVED";
  alertChannels: Array<"SMS" | "EMAIL" | "PUSH" | "WHATSAPP">;
  createdAt: string;
}

export interface EmergencyResource {
  id: string;
  name: string;
  category:
    | "HOSPITAL"
    | "AMBULANCE"
    | "POLICE"
    | "FIRE"
    | "WOMENS_SHELTER"
    | "DOMESTIC_VIOLENCE"
    | "SEXUAL_ASSAULT"
    | "MENTAL_HEALTH"
    | "PHARMACY";
  countryCode: CountryCode;
  state: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  phoneNumbers: string[];
  whatsAppNumber?: string;
  websiteUrl?: string;
  isOpen247: boolean;
  isVerified: boolean;
  lastVerifiedAt: string;
}

export interface HealthDocument {
  id: string;
  userId: string;
  category:
    | "PRESCRIPTION"
    | "LAB_RESULT"
    | "ULTRASOUND"
    | "VACCINATION"
    | "MEDICAL_LETTER"
    | "INSURANCE"
    | "OTHER";
  title: string;
  fileStorageKey: string;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    fields?: Record<string, string>;
    requestId?: string;
  };
  meta?: Record<string, any>;
}
