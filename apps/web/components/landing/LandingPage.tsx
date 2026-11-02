"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Baby,
  Calendar,
  Check,
  Lock,
  Menu,
  ShieldCheck,
  Stethoscope,
  X,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import LaunchNotifyForm from "./LaunchNotifyForm";

const NAV = [
  { href: "#product", label: "The app" },
  { href: "#clinicians", label: "For clinicians" },
  { href: "#privacy", label: "Privacy" },
];

const FEATURES = [
  {
    icon: Calendar,
    title: "Cycle and fertility tracking",
    copy: "Log flow, symptoms and moods in seconds. Predictions show their confidence instead of pretending to be exact.",
  },
  {
    icon: Baby,
    title: "Pregnancy, week by week",
    copy: "Gestation, milestones, appointments and daily check-ins in one timeline you can share with your clinician.",
  },
  {
    icon: Stethoscope,
    title: "Care from verified clinicians",
    copy: "Find gynaecologists and specialists, book a real slot and message them before and after your appointment.",
  },
  {
    icon: ShieldCheck,
    title: "Safety when it matters",
    copy: "Quiet check-ins and a silent SOS that alerts the contacts you choose. It supports your care; it does not replace emergency services.",
  },
];

const PRIVACY_POINTS = [
  ["Your notes stay private", "Free-text health notes are encrypted at rest and never appear in notifications or logs."],
  ["You decide who sees what", "Share a health brief with a named clinician, for a set period, and revoke it whenever you want."],
  ["Your data is yours", "Request an export or ask for your account to be deleted from inside the app."],
];

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D4AFF] focus-visible:ring-offset-2 focus-visible:ring-offset-white";

type LandingPageProps = {
  doctorPortalUrl: string;
  iosAppUrl: string;
  androidAppUrl: string;
};

/**
 * Obiren's public landing page.
 *
 * Two audiences, two doors: patients are pointed at the mobile app, and the
 * only sign-in on the web is the clinician portal. There is no patient
 * account creation on this surface by design.
 */
export default function LandingPage({ doctorPortalUrl, iosAppUrl, androidAppUrl }: LandingPageProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const appNotListed = !iosAppUrl && !androidAppUrl;

  // Close the mobile sheet on Escape and when the viewport grows past md.
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth >= 768) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-white text-[#17131D]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[#17131D] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>

      {/* ------------------------------- header ------------------------------- */}
      <header className="sticky top-0 z-40 border-b border-[#EDE9F2] bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <a href="#top" className="flex items-center gap-2.5 rounded-lg" aria-label="Obiren, back to top">
            <BrandLogo pfp height={30} priority />
            <span className="text-[15px] font-semibold tracking-tight">Obiren</span>
          </a>

          <nav aria-label="Main" className="hidden md:flex items-center gap-7">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`text-[13px] font-medium text-[#5F5867] transition-colors hover:text-[#17131D] rounded ${focusRing}`}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href={doctorPortalUrl}
              className={`hidden sm:inline-flex h-9 items-center rounded-full border border-[#DDD7E4] px-4 text-[13px] font-semibold text-[#17131D] transition-colors hover:border-[#17131D] ${focusRing}`}
            >
              Doctor login
            </a>
            <a
              href="#download"
              className={`hidden sm:inline-flex h-9 items-center rounded-full bg-[#6D4AFF] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#5B3DE0] ${focusRing}`}
            >
              Download app
            </a>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              className={`md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#DDD7E4] text-[#17131D] ${focusRing}`}
            >
              {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div id="mobile-nav" className="md:hidden border-t border-[#EDE9F2] bg-white px-5 pb-5 pt-3">
            <nav aria-label="Mobile" className="flex flex-col">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg py-2.5 text-sm font-medium text-[#17131D] hover:text-[#6D4AFF]"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="mt-3 grid gap-2">
              <a
                href="#download"
                onClick={() => setMenuOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-full bg-[#6D4AFF] text-sm font-semibold text-white"
              >
                Download the app
              </a>
              <a
                href={doctorPortalUrl}
                className="inline-flex h-10 items-center justify-center rounded-full border border-[#DDD7E4] text-sm font-semibold text-[#17131D]"
              >
                Doctor login
              </a>
            </div>
          </div>
        )}
      </header>

      <main id="main">
        {/* -------------------------------- hero -------------------------------- */}
        <section id="top" className="border-b border-[#EDE9F2] bg-[#FBFAFD]">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6D4AFF]">
                Women&apos;s health, connected
              </p>
              <h1 className="mt-5 text-[2.1rem] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-5xl lg:text-[3.35rem]">
                One private place for your health, from cycle to pregnancy.
              </h1>
              <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-[#5F5867] sm:text-base">
                Obiren brings cycle tracking, pregnancy support, verified clinicians and personal safety
                together in one calm app — built for women in Nigeria, Ghana, the UK and the US.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#download"
                  className={`inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#6D4AFF] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#5B3DE0] ${focusRing}`}
                >
                  Download the app
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </a>
                <a
                  href="#clinicians"
                  className={`inline-flex h-11 items-center justify-center rounded-full border border-[#DDD7E4] px-6 text-sm font-semibold text-[#17131D] transition-colors hover:border-[#17131D] ${focusRing}`}
                >
                  I&apos;m a clinician
                </a>
              </div>

              <ul className="mt-10 grid gap-x-6 gap-y-3 text-[13px] text-[#5F5867] sm:grid-cols-3">
                {["Verified clinicians", "Encrypted health records", "NDPR & GDPR aligned"].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 shrink-0 text-[#6D4AFF]" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <PhonePreview />
          </div>
        </section>

        {/* ------------------------------ features ------------------------------ */}
        <section id="product" className="bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6D4AFF]">The app</p>
              <h2 className="mt-4 text-2xl font-semibold tracking-[-0.01em] sm:text-3xl">
                Four connected parts of one experience.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-[#5F5867]">
                Nothing about your health should live in five different places. Each part of Obiren is built to
                work with the others, and only you decide what is shared.
              </p>
            </div>

            <div className="mt-12 overflow-hidden rounded-2xl border border-[#EDE9F2] sm:grid sm:grid-cols-2">
              {FEATURES.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <article
                    key={feature.title}
                    className={`bg-white p-7 sm:p-8 ${index % 2 === 0 ? "sm:border-r" : ""} ${
                      index < 2 ? "border-b" : ""
                    } ${index === 1 ? "border-b" : ""} border-[#EDE9F2]`}
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5F2FF] text-[#6D4AFF]">
                      <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#5F5867]">{feature.copy}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ----------------------------- clinicians ----------------------------- */}
        <section id="clinicians" className="border-y border-[#EDE9F2] bg-[#FBFAFD] py-16 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6D4AFF]">
                For clinicians
              </p>
              <h2 className="mt-4 text-2xl font-semibold tracking-[-0.01em] sm:text-3xl">
                The web portal is for doctors, not patients.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-[#5F5867]">
                Patients use the Obiren mobile app. Clinicians sign in here to review the appointments booked
                through it, publish their availability and keep their public profile accurate.
              </p>
              <a
                href={doctorPortalUrl}
                className={`mt-8 inline-flex h-11 items-center gap-2 rounded-full bg-[#17131D] px-6 text-sm font-semibold text-white transition-colors hover:bg-black ${focusRing}`}
              >
                Open the doctor portal
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </a>
              <p className="mt-4 text-xs leading-relaxed text-[#6E6875]">
                Invited by the Obiren team? Use the activation link in your invitation email to set a password.
              </p>
            </div>

            <ul className="divide-y divide-[#EDE9F2] overflow-hidden rounded-2xl border border-[#EDE9F2] bg-white">
              {[
                ["Appointments", "See today's schedule, then confirm, reschedule, cancel or complete a booking."],
                ["Availability", "Publish recurring hours and time off. Patients only ever see real openings."],
                ["Your profile", "Keep specialities, languages, fees and practice details up to date."],
              ].map(([title, copy]) => (
                <li key={title} className="p-6">
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#5F5867]">{copy}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------ privacy ------------------------------- */}
        <section id="privacy" className="bg-white py-16 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6D4AFF]">Privacy</p>
              <h2 className="mt-4 text-2xl font-semibold tracking-[-0.01em] sm:text-3xl">Private by design.</h2>
              <p className="mt-4 text-[15px] leading-relaxed text-[#5F5867]">
                Reproductive health data is some of the most sensitive information you will ever share. Access is
                limited to you and the people you explicitly choose.
              </p>
            </div>

            <ul className="space-y-6">
              {PRIVACY_POINTS.map(([title, copy]) => (
                <li key={title} className="flex gap-4">
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#EDE9F2] text-[#5F5867]">
                    <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-[#5F5867]">{copy}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------ download ------------------------------ */}
        <section id="download" className="border-t border-[#EDE9F2] bg-[#FBFAFD] py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6D4AFF]">Get the app</p>
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.01em] sm:text-3xl">
              Obiren for iOS and Android.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[#5F5867]">
              Cycle, pregnancy, care and safety in your pocket. Launching first in Nigeria, Ghana, the UK and the US.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <StoreBadge platform="ios" href={iosAppUrl} />
              <StoreBadge platform="android" href={androidAppUrl} />
            </div>

            {appNotListed && (
              <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9B94A3]">
                  In final testing
                </p>
                <LaunchNotifyForm />
              </div>
            )}
          </div>
        </section>
      </main>

      {/* ------------------------------- footer -------------------------------- */}
      <footer className="border-t border-[#EDE9F2] bg-white">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5">
                <BrandLogo pfp height={30} />
                <span className="text-[15px] font-semibold tracking-tight">Obiren</span>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#5F5867]">
                Health, safety and peace of mind for women. Obiren means <em>Woman</em> in Itsekiri.
              </p>
            </div>

            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9B94A3]">Product</h3>
              <ul className="mt-4 space-y-2.5 text-sm text-[#5F5867]">
                <li>
                  <a href="#product" className="transition-colors hover:text-[#17131D]">
                    The app
                  </a>
                </li>
                <li>
                  <a href="#download" className="transition-colors hover:text-[#17131D]">
                    Download
                  </a>
                </li>
                <li>
                  <a href={doctorPortalUrl} className="transition-colors hover:text-[#17131D]">
                    Doctor portal
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9B94A3]">Contact</h3>
              <ul className="mt-4 space-y-2.5 text-sm text-[#5F5867]">
                <li>
                  <a href="mailto:support@obiren.com" className="transition-colors hover:text-[#17131D]">
                    Support
                  </a>
                </li>
                <li>
                  <a href="mailto:privacy@obiren.com" className="transition-colors hover:text-[#17131D]">
                    Privacy &amp; data requests
                  </a>
                </li>
                <li>
                  <a href="mailto:doctors@obiren.com" className="transition-colors hover:text-[#17131D]">
                    Join as a clinician
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-[#EDE9F2] pt-6 text-xs text-[#9B94A3] sm:flex-row sm:items-center sm:justify-between">
            <p>© Obiren. All rights reserved.</p>
            <p>Obiren supports your care. It does not replace emergency services.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------ sub-components ------------------------------ */

/** A quiet, unbranded-in-a-loud-way preview of the app's home screen. */
function PhonePreview() {
  return (
    <div className="relative mx-auto w-full max-w-[320px]" aria-hidden="true">
      <div className="rounded-[2.25rem] border border-[#E4DEEB] bg-white p-2.5 shadow-[0_30px_70px_-45px_rgba(23,19,29,0.6)]">
        <div className="rounded-[1.85rem] border border-[#F1EDF5] bg-[#FBFAFD] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#6E6875]">Today</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-semibold text-[#6E6875] border border-[#EDE9F2]">
              Private
            </span>
          </div>

          <div className="mt-4 rounded-xl border border-[#EDE9F2] bg-white p-3.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-medium text-[#6E6875]">Cycle</span>
              <span className="text-[11px] font-semibold text-[#6D4AFF]">Day 14</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#F1EDF5]">
              <div className="h-full w-[46%] rounded-full bg-[#6D4AFF]" />
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-[#9B94A3]">
              Fertile window estimate · confidence medium
            </p>
          </div>

          <div className="mt-3 rounded-xl border border-[#EDE9F2] bg-white p-3.5">
            <span className="text-[11px] font-medium text-[#6E6875]">Next appointment</span>
            <p className="mt-1 text-[12px] font-semibold text-[#17131D]">Thu · 10:00 · Video</p>
            <p className="text-[10px] text-[#9B94A3]">Gynaecologist · confirmed</p>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl border border-[#EDE9F2] bg-white p-3.5">
            <div>
              <span className="text-[11px] font-medium text-[#6E6875]">Daily check-in</span>
              <p className="mt-0.5 text-[10px] text-[#9B94A3]">Flow, mood, sleep</p>
            </div>
            <span className="rounded-full border border-[#EDE9F2] px-2 py-1 text-[9px] font-semibold text-[#5F5867]">
              Log
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StoreBadge({ platform, href }: { platform: "ios" | "android"; href: string }) {
  const prefix = platform === "ios" ? "Download on the" : "Get it on";
  const name = platform === "ios" ? "App Store" : "Google Play";

  const content = (
    <>
      <span className="shrink-0 text-white">
        {platform === "ios" ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
            <path d="M16.37 1.43c0 1.14-.42 2.2-1.26 3.06-.9.96-2.02 1.5-3.14 1.41-.03-1.1.45-2.2 1.28-3.06.86-.92 2.1-1.5 3.12-1.41zM20.99 17.1c-.6 1.35-.9 1.95-1.68 3.14-1.08 1.64-2.6 3.68-4.48 3.7-1.67.02-2.1-1.09-4.37-1.08-2.27.01-2.74 1.1-4.41 1.08-1.88-.02-3.32-1.86-4.4-3.5C-.24 16.1-.55 10.6 1.7 7.7c1.2-1.55 3.1-2.54 4.9-2.54 1.83 0 2.98 1.1 4.5 1.1 1.47 0 2.36-1.1 4.48-1.1 1.6 0 3.3.87 4.5 2.38-3.95 2.16-3.3 7.8.91 9.56z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
            <path d="M4 2.6c-.3.3-.5.8-.5 1.4v16c0 .6.2 1.1.5 1.4l.1.1 9-9v-.2l-9-9-.1.3zM16.2 14.5 13.3 12l2.9-2.5 3.4 2c1 .6 1 1.5 0 2l-3.4 1zM12.4 12.9l9 5.1c.7-.4.7-1.3 0-1.8l-9-5.1-9-5.1c-.7-.4-1.6.1-1.6 1v11.2c0 .9.9 1.4 1.6 1l9-5.1-.1-.2z" />
          </svg>
        )}
      </span>
      <span className="text-left leading-tight">
        <span className="block text-[9px] uppercase tracking-[0.08em] text-white/60">
          {href ? prefix : "Coming soon to"}
        </span>
        <span className="block text-[13px] font-semibold text-white">{name}</span>
      </span>
    </>
  );

  const base =
    "inline-flex h-12 items-center gap-2.5 rounded-xl bg-[#17131D] px-4 transition-colors";

  if (!href) {
    return (
      <span aria-disabled="true" className={`${base} cursor-default opacity-70`}>
        {content}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={`${prefix} ${name}`}
      className={`${base} hover:bg-black ${focusRing}`}
    >
      {content}
    </a>
  );
}
