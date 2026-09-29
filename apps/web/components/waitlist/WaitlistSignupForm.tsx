"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { AlertCircle, Loader2 } from "lucide-react";
import confetti from "canvas-confetti";
import { waitlistApi, ApiError } from "@obiren/api-client";
import { track } from "@/lib/analytics";

interface WaitlistSignupFormProps {
  source?: string;
}

const HOLD_DURATION_MS = 1100;

/**
 * Dramatic "hold the heart to join" waitlist capture.
 *
 * Interaction: type your email → the interface wakes up → press and HOLD the
 * heart until the ring completes → you're on the list. Keyboard-only users
 * can hold Space/Enter on the focused button. Reduced-motion users get an
 * instant progress fill with no pulsing ambience.
 */
export default function WaitlistSignupForm({ source = "obiren_waitlist" }: WaitlistSignupFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [startedTracked, setStartedTracked] = useState(false);

  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const rafRef = useRef<number | null>(null);
  const holdStartRef = useRef<number | null>(null);
  const submittedRef = useRef(false);
  const reduceMotion = useReducedMotion();

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const awake = email.length > 0;

  const stopHold = useCallback(() => {
    setHolding(false);
    holdStartRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setProgress(0);
  }, []);

  const submit = useCallback(async () => {
    if (submittedRef.current || status === "submitting") return;

    if (!emailValid) {
      setStatus("error");
      setErrorMessage("Please enter a valid email address first.");
      track("waitlist_error", { reason: "invalid_email" });
      stopHold();
      return;
    }

    submittedRef.current = true;
    setStatus("submitting");
    try {
      const result = await waitlistApi.join({
        email: email.trim(),
        source,
      });
      track("waitlist_joined", { alreadyJoined: result.alreadyJoined });
      setStatus("success");
      if (!reduceMotion) fireConfetti();
    } catch (err) {
      setStatus("error");
      const msg =
        err instanceof ApiError && err.fields?.email
          ? err.fields.email
          : err instanceof ApiError
            ? err.message
            : "Something went wrong on our side. Please try again.";
      setErrorMessage(msg);
      track("waitlist_error", { reason: "api_error" });
      submittedRef.current = false;
    } finally {
      stopHold();
    }
  }, [email, emailValid, source, status, stopHold, reduceMotion]);

  // Hold progress loop
  useEffect(() => {
    if (!holding) return;
    const step = (t: number) => {
      if (holdStartRef.current === null) holdStartRef.current = t;
      const elapsed = t - holdStartRef.current;
      const p = Math.min(1, elapsed / HOLD_DURATION_MS);
      setProgress(p);
      if (p >= 1) {
        stopHold();
        submit();
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [holding, submit, stopHold]);

  // Global mouse-up safety net (release outside the button)
  useEffect(() => {
    if (!holding) return;
    const onUp = () => stopHold();
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [holding, stopHold]);

  const beginHold = () => {
    if (status === "submitting" || status === "success") return;
    setHolding(true);
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (!startedTracked && value.includes("@") && value.length > 3) {
      track("waitlist_form_started");
      setStartedTracked(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.repeat) {
      e.preventDefault();
      // Keyboard users get the same ritual: holding Enter fills the ring.
      setHolding(true);
    }
  };

  const reset = () => {
    submittedRef.current = false;
    setStatus("idle");
    setErrorMessage("");
  };

  /* ----------------------------- SUCCESS ----------------------------- */
  if (status === "success") {
    return (
      <div className="w-full max-w-md mx-auto text-center" role="status" aria-live="polite">
        <motion.div
          initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="relative mx-auto w-28 h-28 mb-8"
        >
          {/* Burst rings */}
          {!reduceMotion && (
            <>
              <motion.span
                className="absolute inset-0 rounded-full border border-[#9B6BFF]/50"
                initial={{ scale: 0.8, opacity: 0.9 }}
                animate={{ scale: 1.9, opacity: 0 }}
                transition={{ duration: 1.4, ease: "easeOut" }}
              />
              <motion.span
                className="absolute inset-0 rounded-full border border-[#6D4AFF]/40"
                initial={{ scale: 0.8, opacity: 0.8 }}
                animate={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 1.4, ease: "easeOut", delay: 0.18 }}
              />
            </>
          )}
          <div
            className="absolute inset-0 rounded-full flex items-center justify-center shadow-[0_0_80px_rgba(155,107,255,0.55)]"
            style={{ background: "linear-gradient(135deg,#6D4AFF,#9B6BFF)" }}
          >
            <HeartBeat />
          </div>
        </motion.div>

        <motion.h2
          initial={reduceMotion ? false : { y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="text-3xl sm:text-4xl font-extrabold font-display text-[var(--obiren-text)] tracking-tight"
        >
          You&apos;re on the list.
        </motion.h2>
        <motion.p
          initial={reduceMotion ? false : { y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.28 }}
          className="mt-4 text-sm sm:text-base text-[var(--obiren-text-muted)] leading-relaxed max-w-sm mx-auto"
        >
          We&apos;ll reach out as launch approaches in your region. Until then, take care of
          yourself. That&apos;s the whole point.
        </motion.p>
      </div>
    );
  }

  /* ------------------------- IDLE / ACTIVE --------------------------- */
  return (
    <div className="w-full max-w-md mx-auto">
      {/* Email input */}
      <div className="relative">
        <label htmlFor="wl-email-hero" className="sr-only">
          Email address
        </label>
        <input
          id="wl-email-hero"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="your@email.com"
          value={email}
          maxLength={320}
          disabled={status === "submitting"}
          onChange={(e) => handleEmailChange(e.target.value)}
          aria-invalid={status === "error" && !emailValid}
          aria-describedby="wl-error-hero"
          className="w-full h-16 rounded-full pl-7 pr-7 text-base sm:text-lg text-[var(--obiren-text)] bg-[var(--obiren-surface)] border border-[var(--obiren-border)] placeholder-[var(--obiren-text-faint)] focus:outline-none focus:border-[#9B6BFF] focus:ring-4 focus:ring-[#9B6BFF]/20 transition-all text-center tracking-wide"
        />
        {/* Wake-up glow on the input */}
        <AnimatePresence>
          {awake && (
            <motion.span
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute -inset-1 rounded-full"
              style={{ boxShadow: "0 0 40px rgba(155,107,255,0.25)" }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Hold-to-join button */}
      <div className="mt-7 flex flex-col items-center gap-4">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            beginHold();
          }}
          onKeyDown={handleKeyDown}
          onKeyUp={(e) => {
            if (e.key === "Enter") stopHold();
          }}
          onBlur={stopHold}
          disabled={status === "submitting"}
          aria-label={
            emailValid
              ? "Hold to join the waitlist"
              : "Enter a valid email, then hold to join the waitlist"
          }
          aria-describedby="wl-hold-hint"
          className="relative w-28 h-28 rounded-full select-none touch-none focus:outline-none focus-visible:ring-4 focus-visible:ring-[#9B6BFF]/60 focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--obiren-bg)] disabled:opacity-60"
        >
          {/* Progress ring */}
          <svg className="absolute -inset-2.5 w-[124px] h-[124px] -rotate-90" viewBox="0 0 124 124" aria-hidden="true">
            <circle cx="62" cy="62" r="56" fill="none" stroke="var(--obiren-border)" strokeWidth="3" />
            <motion.circle
              cx="62"
              cy="62"
              r="56"
              fill="none"
              stroke="url(#wlRing)"
              strokeWidth="4"
              strokeLinecap="round"
              style={{ pathLength: progress }}
            />
            <defs>
              <linearGradient id="wlRing" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6D4AFF" />
                <stop offset="100%" stopColor="#9B6BFF" />
              </linearGradient>
            </defs>
          </svg>

          {/* Heart core */}
          <motion.span
            className="absolute inset-0 rounded-full flex items-center justify-center overflow-hidden"
            animate={
              reduceMotion
                ? { scale: holding ? 0.94 : 1 }
                : holding
                  ? { scale: 0.92 }
                  : { scale: [1, 1.045, 1] }
            }
            transition={
              reduceMotion
                ? { duration: 0.15 }
                : holding
                  ? { duration: 0.2 }
                  : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
            }
            style={{
              background: "linear-gradient(135deg,#6D4AFF 0%,#9B6BFF 100%)",
              boxShadow: holding
                ? "0 0 90px rgba(155,107,255,0.75)"
                : "0 0 45px rgba(109,74,255,0.4)",
            }}
          >
            {/* Fill-from-bottom effect while holding */}
            <motion.span
              aria-hidden="true"
              className="absolute inset-0 bg-white/25"
              style={{ originY: 1 }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: progress }}
              transition={{ duration: 0.05 }}
            />
            <HeartGlyph holding={holding} reduceMotion={!!reduceMotion} />
          </motion.span>
        </button>

        <div id="wl-hold-hint" aria-live="polite" className="text-center min-h-[44px]">
          <AnimatePresence mode="wait">
            {status === "submitting" ? (
              <motion.p
                key="submitting"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center gap-2 text-sm font-semibold text-[#C9BCFF] light:text-[#6D4AFF]"
              >
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Securing your spot…
              </motion.p>
            ) : !awake ? (
              <motion.p
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm text-[var(--obiren-text-faint)]"
              >
                Enter your email to wake it up
              </motion.p>
            ) : !emailValid ? (
              <motion.p
                key="invalid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm text-[var(--obiren-text-muted)]"
              >
                That email doesn&apos;t look complete yet
              </motion.p>
            ) : (
              <motion.p
                key="ready"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm font-semibold text-[#C9BCFF] light:text-[#6D4AFF]"
              >
                {holding ? "Keep holding…" : "Press and hold the heart to join"}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Error */}
        <AnimatePresence>
          {status === "error" && errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
              className="flex items-start gap-2 rounded-2xl px-4 py-3 text-xs font-semibold bg-red-500/10 border border-red-400/30 text-red-200 light:text-red-700 w-full"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span className="flex-1">
                {errorMessage}{" "}
                <button type="button" onClick={reset} className="underline underline-offset-2">
                  Try again
                </button>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Privacy line */}
      <p className="mt-8 text-center text-[11px] leading-relaxed text-[var(--obiren-text-faint)]">
        Your email is only used for launch updates. Never sold, never shared. Opt out anytime.
      </p>
    </div>
  );
}

/* ------------------------------ confetti ------------------------------ */

/** Star-shaped burst in brand colors, fired from the heart button. */
function fireConfetti() {
  const colors = ["#6D4AFF", "#9B6BFF", "#C9BCFF", "#E8DFFF", "#FFFFFF"];
  const defaults: confetti.Options = {
    origin: { y: 0.62 },
    colors,
    shapes: ["star"],
    ticks: 220,
    gravity: 0.9,
    scalar: 1.15,
    disableForReducedMotion: true,
  };
  // Center burst plus two side cannons for a full celebratory sweep.
  confetti({ ...defaults, particleCount: 90, spread: 75, startVelocity: 42 });
  setTimeout(() => confetti({ ...defaults, particleCount: 45, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } }), 140);
  setTimeout(() => confetti({ ...defaults, particleCount: 45, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } }), 240);
}

/* ------------------------------ glyphs ------------------------------ */

function HeartBeat() {
  const reduce = useReducedMotion();
  return (
    <motion.svg
      width="44"
      height="44"
      viewBox="0 0 24 24"
      fill="white"
      aria-hidden="true"
      animate={reduce ? {} : { scale: [1, 1.14, 1, 1.08, 1] }}
      transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </motion.svg>
  );
}

function HeartGlyph({ holding, reduceMotion }: { holding: boolean; reduceMotion: boolean }) {
  return (
    <motion.svg
      width="42"
      height="42"
      viewBox="0 0 24 24"
      fill="white"
      aria-hidden="true"
      animate={reduceMotion ? {} : holding ? { scale: [1, 1.22, 1, 1.18, 1] } : { scale: 1 }}
      transition={{ duration: 0.6, repeat: holding ? Infinity : 0, ease: "easeInOut" }}
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </motion.svg>
  );
}
