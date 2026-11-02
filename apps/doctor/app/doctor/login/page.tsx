"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Heart, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { authApi } from "@obiren/api-client";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (params.get("activated") === "1") setEmail(params.get("email") || "");
  }, [params]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await authApi.login(email.trim(), password);
      const roles = (result as { user?: { roles?: string[] } }).user?.roles ?? [];
      if (!roles.includes("clinician")) {
        await authApi.logout().catch(() => undefined);
        throw new Error("This account does not have doctor access. Use the Obiren patient app instead, or contact Obiren to request a doctor account.");
      }
      router.replace("/doctor/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-[#2A1A5E] via-[#4B2EA8] to-[#6C4CF1] text-white p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <p className="text-lg font-bold">Obiren</p>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/60">Doctor Portal</p>
          </div>
        </div>
        <div className="space-y-4 max-w-md">
          <h1 className="text-3xl font-bold leading-tight">Your practice, in one calm place.</h1>
          <p className="text-sm text-white/70 leading-relaxed">
            Review appointments booked through the Obiren app, confirm or reschedule requests, and publish the hours
            patients can book you.
          </p>
          <ul className="space-y-2 text-xs text-white/80">
            <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Only your own appointments, enforced server-side.</li>
            <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Availability powers patient booking in real time.</li>
            <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Every status change is recorded and auditable.</li>
          </ul>
        </div>
        <p className="text-[10px] text-white/40">Secure clinician access · Obiren Health</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#6C4CF1] text-white flex items-center justify-center">
              <Heart className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold">Obiren</p>
              <p className="text-[10px] uppercase tracking-widest font-bold text-[#6C4CF1]">Doctor Portal</p>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold">Sign in</h2>
            <p className="text-xs text-[#6E6875] mt-1">Use the email Obiren invited you with.</p>
          </div>

          {params.get("activated") === "1" && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl">
              Account activated. Sign in with the password you just set.
            </div>
          )}
          {error && (
            <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-[11px] font-bold text-[#17131D] mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#9B94A3] absolute left-3 top-3" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E7E2EB] text-xs focus:outline-none focus:ring-2 focus:ring-[#6C4CF1]/30 focus:border-[#6C4CF1]"
                  placeholder="doctor@clinic.com"
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="block text-[11px] font-bold text-[#17131D] mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#9B94A3] absolute left-3 top-3" />
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E7E2EB] text-xs focus:outline-none focus:ring-2 focus:ring-[#6C4CF1]/30 focus:border-[#6C4CF1]"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-xl bg-[#6C4CF1] text-white text-xs font-bold disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Sign in to portal
            </button>
          </form>

          <p className="text-[11px] text-[#6E6875]">
            Invited but no password yet?{" "}
            <Link href="/doctor/activate" className="font-bold text-[#6C4CF1]">Activate your account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DoctorLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LoginInner />
    </Suspense>
  );
}
