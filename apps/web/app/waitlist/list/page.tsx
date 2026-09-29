import type { Metadata } from "next";
import WaitlistListClient from "./WaitlistListClient";

export const metadata: Metadata = {
  title: "Obiren | Waitlist Signups (draft)",
  robots: { index: false, follow: false },
};

export default function WaitlistListPage() {
  return <WaitlistListClient />;
}
