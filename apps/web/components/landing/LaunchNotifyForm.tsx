"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { waitlistApi, ApiError } from "@obiren/api-client";

/**
 * One-field launch notification capture for the landing page.
 *
 * The public web surface is not an account-creation entry point: this only
 * reserves an email so we can send the App Store / Google Play link when the
 * mobile app ships. Deliberately plain - no confetti, no hold gesture.
 */
export default function LaunchNotifyForm({ source = "landing_download" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (status === "submitting" || status === "success") return;

    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setStatus("submitting");
    setMessage("");
    try {
      await waitlistApi.join({ email: value, source });
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof ApiError
          ? error.fields?.email || error.message
          : "We could not save that just now. Please try again.",
      );
    }
  };

  if (status === "success") {
    return (
      <p role="status" className="flex items-start gap-2 text-sm text-[#2F6B4F]">
        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
        <span>You&apos;re on the list. We&apos;ll email your download link as soon as the app is live.</span>
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <label htmlFor="launch-email" className="sr-only">
          Email address
        </label>
        <input
          id="launch-email"
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
          aria-describedby={status === "error" ? "launch-email-error" : "launch-email-hint"}
          aria-invalid={status === "error"}
          className="h-11 flex-1 min-w-0 rounded-xl border border-[#DDD7E4] bg-white px-4 text-sm text-[#17131D] placeholder:text-[#9B94A3] focus:border-[#6D4AFF] focus:outline-none focus:ring-4 focus:ring-[#6D4AFF]/15"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="h-11 shrink-0 rounded-xl bg-[#17131D] px-5 text-sm font-semibold text-white transition-colors hover:bg-black disabled:opacity-60 inline-flex items-center justify-center gap-2"
        >
          {status === "submitting" && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          Notify me
        </button>
      </div>

      {status === "error" ? (
        <p id="launch-email-error" role="alert" className="flex items-start gap-1.5 text-xs text-[#B4273F]">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{message}</span>
        </p>
      ) : (
        <p id="launch-email-hint" className="text-xs text-[#6E6875]">
          One email when the app launches. No account is created and nothing else is sent.
        </p>
      )}
    </form>
  );
}
