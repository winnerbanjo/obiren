/**
 * Public links used by the marketing surface.
 *
 * The doctor portal lives in its own deployment; `NEXT_PUBLIC_DOCTOR_PORTAL_URL`
 * points at it (set per environment), with a sensible local default so the
 * links work in development without configuration.
 */
export const DOCTOR_PORTAL_URL =
  process.env.NEXT_PUBLIC_DOCTOR_PORTAL_URL?.trim() ||
  (process.env.NODE_ENV === "production"
    ? "https://doctor.obiren.com/doctor/login"
    : "http://localhost:3020/doctor/login");

/** Internal admin console. Served under /user, not /admin, on purpose. */
export const ADMIN_CONSOLE_URL = "/user";

/** Public waitlist page. */
export const WAITLIST_URL = "/waitlist";
