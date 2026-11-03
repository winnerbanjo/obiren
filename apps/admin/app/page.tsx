import { redirect } from "next/navigation";

/**
 * The admin app has no public surface.
 *
 * obiren.co (the marketing site and waitlist) lives in `apps/web`. This app is
 * only the internal console, served at `/user`, and its address is shared with
 * the Obiren team rather than linked from anywhere. Anything that reaches the
 * root is sent straight to the console's sign-in.
 */
export default function RootPage() {
  redirect("/user");
}
