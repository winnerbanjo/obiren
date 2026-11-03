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

/** Public waitlist page. */
export const WAITLIST_URL = "/waitlist";

// The admin console is deliberately NOT linked from the public site. It is
// served under /user and its address is shared only with the Obiren team.
