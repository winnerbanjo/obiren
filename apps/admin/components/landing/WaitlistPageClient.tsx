"use client";

import { useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { ApiError, waitlistApi } from "@obiren/api-client";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D4AFF] focus-visible:ring-offset-2 focus-visible:ring-offset-white";

type WaitlistPageProps = { doctorPortalUrl: string };

/**
 * The public waitlist page.
 *
 * Same backend and same behaviour as the live waitlist: one email field posted
 * to `POST /api/v1/waitlist`, duplicate emails answered exactly like new ones
 * (no enumeration), and the same success copy. No account is created and no
 * patient credentials ever exist on the web.
 */
export default function WaitlistPageClient({ doctorPortalUrl }: WaitlistPageProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [alreadyJoined, setAlreadyJoined] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (status === "submitting") return;

    if (!emailValid) {
      setStatus("error");
      setMessage("Please enter a valid email address first.");
      return;
    }

    setStatus("submitting");
    setMessage("");
    try {
      const result = await waitlistApi.join({
        email: email.trim(),
        source: "obiren_co_waitlist",
      });
      setAlreadyJoined(Boolean(result.alreadyJoined));
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof ApiError && error.fields?.email
          ? error.fields.email
          : error instanceof ApiError
            ? error.message
            : "Something went wrong on our side. Please try again.",
      );
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#FBFAFD] text-[#17131D]">
      <header className="border-b border-[#EDE9F2] bg-white">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-5 sm:px-8">
          <a href="/" className="flex items-center gap-2.5" aria-label="Obiren, back to the home page">
            <BrandLogo pfp height={30} priority />
            <span className="text-[15px] font-semibold tracking-tight">Obiren</span>
          </a>
          <a
            href="/"
            className={`rounded text-[13px] font-medium text-[#5F5867] transition-colors hover:text-[#17131D] ${focusRing}`}
          >
            Back to home
          </a>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 py-12 sm:px-8 sm:py-16">
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
            <div role="status" aria-live="polite" className="flex flex-col gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#F5F2FF] text-[#6D4AFF]">
                <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
              </span>
              <h2 className="text-lg font-semibold">
                {alreadyJoined ? "You're already on the list." : "You're on the list."}
              </h2>
              <p className="text-sm leading-relaxed text-[#5F5867]">
                We&apos;ll reach out as launch approaches in your region. Until then, take care of yourself.
                That&apos;s the whole point.
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
                  className="mt-2 h-12 w-full rounded-xl border border-[#DDD7E4] bg-white px-4 text-[15px] text-[#17131D] placeholder:text-[#9B94A3] focus:border-[#6D4AFF] focus:outline-none focus:ring-4 focus:ring-[#6D4AFF]/15"
                />
              </div>

              <button
                type="submit"
                disabled={status === "submitting"}
                className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#6D4AFF] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#5B3DE0] disabled:opacity-60 ${focusRing}`}
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Securing your spot…
                  </>
                ) : (
                  <>
                    Join the waitlist
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </>
                )}
              </button>

              {status === "error" ? (
                <p id="waitlist-error" role="alert" className="flex items-start gap-1.5 text-xs text-[#B4273F]">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="flex-1">
                    {message}{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setStatus("idle");
                        setMessage("");
                      }}
                      className="underline underline-offset-2"
                    >
                      Try again
                    </button>
                  </span>
                </p>
              ) : (
                <p id="waitlist-hint" className="text-xs leading-relaxed text-[#6E6875]">
                  Your email is only used for launch updates. Never sold, never shared. Opt out anytime.
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
