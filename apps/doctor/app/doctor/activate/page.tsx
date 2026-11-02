"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Heart, Loader2, Lock } from "lucide-react";
import { authApi } from "@obiren/api-client";

function ActivateInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [token, setToken] = useState(params.get("token") || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ email: string } | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Use at least 8 characters, including one uppercase letter and one number.");
      return;
    }
    setBusy(true);
    try {
      const result = await authApi.activateDoctor(token.trim(), password);
      setDone({ email: result.email });
      setTimeout(() => router.replace(`/doctor/login?activated=1&email=${encodeURIComponent(result.email)}`), 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed. The invitation may have expired — ask Obiren to resend it.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-[#6C4CF1] text-white flex items-center justify-center">
            <Heart className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-bold">Obiren</p>
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#6C4CF1]">Doctor Portal</p>
          </div>
        </div>

        <div className="bg-white border border-[#E7E2EB] rounded-3xl p-6 space-y-5">
          <div>
            <h1 className="text-lg font-bold">Activate your account</h1>
            <p className="text-xs text-[#6E6875] mt-1">
              Set your own password using the one-time invitation token Obiren sent you. Nobody at Obiren can see it.
            </p>
          </div>

          {done ? (
            <div className="space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              <p className="text-xs font-bold">Account activated for {done.email}.</p>
              <p className="text-[11px] text-[#6E6875]">Redirecting to sign in…</p>
            </div>
          ) : (
            <>
              {error && (
                <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl">
                  {error}
                </div>
              )}
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label htmlFor="token" className="block text-[11px] font-bold mb-1.5">Invitation token</label>
                  <input
                    id="token"
                    required
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    placeholder="Paste the token from your invitation"
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E7E2EB] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#6C4CF1]/30 focus:border-[#6C4CF1]"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-[11px] font-bold mb-1.5">New password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#9B94A3] absolute left-3 top-3" />
                    <input
                      id="password"
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E7E2EB] text-xs focus:outline-none focus:ring-2 focus:ring-[#6C4CF1]/30 focus:border-[#6C4CF1]"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="confirm" className="block text-[11px] font-bold mb-1.5">Confirm password</label>
                  <input
                    id="confirm"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E7E2EB] text-xs focus:outline-none focus:ring-2 focus:ring-[#6C4CF1]/30 focus:border-[#6C4CF1]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2.5 rounded-xl bg-[#6C4CF1] text-white text-xs font-bold disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />} Activate account
                </button>
              </form>
            </>
          )}

          <p className="text-[11px] text-[#6E6875]">
            Already activated? <Link href="/doctor/login" className="font-bold text-[#6C4CF1]">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DoctorActivatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <ActivateInner />
    </Suspense>
  );
}
