import Link from "next/link";
import { ArrowRight, ArrowUpRight, Compass, LifeBuoy } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

/**
 * Obiren's public 404.
 *
 * Reached by any unknown address on obiren.co. It stays deliberately calm: no
 * search box, no fabricated suggestions, and no link to the internal console —
 * the operations portal is never advertised from a public surface.
 */
export default function NotFound() {
  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-hidden bg-white text-[#17131D]">
      {/* Soft brand light behind the card. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 subtle-grid-pattern opacity-60" />
        <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(109,74,255,0.18),rgba(244,241,255,0)_70%)] blur-2xl" />
        <div className="absolute -bottom-48 -right-32 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(155,107,255,0.16),rgba(244,241,255,0)_70%)] blur-2xl animate-pulse-glow" />
      </div>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg" aria-label="Obiren home">
          <BrandLogo pfp height={30} priority />
          <span className="text-[15px] font-semibold tracking-tight">Obiren</span>
        </Link>
        <Link
          href="/"
          className="rounded-full border border-[#EDE9F2] px-4 py-2 text-[13px] font-medium text-[#5F5867] transition-colors hover:border-[#D8CCFF] hover:text-[#17131D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D4AFF] focus-visible:ring-offset-2"
        >
          Home
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 pb-20 pt-6 text-center sm:px-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#E8DFFF] bg-[#F7F4FF] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6D4AFF]">
          <Compass className="h-3.5 w-3.5" strokeWidth={2.4} />
          Page not found
        </span>

        <p
          aria-hidden
          className="purple-gradient-text mt-6 select-none text-[92px] font-semibold leading-none tracking-[-0.05em] sm:text-[132px]"
        >
          404
        </p>

        <h1 className="mt-4 max-w-xl text-balance font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight sm:text-[32px]">
          This page slipped away.
        </h1>
        <p className="mt-3 max-w-md text-pretty text-[15px] leading-relaxed text-[#5F5867]">
          The address may be mistyped or the page has moved. Nothing about your account or your
          care has changed.
        </p>

        <div className="mt-9 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#6D4AFF] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_18px_35px_-18px_rgba(109,74,255,0.85)] transition-all hover:bg-[#5B3DE0] hover:shadow-[0_22px_45px_-18px_rgba(109,74,255,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D4AFF] focus-visible:ring-offset-2"
          >
            Back to Obiren
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/waitlist"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[#E8DFFF] bg-white px-6 py-3.5 text-sm font-semibold text-[#17131D] transition-colors hover:border-[#C9B6FF] hover:bg-[#F7F4FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D4AFF] focus-visible:ring-offset-2"
          >
            Join the waitlist
            <ArrowUpRight className="h-4 w-4 text-[#6D4AFF]" />
          </Link>
        </div>

        <div className="mt-12 w-full max-w-lg rounded-3xl border border-[#EDE9F2] bg-white/70 p-5 text-left shadow-[0_24px_60px_-40px_rgba(43,33,66,0.35)] backdrop-blur sm:p-6">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#F4F1FF] text-[#6D4AFF]">
              <LifeBuoy className="h-4.5 w-4.5" strokeWidth={2.2} />
            </span>
            <div className="space-y-1.5 text-[13px] leading-relaxed text-[#5F5867]">
              <p className="font-semibold text-[#17131D]">Looking for something specific?</p>
              <p>
                Clinicians sign in from the{" "}
                <a
                  href="https://doctors.obiren.co/doctor/login"
                  className="font-semibold text-[#6D4AFF] underline decoration-[#C9B6FF] underline-offset-2 hover:text-[#5B3DE0]"
                >
                  doctor portal
                </a>
                . If you followed a link from your care team, ask them for a fresh one — old links
                expire on purpose.
              </p>
            </div>
          </div>
        </div>
      </div>

      <footer className="mx-auto w-full max-w-6xl px-5 pb-8 text-center text-[11px] text-[#8B8595] sm:px-8">
        © {new Date().getFullYear()} Obiren. Health information on Obiren supports your care; it
        does not replace it.
      </footer>
    </main>
  );
}
