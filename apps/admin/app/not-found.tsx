import Link from "next/link";
import { ArrowLeft, LockKeyhole, SearchX } from "lucide-react";

/**
 * Branded 404 for the internal console.
 *
 * Nothing here advertises the console: the page is reached only by someone who
 * typed a console address they already know, so it offers a single way back and
 * no links to public product surfaces.
 */
export default function NotFound() {
  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#F7F4FF] px-5 py-16 text-[#17131D]">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(108,76,241,0.18),rgba(247,244,255,0)_70%)] blur-2xl" />
        <div className="absolute -bottom-40 -right-24 h-[340px] w-[340px] rounded-full bg-[radial-gradient(circle,rgba(155,107,255,0.16),rgba(247,244,255,0)_70%)] blur-2xl" />
      </div>

      <div className="w-full max-w-lg rounded-3xl border border-[#E8E0FF] bg-white p-8 shadow-[0_30px_70px_-45px_rgba(23,19,29,0.45)] sm:p-10">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.png"
            alt=""
            width={34}
            height={34}
            className="rounded-[22%]"
            aria-hidden="true"
          />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6C4CF1]">
              Obiren Admin
            </p>
            <p className="text-xs text-[#6E6875]">Internal operations console</p>
          </div>
        </div>

        <p className="mt-8 flex items-baseline gap-3">
          <span className="text-[64px] font-bold leading-none tracking-tight text-[#6C4CF1]">404</span>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9B94A3]">
            Not found
          </span>
        </p>

        <h1 className="mt-4 text-xl font-bold tracking-tight sm:text-2xl">
          This screen isn&apos;t part of the console.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#6E6875]">
          The address may be mistyped, or the section was renamed. Nothing was changed by visiting
          this page.
        </p>

        <div className="mt-7 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/user"
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#6C4CF1] px-5 text-sm font-bold text-white transition-colors hover:bg-[#5B3DE0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C4CF1] focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to the console
          </Link>
          <span className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-[#E8E0FF] px-5 text-sm font-semibold text-[#6E6875]">
            <SearchX className="h-4 w-4" aria-hidden="true" />
            Check the address
          </span>
        </div>

        <p className="mt-6 flex items-start gap-2 border-t border-[#F1EDF5] pt-5 text-[11px] leading-relaxed text-[#918A98]">
          <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Access to every console screen requires an authenticated administrator role and is recorded
          in the audit log.
        </p>
      </div>
    </main>
  );
}
