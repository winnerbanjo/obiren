import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";

/**
 * The public landing page.
 *
 * Obiren is a mobile product for patients; the web exists for two things:
 * explaining the app, and giving clinicians a door to their portal. There is
 * deliberately no patient registration or sign-in on this surface.
 */

const FALLBACK_DOCTOR_PORTAL =
  process.env.NODE_ENV === "production"
    ? "https://doctors.obiren.com/doctor/login"
    : "http://localhost:3020/doctor/login";

function resolveDoctorPortalUrl(): string {
  return process.env.NEXT_PUBLIC_DOCTOR_PORTAL_URL?.trim() || FALLBACK_DOCTOR_PORTAL;
}

function resolveAppUrl(value: string | undefined): string {
  const url = value?.trim();
  return url && /^https?:\/\//.test(url) ? url : "";
}

export const metadata: Metadata = {
  title: "Obiren — Women's health, in one private app",
  description:
    "Obiren brings cycle tracking, pregnancy support, verified clinicians and personal safety into one private mobile app for women in Nigeria, Ghana, the UK and the US. Clinicians sign in to the doctor portal.",
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
      "Cycle, pregnancy, care and safety in one calm app. Download Obiren for iOS and Android.",
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

export default function RootPage() {
  return (
    <LandingPage
      doctorPortalUrl={resolveDoctorPortalUrl()}
      iosAppUrl={resolveAppUrl(process.env.NEXT_PUBLIC_IOS_APP_URL)}
      androidAppUrl={resolveAppUrl(process.env.NEXT_PUBLIC_ANDROID_APP_URL)}
    />
  );
}
