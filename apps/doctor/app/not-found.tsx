import Link from "next/link";
import { ArrowLeft, CalendarDays, Compass } from "lucide-react";

/** Branded 404 for the clinician portal. */
export default function NotFound() {
  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-white px-5 py-16 text-[#17131D]">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(108,76,241,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(108,76,241,0.05)_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="absolute -top-40 left-1/2 h-[460px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(108,76,241,0.18),rgba(255,255,255,0)_70%)] blur-2xl" />
      </div>

      <div className="w-full max-w-lg text-center">
        <div className="mx-auto flex w-fit items-center gap-2.5 rounded-full border border-[#EDE9F2] bg-white px-3 py-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/obiren-app-icon.png"
            alt=""
            width={22}
            height={22}
            className="rounded-[24%]"
            aria-hidden="true"
          />
          <span className="text-[12px] font-semibold tracking-tight">Obiren for clinicians</span>
        </div>

        <p className="mt-8 flex items-baseline justify-center gap-3">
          <span className="bg-[linear-gradient(135deg,#6C4CF1,#9B6BFF)] bg-clip-text text-[92px] font-semibold leading-none tracking-[-0.05em] text-transparent sm:text-[120px]">
            404
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9B94A3]">
            Not found
          </span>
        </p>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          We couldn&apos;t find that screen.
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-[#5F5867]">
          The link may be outdated, or the page has moved. Your appointments and availability are
          untouched.
        </p>

        <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3 sm:flex-row">
          <Link
            href="/doctor/dashboard"
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#6C4CF1] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#5B3DE0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C4CF1] focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Dashboard
          </Link>
          <Link
            href="/doctor/appointments"
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[#DDD7E4] px-5 text-sm font-semibold text-[#17131D] transition-colors hover:border-[#17131D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C4CF1] focus-visible:ring-offset-2"
          >
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Appointments
          </Link>
        </div>

        <p className="mt-8 inline-flex items-center gap-2 text-xs text-[#9B94A3]">
          <Compass className="h-3.5 w-3.5" aria-hidden="true" />
          Signed out, or not yet activated?{" "}
          <Link href="/doctor/login" className="font-semibold text-[#6C4CF1] hover:text-[#5B3DE0]">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
