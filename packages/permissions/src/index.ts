import { UserRole } from "@obiren/types";

export type Action =
  | "READ_SELF_HEALTH_DATA"
  | "WRITE_SELF_HEALTH_DATA"
  | "SHARE_SAFETY_INCIDENT"
  | "READ_SHARED_HEALTH_DATA"
  | "MANAGE_CONTENT"
  | "REVIEW_MEDICAL_CONTENT"
  | "VERIFY_EMERGENCY_RESOURCES"
  | "VIEW_SUPPORT_TICKETS"
  | "ADMIN_SYSTEM_ACCESS";

export interface PermissionContext {
  userId: string;
  roles: UserRole[];
  targetOwnerId?: string;
  isExplicitConsentGranted?: boolean;
}

export function can(action: Action, ctx: PermissionContext): boolean {
  const { userId, roles, targetOwnerId, isExplicitConsentGranted } = ctx;

  // Super Admin overrides for non-health audit tasks
  if (roles.includes("SUPER_ADMIN") && action === "ADMIN_SYSTEM_ACCESS") {
    return true;
  }

  switch (action) {
    case "READ_SELF_HEALTH_DATA":
    case "WRITE_SELF_HEALTH_DATA":
      return targetOwnerId === userId;

    case "READ_SHARED_HEALTH_DATA":
      if (targetOwnerId === userId) return true;
      if (roles.includes("HEALTHCARE_PROFESSIONAL") && isExplicitConsentGranted) {
        return true;
      }
      return false;

    case "SHARE_SAFETY_INCIDENT":
      return roles.includes("USER");

    case "MANAGE_CONTENT":
      return roles.includes("CONTENT_MANAGER") || roles.includes("ADMIN");

    case "REVIEW_MEDICAL_CONTENT":
      return roles.includes("MEDICAL_REVIEWER") || roles.includes("ADMIN");

    case "VERIFY_EMERGENCY_RESOURCES":
      return roles.includes("EMERGENCY_MANAGER") || roles.includes("ADMIN");

    case "VIEW_SUPPORT_TICKETS":
      return (
        roles.includes("SUPPORT_AGENT") ||
        roles.includes("ADMIN") ||
        roles.includes("SUPER_ADMIN")
      );

    case "ADMIN_SYSTEM_ACCESS":
      return roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");

    default:
      return false;
  }
}
