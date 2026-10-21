/**
 * Obiren shared API client.
 *
 * - Access token lives in memory only (15-minute TTL).
 * - Refresh token lives in an HTTP-only cookie set by the API; on boot and
 *   on 401 we call /auth/refresh to obtain a fresh access token.
 * - No passwords, refresh tokens, or privileged state in localStorage.
 */

/** PRD envelope: { data, meta?, requestId } | { error, requestId }. */
export interface ApiEnvelope<T> {
  data?: T;
  meta?: Record<string, any>;
  requestId?: string;
  error?: {
    code?: string;
    message?: string;
    details?: { fields?: Record<string, string>; issues?: unknown[] } | unknown;
    /** Legacy pre-v1 field; retained for tolerated responses. */
    fields?: Record<string, string>;
  };
  /** Legacy field from older API builds; not part of the PRD contract. */
  success?: boolean;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  fields?: Record<string, string>;
  constructor(status: number, code: string | undefined, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

// Same-origin by default: both Next apps proxy /api/v1 to the API via
// next.config.ts rewrites. Set NEXT_PUBLIC_API_URL to target the API directly.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

async function rawRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  opts: { auth?: boolean; retryOn401?: boolean; idempotencyKey?: string } = { auth: true, retryOn401: true },
): Promise<ApiEnvelope<T>> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  // A retry after a 401 reuses the same key so a transactional POST is not repeated.
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: 'include', // send/receive the HTTP-only refresh cookie
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let json: ApiEnvelope<T> | null = null;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    // Non-JSON response (e.g. HTML error page from a proxy)
  }

  if (res.status === 401 && opts.retryOn401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return rawRequest<T>(method, path, body, { ...opts, retryOn401: false });
    }
  }

  if (!res.ok) {
    const details = json?.error?.details as { fields?: Record<string, string> } | undefined;
    throw new ApiError(
      res.status,
      json?.error?.code || (res.status === 401 ? 'AUTH_REQUIRED' : 'REQUEST_FAILED'),
      json?.error?.message || `Request failed (${res.status})`,
      details?.fields ?? json?.error?.fields,
    );
  }

  return json ?? {};
}

/** Attempt one refresh round-trip. Concurrent callers share the promise. */
export async function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) return false;
      const json = (await res.json()) as ApiEnvelope<{ accessToken: string }>;
      if (json?.data?.accessToken) {
        accessToken = json.data.accessToken;
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts?: { idempotencyKey?: string },
): Promise<T> {
  const envelope = await rawRequest<T>(method, path, body, { auth: true, retryOn401: true, ...opts });
  return envelope.data as T;
}

/** Client-side idempotency key for transactional POSTs (holds, checkouts). */
export function newIdempotencyKey(prefix = 'web'): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}-${random}`;
}

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  status: string;
  countryCode: string;
  emailVerified: boolean;
  profile?: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    trackingGoal?: string;
    onboardingStatus?: string;
  } | null;
}

export interface LoginResult {
  user: AuthUser;
  tokens: { accessToken: string; refreshToken?: string };
}

export const authApi = {
  async register(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    countryCode?: string;
  }) {
    const data = await request<{
      userId: string;
      email: string;
      status: string;
      verificationToken?: string;
      message: string;
    }>('POST', '/auth/register', input);
    // Keep the access token out of localStorage entirely.
    return data;
  },

  async login(email: string, password: string) {
    const data = await request<LoginResult>('POST', '/auth/login', { email, password, platform: 'web' });
    setAccessToken(data.tokens.accessToken);
    return data;
  },

  async logout() {
    try {
      await rawRequest('POST', '/auth/logout', {}, { auth: true, retryOn401: false });
    } finally {
      setAccessToken(null);
    }
  },

  /** Restore a session from the HTTP-only refresh cookie. Returns null if none. */
  async restore(): Promise<AuthUser | null> {
    const ok = await tryRefresh();
    if (!ok) return null;
    try {
      return await request<AuthUser>('GET', '/auth/me');
    } catch {
      setAccessToken(null);
      return null;
    }
  },

  async me(): Promise<AuthUser> {
    return request<AuthUser>('GET', '/auth/me');
  },

  async verifyEmail(token: string) {
    return request<{ email: string; status: string; emailVerified: boolean }>('POST', '/auth/verify-email', { token });
  },

  async resendVerification(email: string) {
    return request<{ message: string }>('POST', `/auth/resend-verification?email=${encodeURIComponent(email)}`, {});
  },

  async forgotPassword(email: string) {
    return request<{ message: string }>('POST', '/auth/forgot-password', { email });
  },

  async resetPassword(token: string, newPassword: string) {
    return request<{ message: string }>('POST', '/auth/reset-password', { token, newPassword });
  },
};

// ---------------------------------------------------------------------------
// Users / profile API
// ---------------------------------------------------------------------------

export interface UserProfileData {
  userId: string;
  email: string;
  countryCode: string;
  status: string;
  roles: string[];
  firstName: string;
  lastName: string;
  displayName: string;
  trackingGoal: string;
  onboardingStatus: string;
}

export interface PrivacyJobData {
  _id?: string;
  id?: string;
  type: 'export' | 'deletion';
  status: string;
  requestedAt: string;
  availableAt?: string;
  completedAt?: string;
}

export const usersApi = {
  getProfile: () => request<UserProfileData>('GET', '/users/me'),
  updateProfile: (updates: Record<string, unknown>) => request<UserProfileData>('PATCH', '/users/me', updates),
  exportData: () => request<Record<string, unknown>>('GET', '/users/me/export'),
  getPrivacyJobs: () => request<PrivacyJobData[]>('GET', '/users/me/privacy-jobs'),
  requestDeletion: () => request<{ jobId: string; deletionScheduledFor: string; erasureCompleted: false }>('POST', '/users/me/request-deletion', {}),
  cancelDeletion: () => request<Record<string, unknown>>('POST', '/users/me/cancel-deletion', {}),
};

// ---------------------------------------------------------------------------
// Communications API (inbox, preferences, health sharing)
// ---------------------------------------------------------------------------

export interface NotificationPreferenceData {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  discreetMode: boolean;
  disabledCategories: string[];
}

export interface InboxNotification {
  id: string;
  category: string;
  status: string;
  createdAt?: string;
  title: string;
  body: string;
}

export interface HealthShareData {
  id: string;
  ownerUserId?: string;
  scopes: Array<'cycles' | 'daily_logs' | 'pregnancy'>;
  evidenceFrom: string;
  evidenceTo: string;
  expiresAt: string;
  status?: string;
  data?: { cycles?: CycleData[]; logs?: DailyLogData[]; pregnancies?: PregnancyData[]; disclaimer?: string };
}

export const communicationsApi = {
  getInbox: (query: { cursor?: string; limit?: number } = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
    const suffix = params.size ? `?${params.toString()}` : '';
    return request<{ notifications: InboxNotification[]; nextCursor: string | null }>('GET', `/notifications${suffix}`);
  },
  markRead: (id: string) => request<{ id: string; status: string }>('PATCH', `/notifications/${id}/read`, {}),
  getPreferences: () => request<NotificationPreferenceData>('GET', '/notification-preferences'),
  updatePreferences: (updates: Partial<NotificationPreferenceData>) => request<NotificationPreferenceData>('PATCH', '/notification-preferences', updates),
};

export const healthSharesApi = {
  create: (input: { recipientUserId: string; scopes: HealthShareData['scopes']; from: string; to: string; expiresAt: string }) =>
    request<HealthShareData>('POST', '/health-shares', input),
  getReceived: () => request<HealthShareData[]>('GET', '/health-shares/received'),
  revoke: (id: string) => request<{ id: string; status: string }>('DELETE', `/health-shares/${id}`),
};

// ---------------------------------------------------------------------------
// Consultations API (participant-scoped, encrypted messages)
// ---------------------------------------------------------------------------

export interface ConsultationData {
  id: string;
  role: 'patient' | 'clinician';
  status: 'open' | 'closed';
  lastMessageAt?: string;
  closedAt?: string | null;
  createdAt?: string;
}

export interface ConsultationMessage {
  id: string;
  consultationId: string;
  senderUserId: string;
  body: string;
  status: 'sent' | 'delivered' | 'read';
  deliveredAt?: string | null;
  readAt?: string | null;
  createdAt?: string;
  isOwnMessage?: boolean;
}

export const consultationsApi = {
  list: (query: { cursor?: string; limit?: number } = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
    const suffix = params.size ? `?${params.toString()}` : '';
    return request<{ consultations: ConsultationData[]; nextCursor: string | null }>('GET', `/consultations${suffix}`);
  },
  getMessages: (id: string, query: { cursor?: string; limit?: number } = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
    const suffix = params.size ? `?${params.toString()}` : '';
    return request<{ consultationId: string; messages: ConsultationMessage[]; nextCursor: string | null }>(
      'GET',
      `/consultations/${id}/messages${suffix}`,
    );
  },
  sendMessage: (id: string, body: string) =>
    request<ConsultationMessage>('POST', `/consultations/${id}/messages`, { body }),
  acknowledge: (id: string) =>
    request<{ consultationId: string; markedRead: number }>('POST', `/consultations/${id}/read`, {}),
};

// ---------------------------------------------------------------------------
// Notification devices API
// ---------------------------------------------------------------------------

export interface DeviceData {
  id: string;
  platform: 'ios' | 'android' | 'web';
  deviceName?: string | null;
  status: 'active' | 'revoked';
  lastSeenAt?: string;
  createdAt?: string;
}

export const devicesApi = {
  list: () => request<DeviceData[]>('GET', '/devices'),
  register: (input: { platform: DeviceData['platform']; token: string; deviceName?: string }) =>
    request<DeviceData>('POST', '/devices', input),
  revoke: (id: string) => request<{ id: string; status: string }>('DELETE', `/devices/${id}`),
};

// ---------------------------------------------------------------------------
// Home API
// ---------------------------------------------------------------------------

export interface HomeSummary {
  cycle: CycleData | null;
  pregnancy: PregnancyData | null;
  recentLogs: DailyLogData[];
  date?: string;
  timeZone?: string;
  todayLog?: DailyLogData | null;
  pulse?: { date: string; cycleDay: number | null; loggedToday: boolean; loggedDayStreak: number; lastLoggedDate: string | null };
  cards?: Array<{ id: string; type: string; title: string; body: string; action: { method: string; path: string } }>;
  insights?: Array<{ code: string; message: string }>;
  disclaimer?: string;
}

export const homeApi = {
  /** `date` is a local YYYY-MM-DD calendar date; defaults to today in the account timezone. */
  getSummary: (date?: string) => request<HomeSummary>('GET', date ? `/home?date=${encodeURIComponent(date)}` : '/home'),
  getCalendarLogs: (from: string, to: string) => {
    const params = new URLSearchParams({ from, to });
    return request<{ from: string; to: string; logs: DailyLogData[]; summary?: { loggedDayCount: number; periodDayCount: number; spanDays: number } }>(
      'GET',
      `/daily-logs?${params.toString()}`,
    );
  },
};

// ---------------------------------------------------------------------------
// Cycles API
// ---------------------------------------------------------------------------

export interface CycleData {
  id?: string;
  _id?: string;
  startedAt?: string;
  periodEndedAt?: string;
  endedAt?: string;
  periodLength?: number;
  cycleLength?: number;
  notes?: string;
  dayOfCycle?: number;
  timeZone?: string;
  status?: string;
  prediction?: {
    predictedStartDate: string;
    predictedEndDate: string;
    rangeStart?: string;
    rangeEnd?: string;
    periodPrediction?: { startDate: string; rangeStart: string; rangeEnd: string };
    fertileWindow?: { startDate?: string; endDate?: string };
    estimatedOvulationDate?: string;
    ovulationEstimate?: string;
    estimatedFertileWindowStart?: string;
    estimatedFertileWindowEnd?: string;
    confidence: 'LOW' | 'MEDIUM' | 'HIGH';
    explanationCode: string;
    calculationVersion?: string;
    isContraceptiveAdvice?: false;
  };
}

export interface CycleHistoryData {
  cycles: CycleData[];
  summary: {
    recordedCycleCount: number;
    usableIntervalCount: number;
    avgCycleLength: number | null;
    confidence: 'LOW' | 'PERSONALIZED';
    isContraceptiveAdvice: false;
  };
  nextCursor: string | null;
}

export interface DailyLogData {
  date: string;
  version?: number;
  /** Which tracking experience produced the entry. */
  mode?: 'cycle' | 'pregnancy' | 'postpartum' | 'general';
  bleeding?: { level: string; clots?: boolean };
  bloodColor?: 'pink' | 'light_red' | 'red' | 'dark_red' | 'brown' | null;
  pain?: { level: number; locations?: string[] };
  moods?: string[];
  symptoms?: string[];
  /** Self-reported energy, 1 (exhausted) to 5 (energetic). */
  energy?: number | null;
  cravings?: string[];
  sleep?: { hours?: number; quality?: 'poor' | 'fair' | 'good' | 'great' } | null;
  sexualActivity?: { occurred?: boolean; protection?: string };
  notes?: string;
  isPeriodDay?: boolean;
}

export interface PeriodData {
  id: string;
  startDate: string;
  endDate: string | null;
  periodLengthDays: number;
  cycleLengthDays: number | null;
  status: string;
  notes: string | null;
}

export const periodsApi = {
  list: (from: string, to: string) =>
    request<{ periods: PeriodData[]; summary: { recordedPeriodCount: number; averagePeriodLengthDays: number | null; averagePeriodLengthSampleSize: number; isContraceptiveAdvice: false } }>(
      'GET',
      `/periods?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
  create: (input: { startDate?: string; endDate?: string | null; notes?: string | null }) =>
    request<{ period: PeriodData; created: boolean }>('POST', '/periods', input),
  update: (id: string, updates: { startDate?: string; endDate?: string | null; notes?: string | null }) =>
    request<{ period: PeriodData }>('PATCH', `/periods/${id}`, updates),
};

export const cyclesApi = {
  getCurrent: () => request<CycleData | null>('GET', '/cycles/current'),
  getHistory: (query: { from?: string; to?: string; cursor?: string; limit?: number } = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
    const suffix = params.size ? `?${params.toString()}` : '';
    return request<CycleHistoryData>('GET', `/cycles/history${suffix}`);
  },
  getHistoryDetail: (id: string) => request<{ cycle: CycleData; dailyLogs: DailyLogData[]; flowPattern: Record<string, number> }>('GET', `/cycles/history/${id}`),
  update: (id: string, updates: { startDate?: string; endDate?: string | null; notes?: string | null }) => request<CycleData>('PATCH', `/cycles/${id}`, updates),
  startPeriod: (date?: string) => request<{ cycle: CycleData; prediction: CycleData['prediction'] }>('POST', '/cycles/start-period', date ? { date } : {}),
  endPeriod: (date?: string) => request<CycleData>('POST', '/cycles/end-period', date ? { date } : {}),
  getDailyLog: (date: string) => request<DailyLogData>('GET', `/daily-logs/${date}`),
  upsertDailyLog: (date: string, log: Partial<Omit<DailyLogData, 'version'>>) => request<DailyLogData>('PUT', `/daily-logs/${date}`, log),
  patchDailyLog: (date: string, version: number, updates: Partial<Omit<DailyLogData, 'date' | 'version'>>) =>
    request<DailyLogData>('PATCH', `/daily-logs/${date}`, { ...updates, version }),
  deleteDailyLog: (date: string, version: number) =>
    request<{ date: string; deleted: true }>('DELETE', `/daily-logs/${date}?version=${version}`),
};

// ---------------------------------------------------------------------------
// Pregnancy API
// ---------------------------------------------------------------------------

export interface PregnancyData {
  id: string;
  status: string;
  estimatedDueDate: string;
  lastMenstrualPeriod?: string;
  currentWeek?: number;
  currentDay?: number;
  currentTrimester?: 1 | 2 | 3 | null;
  daysUntilDueDate?: number;
  dateConfidence?: 'certain' | 'approximate' | 'unknown';
  babyMilestone?: { fruitSize: string; lengthCm: number; weightGrams: number };
  disclaimer?: string;
}

export const pregnancyApi = {
  getCurrent: () => request<PregnancyData | null>('GET', '/pregnancies/current'),
  /** PRD alias of `getCurrent`. */
  getActive: () => request<PregnancyData | null>('GET', '/pregnancies/active'),
  create: (input: { lastMenstrualPeriod?: string; estimatedDueDate?: string; calculationSource?: string; multiplePregnancy?: boolean }) =>
    request<PregnancyData>('POST', '/pregnancies', input),
  end: (id: string, reason: string) => request<PregnancyData>('POST', `/pregnancies/${id}/end`, { reason }),
  logSymptom: (id: string, date: string, payload: { symptoms?: string[]; notes?: string; fetalMovement?: string }) =>
    request<{ safetyNotice: unknown }>('PUT', `/pregnancies/${id}/logs/${date}`, payload),
  /** Date-keyed check-in for the caller's active pregnancy (no id needed). */
  getCheckIn: (date: string) => request<Record<string, unknown>>('GET', `/pregnancy-logs/${date}`),
  logCheckIn: (date: string, payload: { symptoms?: string[]; nausea?: string; water?: number; vitamins?: string[]; fetalMovement?: string; notes?: string | null }) =>
    request<{ safetyNotice: unknown }>('PUT', `/pregnancy-logs/${date}`, payload),
};

// ---------------------------------------------------------------------------
// Safety API
// ---------------------------------------------------------------------------

export interface GuardianContactData {
  _id?: string;
  name: string;
  phoneE164: string;
  status: 'pending' | 'verified' | 'revoked';
  scopes: string[];
  acceptedAt?: string;
  verifiedAt?: string;
}

export interface SosIncident {
  id?: string;
  _id?: string;
  status: string;
  isTestMode?: boolean;
  triggeredAt: string;
  cancelledAt?: string;
  gpsCoordinates?: string;
}

export const safetyApi = {
  pinStatus: () => request<{ hasSafetyPin: boolean; locked: boolean }>('GET', '/safety/pin/status'),
  setPin: (pin: string, currentPin?: string) =>
    request<{ message: string }>('POST', '/safety/pin', currentPin ? { pin, currentPin } : { pin }),
  changePin: (currentPin: string, newPin: string) =>
    request<{ message: string }>('POST', '/safety/pin/change', { currentPin, newPin }),
  triggerSos: (input: { isTestMode: boolean; gps?: string; notes?: string }) =>
    request<{ incident: SosIncident; message: string }>('POST', '/safety/sos/trigger', input),
  cancelSos: (pin: string) => request<SosIncident>('POST', '/safety/sos/cancel', { pin }),
  getIncidents: () => request<SosIncident[]>('GET', '/safety/incidents'),
  getGuardians: () => request<GuardianContactData[]>('GET', '/safety/guardians'),
  addGuardian: (input: { name: string; phoneE164: string; scopes: Array<'sos_alert' | 'check_in'> }) =>
    request<{ contact: GuardianContactData; status: string; invitationDelivery: string }>('POST', '/safety/guardians', input),
  revokeGuardian: (id: string) => request<{ id: string; status: string }>('DELETE', `/safety/guardians/${id}`),
  startLocationSession: (expiresAt: string) => request<{ sessionId: string; status: string; expiresAt: string }>('POST', '/safety/location-sessions', { expiresAt }),
  revokeLocationSession: (id: string) => request<{ sessionId: string; status: string }>('DELETE', `/safety/location-sessions/${id}`),
  getSosDeliveries: (incidentId: string) =>
    request<{
      incidentId: string;
      dispatchStatus: string;
      deliveryConfirmed: boolean;
      attempts: Array<{ id: string; channel: string; status: string; failureCode?: string; attemptedAt: string }>;
    }>('GET', `/safety/sos/${incidentId}/deliveries`),
};

// ---------------------------------------------------------------------------
// Care API (verified specialists, availability, temporary holds)
// ---------------------------------------------------------------------------

export interface ClinicianData {
  _id: string;
  displayName: string;
  specialties: string[];
  languages: string[];
  countryCode: string;
}

export interface AvailabilitySlotData {
  _id: string;
  clinicianId: string;
  startsAt: string;
  endsAt: string;
  sessionType: 'clinic' | 'audio' | 'video' | 'text';
  status: string;
  clinician?: ClinicianData;
}

export interface BookingHoldData {
  holdId: string;
  slotId: string;
  status: string;
  expiresAt: string;
  bookingEnabled: false;
  message: string;
}

export const careApi = {
  listClinicians: (query: { countryCode?: string; specialty?: string; language?: string } = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
    const suffix = params.size ? `?${params.toString()}` : '';
    return request<ClinicianData[]>('GET', `/care/clinicians${suffix}`);
  },
  listAvailability: (query: { from: string; to: string; countryCode?: string }) => {
    const params = new URLSearchParams({ from: query.from, to: query.to });
    if (query.countryCode) params.set('countryCode', query.countryCode);
    return request<AvailabilitySlotData[]>('GET', `/care/availability?${params.toString()}`);
  },
  holdSlot: (slotId: string) => request<BookingHoldData>('POST', '/care/holds', { slotId }),
  listHolds: () => request<Array<{ _id: string; slotId: string; status: string; expiresAt: string }>>('GET', '/care/holds'),
  cancelHold: (id: string) => request<{ holdId: string; status: string }>('DELETE', `/care/holds/${id}`),
};

// ---------------------------------------------------------------------------
// Specialists · bookings · payments
// ---------------------------------------------------------------------------

export type SessionType = 'clinic' | 'audio' | 'video' | 'text';

export interface SpecialistData {
  id: string;
  displayName: string;
  profession: string | null;
  bio: string | null;
  specialties: string[];
  languages: string[];
  certifications: string[];
  countryCode: string;
  currency: string;
  feeBySessionType: Partial<Record<SessionType, number>>;
  ratingAverage: number | null;
  ratingCount: number;
}

export interface SpecialistSlotData {
  id: string;
  startsAt: string;
  endsAt: string;
  sessionType: SessionType;
  available: boolean;
}

export const specialistsApi = {
  list: (query: { countryCode?: string; specialty?: string; language?: string; sessionType?: SessionType; cursor?: string; limit?: number } = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
    const suffix = params.size ? `?${params.toString()}` : '';
    return request<{ specialists: SpecialistData[]; nextCursor: string | null }>('GET', `/specialists${suffix}`);
  },
  get: (id: string) => request<SpecialistData>('GET', `/specialists/${id}`),
  slots: (id: string, query: { from: string; to: string; sessionType?: SessionType }) => {
    const params = new URLSearchParams({ from: query.from, to: query.to });
    if (query.sessionType) params.set('sessionType', query.sessionType);
    return request<{ specialist: SpecialistData; slots: SpecialistSlotData[] }>('GET', `/specialists/${id}/slots?${params.toString()}`);
  },
};

export interface BookingData {
  id: string;
  status: 'held' | 'pending_payment' | 'confirmed' | 'cancelled' | 'completed' | 'expired';
  sessionType: SessionType;
  clinicianId: string;
  slotId: string;
  startsAt: string;
  endsAt: string;
  timeZone?: string;
  amountMinor: number;
  currency: string;
  reference: string | null;
  expiresAt: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  refundStatus: 'none' | 'not_required' | 'pending_policy' | 'refunded';
  cancellationReason: string | null;
}

export interface PaymentData {
  id: string;
  bookingId: string;
  gateway: 'paystack';
  reference: string;
  status: 'initialized' | 'succeeded' | 'failed' | 'abandoned';
  amountMinor: number;
  currency: string;
  authorizationUrl: string | null;
  accessCode: string | null;
  verifiedAt: string | null;
  failureReason: string | null;
}

/**
 * Booking flow: hold a slot, start a provider checkout, then wait for the
 * provider-verified webhook. `status` only becomes `confirmed` server-side.
 */
export const bookingsApi = {
  list: (query: { cursor?: string; limit?: number; status?: BookingData['status'] } = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
    const suffix = params.size ? `?${params.toString()}` : '';
    return request<{ bookings: BookingData[]; nextCursor: string | null }>('GET', `/bookings${suffix}`);
  },
  hold: (slotId: string) =>
    request<{ booking: BookingData; holdExpiresAt: string; checkoutEnabled: boolean; message: string }>(
      'POST',
      '/bookings/hold',
      { slotId },
      { idempotencyKey: newIdempotencyKey('hold') },
    ),
  get: (id: string) => request<{ booking: BookingData; payment: PaymentData | null }>('GET', `/bookings/${id}`),
  startPayment: (id: string) =>
    request<{ payment: PaymentData; reuse: boolean; amountMinor: number; currency: string }>(
      'POST',
      `/bookings/${id}/payment-intent`,
      {},
      { idempotencyKey: newIdempotencyKey('intent') },
    ),
  cancel: (id: string, reason?: string) =>
    request<{ booking: BookingData; refund: { status: string; message: string } }>(
      'POST',
      `/bookings/${id}/cancel`,
      reason ? { reason } : {},
    ),
  getPayment: (paymentId: string) => request<PaymentData>('GET', `/payments/${paymentId}`),
  getReceipt: (bookingId: string) =>
    request<{
      receiptNo: string;
      bookingId: string;
      paymentId: string;
      reference: string;
      amountMinor: number;
      currency: string;
      sessionType: SessionType;
      startsAt: string;
      endsAt: string;
      paidAt: string;
      refundStatus: string;
      provider: string;
    }>('GET', `/receipts/${bookingId}`),
};

// ---------------------------------------------------------------------------
// Health Vault API
// ---------------------------------------------------------------------------

export interface VaultDocument {
  id?: string;
  _id?: string;
  title: string;
  documentType: string;
  accessLevel: string;
  status: string;
  createdAt?: string;
  dateOfRecord?: string;
  tags?: string[];
}

export const vaultApi = {
  getUploadIntent: () =>
    request<{ uploadUrl: string; apiKey: string; signature: string; timestamp: number; folder: string; publicId: string; paramsToSign: Record<string, unknown> }>(
      'POST',
      '/health-vault/upload-intent',
      {},
    ),
  getDocuments: () => request<VaultDocument[]>('GET', '/health-vault/documents'),
  saveDocument: (input: { title: string; documentType?: string; cloudinaryPublicId: string; accessLevel?: string; dateOfRecord?: string; tags?: string[] }) =>
    request<VaultDocument>('POST', '/health-vault/documents', input),
  getDownloadUrl: (id: string) => request<{ signedDownloadUrl: string; expiresInSeconds: number }>('GET', `/health-vault/documents/${id}`),
  deleteDocument: (id: string) => request<{ status: string }>('DELETE', `/health-vault/documents/${id}`),
};

/**
 * Upload a file directly to Cloudinary using a server-issued signature.
 * The API secret never touches the browser.
 */
export async function uploadVaultFile(file: File): Promise<{ publicId: string }> {
  const intent = await vaultApi.getUploadIntent();
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', intent.apiKey);
  form.append('timestamp', String(intent.timestamp));
  form.append('folder', intent.folder);
  form.append('public_id', intent.publicId);
  form.append('signature', intent.signature);

  const res = await fetch(intent.uploadUrl, { method: 'POST', body: form });
  if (!res.ok) {
    throw new ApiError(res.status, 'VAULT_UPLOAD_FAILED', 'Document upload failed. Please try again.');
  }
  const json = await res.json();
  return { publicId: json.public_id as string };
}

// ---------------------------------------------------------------------------
// Directory API
// ---------------------------------------------------------------------------

export interface DirectoryRecord {
  record_id: string;
  organisation_name: string;
  top_category: string;
  service_summary: string;
  countryCode: string;
  city?: string;
  phone?: string;
  whatsapp_or_text?: string;
  hours?: string;
  cost?: string;
  verification_status?: string;
  distanceKm?: number;
}

export const directoryApi = {
  search: (params: { q?: string; countryCode?: string; category?: string; page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    const query = qs.toString();
    return request<DirectoryRecord[]>('GET', `/directory/search${query ? `?${query}` : ''}`);
  },
  nearby: (lng: number, lat: number, maxDistanceMeters = 50000) =>
    request<DirectoryRecord[]>('GET', `/directory/nearby?lng=${lng}&lat=${lat}&maxDistanceMeters=${maxDistanceMeters}`),
};

// ---------------------------------------------------------------------------
// Waitlist API
// ---------------------------------------------------------------------------

export const waitlistApi = {
  join: (input: { email: string; firstName?: string; source?: string; market?: string; referral?: string }) =>
    request<{ message: string; position: number; alreadyJoined: boolean }>('POST', '/waitlist', input),
  stats: () => request<{ total: number }>('GET', '/waitlist'),
};

// ---------------------------------------------------------------------------
// Admin API
// ---------------------------------------------------------------------------

export const adminApi = {
  metrics: () => request<{ totalUsers: number; activePregnancies: number; verifiedEmergencyResources: number; countryBreakdown: Record<string, { users: number }> }>('GET', '/admin/metrics'),
  listUsers: (page = 1, limit = 20) => request<{ users: any[]; total: number; page: number; limit: number }>('GET', `/admin/users?page=${page}&limit=${limit}`),
  setUserStatus: (id: string, status: string) => request<{ id: string; status: string }>('PUT', `/admin/users/${id}/status`, { status }),
  auditLogs: () => request<any[]>('GET', '/admin/audit-logs'),
  listClinicians: (query: { verificationStatus?: 'pending' | 'verified' | 'rejected'; page?: number; limit?: number } = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
    const suffix = params.size ? `?${params.toString()}` : '';
    return request<{ clinicians: any[]; total: number; page: number; limit: number }>('GET', `/admin/clinicians${suffix}`);
  },
  verifyClinician: (id: string, input: { verificationStatus: 'pending' | 'verified' | 'rejected'; evidenceRef?: string; note?: string; active?: boolean }) =>
    request<any>('PUT', `/admin/clinicians/${id}/verification`, input),
  createConsultation: (input: { patientUserId: string; clinicianId: string }) =>
    request<{ id: string; status: string; participantCount: number; bookingConfirmed: false; message: string }>('POST', '/admin/consultations', input),
};
