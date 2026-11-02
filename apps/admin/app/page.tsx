import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";
import { DOCTOR_PORTAL_URL } from "@/lib/portal-links";

/**
 * The public site for obiren.co.
 *
 * Women are pointed at the mobile app and the waitlist; clinicians sign in to
 * the doctor portal and the Obiren team signs in to the admin console at
 * /user. There is deliberately no patient registration on this surface.
 */

function resolveAppUrl(value: string | undefined): string {
  const url = value?.trim();
  return url && /^https?:\/\//.test(url) ? url : "";
}

export const metadata: Metadata = {
  title: "Obiren — Women's health, in one private app",
  description:
    "Obiren brings cycle tracking, pregnancy support, verified clinicians and personal safety into one private mobile app for women in Nigeria, Ghana, the UK and the US. Join the waitlist, or sign in to the doctor portal.",
  keywords: [
    "women's health app",
    "period tracker",
    "pregnancy app",
    "gynaecologist consultation",
    "women safety app",
    "Obiren",
    "Nigeria women's health",
    "Ghana women's health",
    "doctor portal",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Obiren — Women's health, in one private app",
    description:
      "Cycle, pregnancy, care and safety in one calm app. Join the Obiren waitlist for iOS and Android.",
    url: "/",
    siteName: "Obiren",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Obiren — Women's health, in one private app",
    description:
      "Cycle, pregnancy, care and safety in one calm app. Clinicians sign in to the doctor portal.",
  },
};

export default function HomePage() {
  return (
    <LandingPage
      doctorPortalUrl={DOCTOR_PORTAL_URL}
      iosAppUrl={resolveAppUrl(process.env.NEXT_PUBLIC_IOS_APP_URL)}
      androidAppUrl={resolveAppUrl(process.env.NEXT_PUBLIC_ANDROID_APP_URL)}
    />
  );
}
