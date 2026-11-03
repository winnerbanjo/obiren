"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import WaitlistSignupForm from "@/components/waitlist/WaitlistSignupForm";
import BrandLogo from "@/components/BrandLogo";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { useTheme } from "@/components/theme/ThemeProvider";
import { track } from "@/lib/analytics";

const WORDS = ["cycle.", "pregnancy.", "records.", "care.", "safety."];

/**
 * Obiren waitlist: one dramatic screen.
 * Dark, calm, cinematic. The email capture IS the page. As the visitor types,
 * rotating words complete the headline; the heart is the join button.
 */
export default function WaitlistPageClient() {
  const [wordIndex, setWordIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    track("waitlist_page_view");
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => setWordIndex((i) => (i + 1) % WORDS.length), 2400);
    return () => clearInterval(id);
  }, [reduceMotion]);

  return (
    <div
      className="relative min-h-screen overflow-hidden font-sans flex flex-col bg-[var(--obiren-bg)] text-[var(--obiren-text)] transition-colors duration-300"
      style={{
        backgroundImage: isDark
          ? "radial-gradient(ellipse 90% 60% at 50% -10%, rgba(109,74,255,0.28) 0%, rgba(14,10,22,0) 60%), radial-gradient(ellipse 60% 45% at 85% 110%, rgba(155,107,255,0.12) 0%, rgba(14,10,22,0) 55%)"
          : "radial-gradient(ellipse 90% 60% at 50% -10%, rgba(109,74,255,0.16) 0%, rgba(250,249,254,0) 60%), radial-gradient(ellipse 60% 45% at 85% 110%, rgba(155,107,255,0.10) 0%, rgba(250,249,254,0) 55%)",
      }}
    >
      {/* Ambient drifting orbs */}
      {!reduceMotion && (
        <>
          <motion.div
            aria-hidden="true"
            className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(109,74,255,0.16) 0%, transparent 70%)" }}
            animate={{ y: [0, 40, 0], x: [0, 24, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden="true"
            className="absolute bottom-[-140px] right-[-100px] w-[520px] h-[520px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(155,107,255,0.12) 0%, transparent 70%)" }}
            animate={{ y: [0, -34, 0] }}
            transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      )}

      {/* ---------------- Header ---------------- */}
      <header className="relative z-10">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo pfp height={38} priority />
            <span className="text-[8px] uppercase font-semibold tracking-[0.22em] text-[var(--obiren-text-muted)] border-l border-[var(--obiren-border)] pl-3 hidden sm:block">
              Health &amp; Safety
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--obiren-surface-2)] border border-[var(--obiren-border)] text-[var(--obiren-text-muted)] whitespace-nowrap max-sm:hidden">
              <span className="w-1.5 h-1.5 rounded-full bg-[#38B26C]" aria-hidden="true" />
              Early access · UK · US · NG · GH
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--obiren-surface-2)] border border-[var(--obiren-border)] text-[var(--obiren-text-muted)] whitespace-nowrap sm:hidden">
              <span className="w-1.5 h-1.5 rounded-full bg-[#38B26C]" aria-hidden="true" />
              Early access
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ---------------- Center stage ---------------- */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-5 sm:px-8 py-12">
        <div className="w-full max-w-2xl text-center">
          {/* Positioning line */}
          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-[11px] sm:text-xs uppercase font-bold tracking-[0.28em] text-[#9B6BFF] mb-7"
          >
            Women&apos;s health, connected
          </motion.p>

          {/* Headline with rotating word */}
          <h1 className="text-4xl sm:text-6xl font-extrabold font-display tracking-tight leading-[1.06] min-h-[2.3em] sm:min-h-[1.25em]">
            <span className="text-[var(--obiren-text)]/90">Your </span>
            <span className="relative inline-block min-w-[4.6em] sm:min-w-[5.4em] text-left align-top">
              <AnimatePresence mode="wait">
                <motion.span
                  key={WORDS[wordIndex]}
                  initial={reduceMotion ? false : { y: "0.32em", opacity: 0, filter: "blur(6px)" }}
                  animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                  exit={reduceMotion ? { opacity: 0 } : { y: "-0.28em", opacity: 0, filter: "blur(6px)" }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  className="purple-gradient-text inline-block"
                >
                  {WORDS[wordIndex]}
                </motion.span>
              </AnimatePresence>
            </span>
            <br className="hidden sm:block" />
            <span className="text-[var(--obiren-text)]/90"> finally in one place.</span>
          </h1>

          <motion.p
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.7 }}
            className="mt-6 text-sm sm:text-lg text-[var(--obiren-text-muted)] leading-relaxed max-w-xl mx-auto"
          >
            Obiren brings your cycle, pregnancy, records, care and safety together in one calm,
            private space built for women. Be first when doors open.
          </motion.p>

          {/* The interactive capture */}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.7 }}
            className="mt-12"
          >
            <WaitlistSignupForm source="obiren_waitlist" />
          </motion.div>
        </div>
      </main>

    </div>
  );
}
