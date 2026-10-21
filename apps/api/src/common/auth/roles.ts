/**
 * Canonical account roles (stored lowercase in `users.roles`).
 *
 * Roles are additive: a user may be both `user` and `guardian`, or `clinician`
 * and `medical_reviewer`. Authorization checks compare normalised values so a
 * legacy mixed-case row cannot silently bypass or gain a role.
 */
export const ROLES = {
  USER: 'user',
  GUARDIAN: 'guardian',
  CLINICIAN: 'clinician',
  SUPPORT_AGENT: 'support_agent',
  CONTENT_MANAGER: 'content_manager',
  MEDICAL_REVIEWER: 'medical_reviewer',
  EMERGENCY_MANAGER: 'emergency_manager',
  COMPLIANCE_OFFICER: 'compliance_officer',
  PLATFORM_ADMIN: 'platform_admin',
  SUPER_ADMIN: 'super_admin',
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

export function normalizeRoles(roles: unknown): string[] {
  if (!Array.isArray(roles)) return [];
  return roles
    .filter((role): role is string => typeof role === 'string')
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

export function hasAnyRole(roles: unknown, required: readonly string[]): boolean {
  const owned = new Set(normalizeRoles(roles));
  return required.some((role) => owned.has(role.trim().toLowerCase()));
}

/**
 * A guardian is an invited third party, never a health-data owner. They only
 * receive the owner-scoped SOS information the owner explicitly shared, so
 * this helper exists to keep that distinction explicit at call sites.
 */
export function isGuardian(roles: unknown): boolean {
  return hasAnyRole(roles, [ROLES.GUARDIAN]);
}
