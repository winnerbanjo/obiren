import { permanentRedirect } from "next/navigation";

/**
 * The old marketing page lived here and offered patient sign-up plus an
 * in-browser patient dashboard. Web is no longer a patient surface: patients
 * are onboarded inside the mobile app, and the only web sign-in is the
 * clinician portal. Keep this redirect so older links do not 404.
 */
export default function LegacyHomePage() {
  permanentRedirect("/");
}
