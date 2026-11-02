import type { Metadata } from "next";
import WaitlistPageClient from "@/components/landing/WaitlistPageClient";
import { DOCTOR_PORTAL_URL } from "@/lib/portal-links";

export const metadata: Metadata = {
  title: "Join the Obiren waitlist",
  description:
    "Obiren is coming to Nigeria, Ghana, the UK and the US. Join the waitlist and we will email your App Store or Google Play link when the app launches.",
  alternates: { canonical: "/waitlist" },
  openGraph: {
    title: "Join the Obiren waitlist",
    description:
      "Be first in line for Obiren: cycle tracking, pregnancy support, verified clinicians and safety in one private app.",
    url: "/waitlist",
    siteName: "Obiren",
    type: "website",
  },
};

export default function WaitlistPage() {
  return (
    <WaitlistPageClient doctorPortalUrl={DOCTOR_PORTAL_URL} />
  );
}
