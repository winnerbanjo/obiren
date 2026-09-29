/**
 * Obiren shared API client.
 *
 * - Access token lives in memory only (15-minute TTL).
 * - Refresh token lives in an HTTP-only cookie set by the API; on boot and
 *   on 401 we call /auth/refresh to obtain a fresh access token.
 * - No passwords, refresh tokens, or privileged state in localStorage.
 */

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string; fields?: Record<string, string> };
  meta?: Record<string, any>;
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
  opts: { auth?: boolean; retryOn401?: boolean } = { auth: true, retryOn401: true },
): Promise<ApiEnvelope<T>> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;

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
    throw new ApiError(
      res.status,
      json?.error?.code || (res.status === 401 ? 'AUTH_REQUIRED' : 'REQUEST_FAILED'),
      json?.error?.message || `Request failed (${res.status})`,
      json?.error?.fields,
    );
  }

  return json ?? { success: true };
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

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const envelope = await rawRequest<T>(method, path, body);
  return envelope.data as T;
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

export const usersApi = {
  getProfile: () => request<UserProfileData>('GET', '/users/me'),
  updateProfile: (updates: Record<string, unknown>) => request<UserProfileData>('PATCH', '/users/me', updates),
  exportData: () => request<Record<string, unknown>>('GET', '/users/me/export'),
  requestDeletion: () => request<Record<string, unknown>>('POST', '/users/me/request-deletion', {}),
  cancelDeletion: () => request<Record<string, unknown>>('POST', '/users/me/cancel-deletion', {}),
};

// ---------------------------------------------------------------------------
// Cycles API
// ---------------------------------------------------------------------------

export interface CycleData {
  id?: string;
  startedAt?: string;
  dayOfCycle?: number;
  status?: string;
  prediction?: {
    predictedStartDate: string;
    predictedEndDate: string;
    rangeStart: string;
    rangeEnd: string;
    estimatedOvulationDate?: string;
    estimatedFertileWindowStart?: string;
    estimatedFertileWindowEnd?: string;
    confidence: 'LOW' | 'MEDIUM' | 'HIGH';
    explanationCode: string;
  };
}

export interface DailyLogData {
  date: string;
  bleeding?: { level: string; clots?: boolean };
  pain?: { level: number; locations?: string[] };
  moods?: string[];
  symptoms?: string[];
  notes?: string;
}

export const cyclesApi = {
  getCurrent: () => request<CycleData | null>('GET', '/cycles/current'),
  getHistory: () => request<CycleData[]>('GET', '/cycles/history'),
  startPeriod: (date?: string) => request<{ cycle: CycleData; prediction: CycleData['prediction'] }>('POST', '/cycles/start-period', date ? { date } : {}),
  endPeriod: (date?: string) => request<CycleData>('POST', '/cycles/end-period', date ? { date } : {}),
  getDailyLog: (date: string) => request<DailyLogData>('GET', `/daily-logs/${date}`),
  upsertDailyLog: (date: string, log: Partial<DailyLogData>) => request<DailyLogData>('PUT', `/daily-logs/${date}`, log),
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
  babyMilestone?: { fruitSize: string; lengthCm: number; weightGrams: number };
}

export const pregnancyApi = {
  getCurrent: () => request<PregnancyData | null>('GET', '/pregnancies/current'),
  create: (input: { lastMenstrualPeriod?: string; estimatedDueDate?: string; calculationSource?: string; multiplePregnancy?: boolean }) =>
    request<PregnancyData>('POST', '/pregnancies', input),
  end: (id: string, reason: string) => request<PregnancyData>('POST', `/pregnancies/${id}/end`, { reason }),
  logSymptom: (id: string, date: string, payload: { symptoms?: string[]; notes?: string; fetalMovement?: string }) =>
    request<{ safetyNotice: unknown }>('PUT', `/pregnancies/${id}/logs/${date}`, payload),
};

// ---------------------------------------------------------------------------
// Safety API
// ---------------------------------------------------------------------------

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
};
