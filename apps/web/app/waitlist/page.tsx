import type { Metadata } from "next";
import WaitlistPageClient from "./WaitlistPageClient";

export const metadata: Metadata = {
  title: "Obiren | Women's Health, Connected",
  description:
    "Obiren brings cycle tracking, pregnancy support, secure health records, care access, and personal safety into one calm, private space. Join the waitlist for early access in the UK, US, Nigeria, and Ghana.",
  keywords: [
    "women's health app",
    "period tracker",
    "pregnancy companion",
    "health vault",
    "women safety app",
    "Obiren waitlist",
  ],
  alternates: { canonical: "/waitlist" },
  openGraph: {
    title: "Obiren | Women's Health, Connected",
    description:
      "Cycle tracking, pregnancy support, secure records, care access, and safety: together in one private space built for women. Join the waitlist.",
    url: "/waitlist",
    siteName: "Obiren",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Obiren | Women's Health, Connected",
    description:
      "One calm, private space for cycle, pregnancy, records, care, and safety. Join the Obiren waitlist.",
  },
};

export default function WaitlistPage() {
  return <WaitlistPageClient />;
}
