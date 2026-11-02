"use client";

import { useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { ApiError, waitlistApi } from "@obiren/api-client";

const MARKETS = [
  { value: "NG", label: "Nigeria" },
  { value: "GH", label: "Ghana" },
  { value: "GB", label: "United Kingdom" },
  { value: "US", label: "United States" },
  { value: "other", label: "Somewhere else" },
];

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D4AFF] focus-visible:ring-offset-2 focus-visible:ring-offset-white";

type DoctorPortalProps = { doctorPortalUrl: string };

/**
 * The public waitlist page.
 *
 * One field that matters (email) plus an optional name and market, posted to
 * the real waitlist API so a signup survives deploys. No account is created
 * and no patient credentials ever exist on the web.
 */
export default function WaitlistPageClient({ doctorPortalUrl }: DoctorPortalProps) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [market, setMarket] = useState("NG");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [position, setPosition] = useState<number | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (status === "submitting") return;

    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setStatus("submitting");
    setMessage("");
    try {
      const result = await waitlistApi.join({
        email: value,
        firstName: firstName.trim() || undefined,
        market,
        source: "obiren_co_waitlist",
      });
      setPosition(typeof result.position === "number" ? result.position : null);
      setStatus("success");
    } catch (error) {
      // The API answers duplicates the same way as new signups, so this is a
      // real failure (rate limit, validation, network) rather than "already in".
      setStatus("error");
      setMessage(
        error instanceof ApiError
          ? error.fields?.email || error.message
          : "We could not save that just now. Please try again.",
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFAFD] text-[#17131D]">
      <header className="border-b border-[#EDE9F2] bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-8">
          <a href="/" className="flex items-center gap-2.5" aria-label="Obiren, back to the home page">
            <BrandLogo pfp height={30} priority />
            <span className="text-[15px] font-semibold tracking-tight">Obiren</span>
          </a>
          <a
            href="/"
            className={`text-[13px] font-medium text-[#5F5867] transition-colors hover:text-[#17131D] rounded ${focusRing}`}
          >
            Back to home
          </a>
        </div>
      </header>

      <main className="mx-auto flex max-w-xl flex-col px-5 py-14 sm:px-8 sm:py-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6D4AFF]">Early access</p>
        <h1 className="mt-4 text-[1.9rem] font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">
          Join the Obiren waitlist.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[#5F5867]">
          Obiren launches first in Nigeria, then Ghana, the UK and the US. Leave your email and we will send
          your App Store or Google Play link the day it is live.
        </p>

        <div className="mt-8 rounded-2xl border border-[#EDE9F2] bg-white p-6 sm:p-8">
          {status === "success" ? (
            <div role="status" className="flex flex-col gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#F5F2FF] text-[#6D4AFF]">
                <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
              </span>
              <h2 className="text-lg font-semibold">You&apos;re on the list.</h2>
              <p className="text-sm leading-relaxed text-[#5F5867]">
                {position
                  ? `You are number ${position.toLocaleString()} in line for early access. We will email you as soon as the app opens in your country.`
                  : "We will email you as soon as the app opens in your country."}
              </p>
              <a
                href="/"
                className={`mt-2 inline-flex h-10 w-fit items-center gap-2 rounded-full border border-[#DDD7E4] px-5 text-sm font-semibold text-[#17131D] transition-colors hover:border-[#17131D] ${focusRing}`}
              >
                Back to home
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </a>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="waitlist-email" className="block text-[13px] font-semibold text-[#17131D]">
                  Email address
                </label>
                <input
                  id="waitlist-email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  maxLength={320}
                  value={email}
                  disabled={status === "submitting"}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (status === "error") {
                      setStatus("idle");
                      setMessage("");
                    }
                  }}
                  placeholder="you@email.com"
                  aria-invalid={status === "error"}
                  aria-describedby={status === "error" ? "waitlist-error" : "waitlist-hint"}
                  className="mt-2 h-11 w-full rounded-xl border border-[#DDD7E4] bg-white px-4 text-sm text-[#17131D] placeholder:text-[#9B94A3] focus:border-[#6D4AFF] focus:outline-none focus:ring-4 focus:ring-[#6D4AFF]/15"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="waitlist-name" className="block text-[13px] font-semibold text-[#17131D]">
                    First name <span className="font-normal text-[#9B94A3]">(optional)</span>
                  </label>
                  <input
                    id="waitlist-name"
                    type="text"
                    autoComplete="given-name"
                    maxLength={80}
                    value={firstName}
                    disabled={status === "submitting"}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="Amara"
                    className="mt-2 h-11 w-full rounded-xl border border-[#DDD7E4] bg-white px-4 text-sm text-[#17131D] placeholder:text-[#9B94A3] focus:border-[#6D4AFF] focus:outline-none focus:ring-4 focus:ring-[#6D4AFF]/15"
                  />
                </div>

                <div>
                  <label htmlFor="waitlist-market" className="block text-[13px] font-semibold text-[#17131D]">
                    Where are you based?
                  </label>
                  <select
                    id="waitlist-market"
                    value={market}
                    disabled={status === "submitting"}
                    onChange={(event) => setMarket(event.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-[#DDD7E4] bg-white px-3 text-sm text-[#17131D] focus:border-[#6D4AFF] focus:outline-none focus:ring-4 focus:ring-[#6D4AFF]/15"
                  >
                    {MARKETS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={status === "submitting"}
                className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#6D4AFF] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#5B3DE0] disabled:opacity-60 ${focusRing}`}
              >
                {status === "submitting" ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                )}
                Join the waitlist
              </button>

              {status === "error" ? (
                <p id="waitlist-error" role="alert" className="flex items-start gap-1.5 text-xs text-[#B4273F]">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{message}</span>
                </p>
              ) : (
                <p id="waitlist-hint" className="text-xs leading-relaxed text-[#6E6875]">
                  No account is created and nothing else is sent. Your email is only used for the launch
                  announcement.
                </p>
              )}
            </form>
          )}
        </div>

        <p className="mt-8 text-xs leading-relaxed text-[#6E6875]">
          A clinician?{" "}
          <a href={doctorPortalUrl} className="font-semibold text-[#6D4AFF] hover:underline">
            Sign in to the doctor portal
          </a>
          .
        </p>
      </main>
    </div>
  );
}
