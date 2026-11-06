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
let currentUser: AuthUser | null = null;
let refreshInFlight: Promise<boolean> | null = null;

type SessionExpiredListener = (message: string) => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

/**
 * Subscribe to a definitive end of session: a 401 that survives the automatic
 * refresh attempt. Host apps use this to return to the sign-in screen once,
 * instead of leaving every screen showing the same authorization error.
 */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

function notifySessionExpired(message: string) {
  accessToken = null;
  currentUser = null;
  for (const listener of sessionExpiredListeners) {
    try {
      listener(message);
    } catch {
      // A broken listener must never mask the original API error.
    }
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (!token) currentUser = null;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * The identity from the last successful sign-in or `/auth/me`. Kept in memory
 * only, so a fresh page load still revalidates through the refresh cookie.
 * The Doctor Portal uses this to render its shell immediately after sign-in
 * instead of spending another round-trip asking for an identity it just got.
 */
export function getAuthUser(): AuthUser | null {
  return currentUser;
}

export function setAuthUser(user: AuthUser | null) {
  currentUser = user;
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
    const message = json?.error?.message || `Request failed (${res.status})`;
    // Auth endpoints handle their own 401s (bad credentials, expired refresh
    // token); every other protected call means the session is really gone.
    if (res.status === 401 && opts.auth !== false && !path.startsWith('/auth/')) {
      notifySessionExpired(message);
    }
    throw new ApiError(
      res.status,
      json?.error?.code || (res.status === 401 ? 'AUTH_REQUIRED' : 'REQUEST_FAILED'),
      message,
      details?.fields ?? json?.error?.fields,
    );
  }

  return json ?? {};
}

/**
 * Attempt one refresh round-trip. Concurrent callers share the promise.
 *
 * Returns false only when the session really is gone (no cookie / revoked).
 * Throttling and provider outages are thrown so the UI can show a retry state
 * instead of bouncing the user back to the sign-in screen as if their session
 * had expired.
 */
export async function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  const doRefresh = async (): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.status === 400 || res.status === 401) return false;

      let json: ApiEnvelope<{ accessToken: string }> | null = null;
      try {
        json = (await res.json()) as ApiEnvelope<{ accessToken: string }>;
      } catch {
        // Non-JSON error page (proxy/gateway).
      }

      if (!res.ok) {
        throw new ApiError(
          res.status,
          json?.error?.code || 'SESSION_REFRESH_FAILED',
          json?.error?.message || `Could not restore your session (${res.status}).`,
        );
      }

      if (json?.data?.accessToken) {
        accessToken = json.data.accessToken;
        return true;
      }
      return false;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.');
    }
  };

  refreshInFlight = (async () => {
    try {
      // The refresh token is a shared HttpOnly cookie. Two tabs refreshing at
      // once would submit the same token; the second would be treated as a
      // replay and the server would revoke the whole session family. The Web
      // Locks API serialises rotation across tabs so each request uses the
      // cookie left by the previous one. Browsers without it fall back to the
      // single-tab behaviour.
      const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
      return locks
        ? await locks.request('obiren-session-refresh', doRefresh)
        : await doRefresh();
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

/** Returned instead of tokens when the account has a second factor enabled. */
export interface MfaChallengeResult {
  mfaRequired: true;
  mfaToken: string;
  methods: string[];
  message: string;
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
    setAuthUser(data.user);
    return data;
  },

  /**
   * Sign in with a Google ID token obtained by the client SDK
   * (Google Identity Services on web, the Google Sign-In SDK on mobile).
   * The API verifies the token server-side; the client sends no profile data.
   */
  async googleSignIn(idToken: string): Promise<LoginResult | MfaChallengeResult> {
    const data = await request<LoginResult | MfaChallengeResult>('POST', '/auth/google', {
      idToken,
      platform: 'web',
    });
    // Never store a token for an MFA challenge; it has no session yet.
    if ('tokens' in data) {
      setAccessToken(data.tokens.accessToken);
      setAuthUser(data.user);
    }
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
      const user = await request<AuthUser>('GET', '/auth/me');
      setAuthUser(user);
      return user;
    } catch {
      setAccessToken(null);
      return null;
    }
  },

  async me(): Promise<AuthUser> {
    const user = await request<AuthUser>('GET', '/auth/me');
    setAuthUser(user);
    return user;
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

  /** Doctor invitation: set your own password and activate the account. */
  async activateDoctor(token: string, password: string) {
    return request<{ email: string; activated: boolean; message: string }>('POST', '/auth/activate-doctor', { token, password });
  },
};

// ---------------------------------------------------------------------------
// Doctor Portal API
// ---------------------------------------------------------------------------

export type AppointmentStatus =
  | 'held'
  | 'pending_payment'
  | 'pending'
  | 'confirmed'
  | 'reschedule_requested'
  | 'rejected'
  | 'cancelled'
  | 'completed'
  | 'no_show'
  | 'expired';

export interface DoctorPatient {
  displayName: string;
  phoneNumber: string | null;
}

export interface DoctorAppointment {
  id: string;
  reference: string;
  status: AppointmentStatus;
  statusLabel: string;
  sessionType: 'clinic' | 'audio' | 'video' | 'text';
  startsAt: string;
  endsAt: string;
  timeZone: string | null;
  durationMinutes: number;
  amountMinor: number;
  currency: string;
  paymentStatus: string | null;
  refundStatus: string;
  patient: DoctorPatient | null;
  patientNote: string | null;
  cancellationReason: string | null;
  rejectionReason: string | null;
  createdAt: string | null;
  /** The doctor's own Google Meet / Zoom / Teams room for this appointment. */
  meetingUrl: string | null;
  meetingUrlUpdatedAt: string | null;
  /** True while the appointment status still accepts a consultation link. */
  meetingLinkEditable: boolean;
  statusHistory: Array<{ from: string | null; to: string; actorRole: string; reason: string | null; at: string }>;
  actions: { confirm: boolean; reject: boolean; cancel: boolean; reschedule: boolean; complete: boolean; noShow: boolean };
}

export interface DoctorProfileData {
  id: string;
  userId: string;
  email: string | null;
  displayName: string;
  professionalTitle: string | null;
  profession: string | null;
  specialities: string[];
  specialties: string[];
  languages: string[];
  certifications: string[];
  licenceNumber: string | null;
  yearsOfExperience: number | null;
  bio: string | null;
  photoUrl: string | null;
  clinicName: string | null;
  clinicAddress: string | null;
  phoneNumber: string | null;
  countryCode: string;
  timeZone: string;
  consultationDurationMinutes: number;
  bufferMinutes: number;
  bookingApprovalMode: 'instant' | 'manual';
  verificationStatus: 'pending' | 'verified' | 'rejected';
  credentialReviewRequired: boolean;
  accountStatus: 'invited' | 'active' | 'inactive' | 'suspended';
  listed: boolean;
  feeBySessionType: Record<string, number>;
  emailVerified: boolean;
}

export interface DoctorScheduleRule {
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
  sessionType: 'clinic' | 'audio' | 'video' | 'text';
}

export interface DoctorDashboardData {
  doctor: { id: string; displayName: string; timeZone: string; accountStatus: string; listed: boolean };
  summary: { today: number; upcoming: number; pending: number; completed: number; total: number };
  today: { date: string; timeZone: string; appointments: DoctorAppointment[] };
  pendingRequests: DoctorAppointment[];
  upcoming: DoctorAppointment[];
  availability: {
    configuredDays: number[];
    weeklyGrid: Array<{ dayOfWeek: number; label: string; timeZone: string; slots: Array<{ startMinutes: number; endMinutes: number; startTime: string; endTime: string; sessionType: string; capacity: number }> }>;
    nextAvailableAt: string | null;
    slotGenerationHorizonDays: number;
  };
  recentActivity: Array<{ bookingId: string; from: string | null; to: string; actorRole: string; reason: string | null; at: string }>;
}

export interface DoctorScheduleData {
  timeZone: string;
  consultationDurationMinutes: number;
  bufferMinutes: number;
  bookingApprovalMode: 'instant' | 'manual';
  rules: Array<{ id: string; dayOfWeek: number; startMinutes: number; endMinutes: number; sessionType: DoctorScheduleRule['sessionType'] }>;
  weeklyGrid: DoctorDashboardData['availability']['weeklyGrid'];
  timeOff: Array<{ id: string; startsAt: string; endsAt: string; reason: string | null }>;
  leadTimeMinutes: number;
  slotGenerationHorizonDays: number;
}

export interface DoctorNotificationData {
  id: string;
  type: string;
  title: string;
  body: string;
  deepLink: string | null;
  objectId: string | null;
  readAt: string | null;
  createdAt: string;
}

function queryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const suffix = search.toString();
  return suffix ? `?${suffix}` : '';
}

export const doctorApi = {
  me: () => request<DoctorProfileData>('GET', '/clinician/me'),
  updateMe: (input: Record<string, unknown>) =>
    request<{ profile: DoctorProfileData; credentialReviewTriggered: boolean; message: string }>('PATCH', '/clinician/me', input),
  dashboard: () => request<DoctorDashboardData>('GET', '/clinician/dashboard'),
  listAppointments: (query: { status?: string; from?: string; to?: string; sessionType?: string; q?: string; cursor?: string; limit?: number } = {}) =>
    request<{ appointments: DoctorAppointment[]; nextCursor: string | null }>('GET', `/clinician/bookings${queryString(query)}`),
  getAppointment: (id: string) => request<DoctorAppointment>('GET', `/clinician/bookings/${id}`),
  /** Store or clear the doctor's own room link (null removes it). */
  setMeetingLink: (id: string, url: string | null) =>
    request<DoctorAppointment>('PATCH', `/clinician/bookings/${id}/meeting-link`, { url }),
  confirm: (id: string) => request<DoctorAppointment>('POST', `/clinician/bookings/${id}/confirm`, {}),
  reject: (id: string, reason: string) => request<DoctorAppointment>('POST', `/clinician/bookings/${id}/reject`, { reason }),
  cancel: (id: string, reason: string) => request<DoctorAppointment>('POST', `/clinician/bookings/${id}/cancel`, { reason }),
  complete: (id: string) => request<{ appointment: DoctorAppointment; paymentChanged: boolean }>('POST', `/clinician/bookings/${id}/complete`, {}),
  noShow: (id: string, reason?: string) => request<DoctorAppointment>('POST', `/clinician/bookings/${id}/no-show`, { reason }),
  reschedule: (id: string, slotId: string, reason?: string) =>
    request<DoctorAppointment>('POST', `/clinician/bookings/${id}/reschedule`, { slotId, reason }),
  schedule: () => request<DoctorScheduleData>('GET', '/clinician/schedule'),
  saveSchedule: (input: {
    timeZone: string;
    consultationDurationMinutes: number;
    bufferMinutes: number;
    rules: DoctorScheduleRule[];
  }) =>
    request<{ timeZone: string; consultationDurationMinutes: number; bufferMinutes: number; ruleCount: number; slotsGenerated: number; weeklyGrid: DoctorScheduleData['weeklyGrid'] }>(
      'PATCH',
      '/clinician/schedule',
      input,
    ),
  previewSchedule: (days = 14) =>
    request<{ timeZone: string; from: string; to: string; slots: Array<{ id: string; startsAt: string; endsAt: string; sessionType: string }> }>(
      'GET',
      `/clinician/schedule/preview?days=${days}`,
    ),
  timeOff: () => request<{ timeOff: Array<{ id: string; startsAt: string; endsAt: string; reason: string | null }> }>('GET', '/clinician/time-off'),
  createTimeOff: (input: { startsAt: string; endsAt: string; reason?: string }) =>
    request<{
      timeOff: { id: string; startsAt: string; endsAt: string; reason: string | null };
      affectedAppointments: Array<{ id: string; startsAt: string; endsAt: string; status: string; patient: DoctorPatient | null }>;
      message: string;
    }>('POST', '/clinician/time-off', input),
  deleteTimeOff: (id: string) => request<{ id: string; deleted: boolean }>('DELETE', `/clinician/time-off/${id}`),
  notifications: (query: { cursor?: string; limit?: number } = {}) =>
    request<{ notifications: DoctorNotificationData[]; unreadCount: number; nextCursor: string | null }>(
      'GET',
      `/clinician/notifications${queryString(query)}`,
    ),
  markNotificationRead: (id: string) => request<{ id: string; readAt: string }>('POST', `/clinician/notifications/${id}/read`, {}),
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
  getProfile: () => request<UserProfileData>('GET', '/me'),
  updateProfile: (updates: Record<string, unknown>) => request<UserProfileData>('PATCH', '/me', updates),
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
  getCurrent: () => request<PregnancyData | null>('GET', '/pregnancies/active'),
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

export type EmergencyResourceFreshness = 'current' | 'due_soon' | 'overdue' | 'unreviewed';
export type EmergencyVerificationStatus =
  | 'source_verified'
  | 'directory_source_verified'
  | 'operationally_confirmed'
  | 'unverified';

export interface EmergencyResourceData {
  recordId: string;
  organisationName: string;
  category: string;
  serviceCategory: string;
  country: string;
  countryCode: string;
  region: string;
  city: string;
  phone: string;
  whatsappOrText: string;
  email: string;
  serviceSummary: string;
  hours: string;
  cost: string;
  organisationType: string;
  sourceUrl: string;
  verification: {
    status: EmergencyVerificationStatus;
    baselineStatus: EmergencyVerificationStatus;
    operationallyConfirmed: boolean;
    operationalConfirmationRequired: boolean;
    lastCheckedAt: string | null;
    nextReviewDueAt: string | null;
    freshness: EmergencyResourceFreshness;
  };
}

export interface EmergencyResourceSet {
  countryCode: string;
  country: string;
  datasetVersion: string;
  emergencyNumbers: { medical: string; police: string; fire: string; domesticViolence?: string };
  disclaimer: string;
  dispatchSupported: false;
  reviewPolicy: { intervalDays: number; dueSoonDays: number; note: string };
  resources: EmergencyResourceData[];
}

export const safetyApi = {
  resources: (params: { countryCode?: string; category?: string; q?: string; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
    });
    const query = qs.toString();
    return request<EmergencyResourceSet>('GET', `/safety/resources${query ? `?${query}` : ''}`);
  },
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
  /** Deprecated: use `getSosEvent`. */
  getSosDeliveries: (incidentId: string) =>
    request<{
      incidentId: string;
      dispatchStatus: string;
      deliveryConfirmed: boolean;
      attempts: Array<{ id: string; channel: string; status: string; failureCode?: string; attemptedAt: string }>;
    }>('GET', `/safety/sos/${incidentId}/deliveries`),
  getSosEvent: (incidentId: string) => request<Record<string, unknown>>('GET', `/safety/sos-events/${incidentId}`),
  resendGuardianInvite: (id: string) =>
    request<{ contactId: string; inviteId: string; expiresAt: string; invitationDelivery: string; message: string }>(
      'POST',
      `/safety/guardians/${id}/resend`,
      {},
    ),
  updateGuardianScopes: (id: string, scopes: Array<'sos_alert' | 'check_in'>) =>
    request<{ id: string; scopes: string[]; status: string }>('PATCH', `/safety/guardians/${id}/scopes`, { scopes }),
};

// ---------------------------------------------------------------------------
// Care API (verified specialists, availability, temporary holds)
// ---------------------------------------------------------------------------

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
  meetingUrl: string | null;
  meetingUrlUpdatedAt: string | null;
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
  verifyPayment: (id: string) =>
    request<{
      booking: BookingData;
      payment: PaymentData;
      reconciled: boolean;
      alreadyVerified: boolean;
      confirmed?: boolean;
      appointmentStatus?: BookingData['status'];
      providerStatus?: string;
    }>('POST', `/bookings/${id}/payment/verify`, {}),
  cancel: (id: string, reason?: string) =>
    request<{ booking: BookingData; refund: { status: string; message: string } }>(
      'POST',
      `/bookings/${id}/cancel`,
      reason ? { reason } : {},
    ),
  getPayment: (paymentId: string) => request<PaymentData>('GET', `/payments/${paymentId}`),
  completeAsClinician: (bookingId: string) =>
    request<{ booking: BookingData; paymentChanged: false; message: string }>(
      'POST',
      `/clinician/bookings/${bookingId}/complete`,
      {},
    ),
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

export interface AdminMetricsData {
  totalUsers: number;
  newUsersLast7Days: number;
  activePregnancies: number;
  verifiedEmergencyResources: number;
  totalDoctors: number;
  verifiedDoctors: number;
  activeDoctors: number;
  appointmentsToday: number;
  pendingAppointments: number;
  confirmedUpcoming: number;
  openSupportTickets: number;
  activeSosIncidents: number;
  payments: { byCurrency: Array<{ currency: string; amountMinor: number; count: number }>; policyPending: boolean };
  operationsTimeZone: string;
  today: string;
  generatedAt: string;
  countryBreakdown: Record<string, { users: number }>;
}

export interface AdminAppointmentData {
  id: string;
  reference: string;
  status: string;
  sessionType: string;
  startsAt: string;
  endsAt: string;
  timeZone: string | null;
  amountMinor: number;
  currency: string;
  refundStatus: string;
  cancellationReason: string | null;
  rejectionReason: string | null;
  createdAt: string | null;
  patient: { displayName: string; email: string | null; phoneNumber: string | null };
  doctor: { id: string | null; displayName: string };
  paymentStatus: string | null;
}

export interface AdminPaymentData {
  id: string;
  reference: string;
  gateway: string;
  amountMinor: number;
  currency: string;
  status: string;
  failureReason: string | null;
  verifiedAt: string | null;
  createdAt: string | null;
  bookingId: string | null;
  bookingStatus: string | null;
  patient: { displayName: string; email: string | null };
  doctor: { id: string | null; displayName: string };
}

export interface AdminSafetyIncidentData {
  id: string;
  status: string;
  dispatchStatus: string;
  isTestMode: boolean;
  triggeredAt: string;
  cancelledAt: string | null;
  createdAt: string | null;
  trustedContactCount: number;
  patient: { displayName: string; email: string | null; countryCode: string | null };
  delivery: { sent: number; failed: number; skipped: number; simulated: number };
}

export interface AdminSupportTicketData extends SupportTicketData {
  userId: string;
  updatedAt?: string;
  user: { email: string | null; countryCode: string | null; displayName: string | null };
}

export interface AdminArticleData extends ArticleSummaryData {
  body: string;
  reviewEvidenceRef: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminPlatformStatusData {
  environment: string;
  degraded: boolean;
  generatedAt: string;
  countries: Array<{
    code: string;
    name: string;
    flag: string;
    currency: string;
    features: Record<string, boolean>;
  }>;
  payments: { enabled: boolean; policyVersion: string | null; gatewayConfigured: boolean; currency: string };
  email: { delivery: string; from: string };
  whatsapp: { delivery: string };
  googleSignIn: { enabled: boolean };
  redis: { configured: boolean };
}

export const adminApi = {
  metrics: () => request<AdminMetricsData>('GET', '/admin/metrics'),
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
  listEmergencyResources: (query: { countryCode?: string; freshness?: EmergencyResourceFreshness; limit?: number } = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
    const suffix = params.size ? `?${params.toString()}` : '';
    return request<{ resources: Array<Record<string, unknown>> }>('GET', `/admin/safety/resources${suffix}`);
  },
  reviewEmergencyResource: (
    recordId: string,
    input: { verificationStatus: EmergencyVerificationStatus; evidenceRef?: string; note?: string; nextReviewDueAt?: string },
  ) => request<Record<string, unknown>>('PUT', `/admin/safety/resources/${recordId}/review`, input),
  createConsultation: (input: { patientUserId: string; clinicianId: string }) =>
    request<{ id: string; status: string; participantCount: number; bookingConfirmed: false; message: string }>('POST', '/admin/consultations', input),

  // Doctors section of the existing Admin.
  listDoctors: (query: { q?: string; status?: string; listed?: 'true' | 'false'; specialization?: string; page?: number; limit?: number } = {}) =>
    request<{
      doctors: Array<{
        id: string;
        userId: string | null;
        displayName: string;
        email: string | null;
        phoneNumber: string | null;
        photoUrl: string | null;
        specialization: string | null;
        specialties: string[];
        status: 'invited' | 'active' | 'inactive' | 'suspended';
        listed: boolean;
        verificationStatus: string;
        bookingCount: number;
        createdAt: string | null;
      }>;
      total: number;
      page: number;
      limit: number;
      statusCounts: Record<string, number>;
    }>('GET', `/admin/doctors${queryString(query)}`),
  createDoctor: (input: Record<string, unknown>) =>
    request<{
      doctor: Record<string, unknown>;
      invitation: { emailDelivered: boolean; emailDelivery: string; activationRequired: boolean; expiresInDays: number; activationToken?: string; message: string };
    }>('POST', '/admin/doctors', input),
  getDoctor: (id: string) => request<Record<string, unknown>>('GET', `/admin/doctors/${id}`),
  updateDoctor: (id: string, input: Record<string, unknown>) => request<Record<string, unknown>>('PATCH', `/admin/doctors/${id}`, input),
  setDoctorStatus: (id: string, status: 'active' | 'inactive' | 'suspended', reason?: string) =>
    request<Record<string, unknown>>('POST', `/admin/doctors/${id}/status`, { status, reason }),
  inviteDoctor: (id: string) =>
    request<{ emailDelivered: boolean; emailDelivery: string; expiresInDays: number; activationToken?: string; message: string }>(
      'POST',
      `/admin/doctors/${id}/invite`,
      {},
    ),

  listAppointments: (query: { status?: string; from?: string; to?: string; q?: string; page?: number; limit?: number } = {}) =>
    request<{
      appointments: AdminAppointmentData[];
      total: number;
      page: number;
      limit: number;
      statusCounts: Record<string, number>;
    }>('GET', `/admin/appointments${queryString(query)}`),

  listPayments: (query: { status?: string; q?: string; page?: number; limit?: number } = {}) =>
    request<{
      payments: AdminPaymentData[];
      total: number;
      page: number;
      limit: number;
      statusCounts: Record<string, number>;
      totals: Array<{ currency: string; amountMinor: number; count: number }>;
      policyPending: boolean;
    }>('GET', `/admin/payments${queryString(query)}`),

  listSafetyIncidents: (query: { status?: string; limit?: number } = {}) =>
    request<{ incidents: AdminSafetyIncidentData[]; total: number }>('GET', `/admin/safety/incidents${queryString(query)}`),

  platformStatus: () => request<AdminPlatformStatusData>('GET', '/admin/platform/status'),

  supportTickets: (query: { status?: string; cursor?: string; limit?: number } = {}) =>
    request<{ tickets: AdminSupportTicketData[]; nextCursor: string | null }>('GET', `/admin/support/tickets${queryString(query)}`),
  updateSupportTicket: (id: string, input: { status?: string; reply?: string }) =>
    request<AdminSupportTicketData>('PUT', `/admin/support/tickets/${id}`, input),

  listArticles: (query: { status?: string; cursor?: string; limit?: number } = {}) =>
    request<{ articles: AdminArticleData[]; nextCursor: string | null }>('GET', `/admin/articles${queryString(query)}`),
  createArticle: (input: { slug: string; title: string; summary: string; body: string; category: string; tags?: string[] }) =>
    request<AdminArticleData>('POST', '/admin/articles', input),
  updateArticle: (id: string, input: { title?: string; summary?: string; body?: string; category?: string; tags?: string[] }) =>
    request<AdminArticleData>('PUT', `/admin/articles/${id}`, input),
  reviewArticle: (id: string, input: { medicalReviewStatus: 'pending' | 'approved' | 'rejected'; reviewEvidenceRef?: string; reviewNote?: string }) =>
    request<AdminArticleData>('PUT', `/admin/articles/${id}/review`, input),
  publishArticle: (id: string) => request<AdminArticleData>('POST', `/admin/articles/${id}/publish`, {}),
  archiveArticle: (id: string) => request<AdminArticleData>('POST', `/admin/articles/${id}/archive`, {}),
};

// ---------------------------------------------------------------------------
// Support, articles, privacy, subscriptions, promotions, briefs and MFA
// ---------------------------------------------------------------------------

export interface SupportFaqData {
  slug: string;
  category: string;
  question: string;
  answer: string;
  reviewStatus: 'provisional' | 'approved';
}

export interface SupportTicketData {
  id: string;
  reference: string;
  subject: string;
  category: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  replies: Array<{ authorRole: 'user' | 'support'; body: string; createdAt: string }>;
  createdAt: string;
  resolvedAt: string | null;
}

export const supportApi = {
  faqs: (category?: string) => {
    const suffix = category ? `?category=${encodeURIComponent(category)}` : '';
    return request<{ version: string; reviewStatus: string; faqs: SupportFaqData[] }>('GET', `/support/faqs${suffix}`);
  },
  createTicket: (input: { subject: string; message: string; category?: string }) =>
    request<SupportTicketData>('POST', '/support/tickets', input),
  listTickets: (query: { cursor?: string; limit?: number } = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
    const suffix = params.size ? `?${params.toString()}` : '';
    return request<{ tickets: SupportTicketData[]; nextCursor: string | null }>('GET', `/support/tickets${suffix}`);
  },
  getTicket: (id: string) => request<SupportTicketData>('GET', `/support/tickets/${id}`),
  reply: (id: string, body: string) => request<SupportTicketData>('PATCH', `/support/tickets/${id}`, { body }),
};

export interface ArticleSummaryData {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body?: string;
  category: string;
  tags: string[];
  status: string;
  medicalReviewStatus: 'pending' | 'approved' | 'rejected';
  publishedAt: string | null;
  version: number;
  disclaimer: string;
}

export const articlesApi = {
  list: (query: { category?: string; cursor?: string; limit?: number } = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
    const suffix = params.size ? `?${params.toString()}` : '';
    return request<{ articles: ArticleSummaryData[]; nextCursor: string | null }>('GET', `/articles${suffix}`);
  },
  get: (slug: string) => request<ArticleSummaryData>('GET', `/articles/${slug}`),
};

export const privacyApi = {
  get: () =>
    request<{
      purposes: Array<{ purpose: string; granted: boolean | null; policyVersion: string | null; decided: boolean }>;
      undecidedPurposes: string[];
      preferences: { shareAnalytics: boolean; shareCrashReports: boolean; personalizedContent: boolean };
      dataControls: { exportAvailable: boolean; deletionAvailable: boolean; deletionWindowDays: number; erasureNote: string };
    }>('GET', '/privacy-settings'),
  update: (input: {
    purposes?: Array<{ purpose: string; granted: boolean; policyVersion: string }>;
    shareAnalytics?: boolean;
    shareCrashReports?: boolean;
    personalizedContent?: boolean;
  }) => request<Record<string, unknown>>('PATCH', '/privacy-settings', input),
};

export const subscriptionsApi = {
  me: () =>
    request<{
      subscription: { plan: string | null; status: string; catalog: string; message: string };
      entitlements: Array<{ bookingId: string; sessionType: string; startsAt: string }>;
      usage: { upcomingSessions: number; completedSessions: number; verifiedPayments: number };
      policyPending: boolean;
    }>('GET', '/subscriptions/me'),
};

export const promosApi = {
  validate: (input: { code: string; clinicianId: string; sessionType: SessionType }) =>
    request<{
      code: string;
      percentOff: number;
      originalAmountMinor: number;
      discountMinor: number;
      payableAmountMinor: number;
      currency: string;
      applied: false;
      reason: string;
      message: string;
    }>('POST', '/promo-codes/validate', input),
};

export const briefsApi = {
  generate: (input: { recipientUserId: string; scopes: string[]; from: string; to: string; expiresAt: string }) =>
    request<{
      id: string;
      contentHash: string;
      generatorVersion: string;
      scopes: string[];
      range: { from: string; to: string };
      recordCounts: { cycles: number; dailyLogs: number; pregnancies: number };
      notesIncluded: false;
    }>('POST', '/briefs/generate', input),
  get: (id: string) => request<Record<string, unknown>>('GET', `/briefs/${id}`),
  revoke: (id: string) => request<{ id: string; status: string }>('DELETE', `/briefs/${id}`),
  sharedBriefs: () => request<{ briefs: Array<Record<string, unknown>> }>('GET', '/specialists/me/shared-briefs'),
};

export const mfaApi = {
  status: () =>
    request<{ enabled: boolean; pendingEnrolment: boolean; recoveryCodesRemaining: number }>('GET', '/auth/mfa/status'),
  enroll: () =>
    request<{ status: string; secret: string; otpauthUrl: string; recoveryCodes: string[] }>('POST', '/auth/mfa/enroll', {}),
  verify: (code: string) => request<{ enabled: boolean }>('POST', '/auth/mfa/verify', { code }),
  disable: (code: string) => request<{ enabled: false }>('POST', '/auth/mfa/disable', { code }),
  challenge: (input: { mfaToken: string; code: string; platform?: 'web' | 'ios' | 'android' }) =>
    request<{ user: unknown; tokens: { accessToken: string; refreshToken: string } }>('POST', '/auth/mfa/challenge', input),
};
