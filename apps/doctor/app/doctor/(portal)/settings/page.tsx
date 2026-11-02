"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, LogOut, Mail, ShieldCheck } from "lucide-react";
import { authApi, doctorApi, DoctorProfileData, setAccessToken } from "@obiren/api-client";
import { Card, ErrorBanner, Loading, SectionTitle, SuccessBanner } from "@/components/ui";

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<DoctorProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      setProfile(await doctorApi.me());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your account.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sendReset = async () => {
    if (!profile?.email) return;
    setSending(true);
    setError("");
    setNotice("");
    try {
      await authApi.forgotPassword(profile.email);
      setNotice(
        "If that address is registered, a reset link has been requested. Email delivery depends on the platform's email provider being configured; if you do not receive it, ask Obiren to trigger the reset for you.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request a password reset.");
    } finally {
      setSending(false);
    }
  };

  const signOut = async () => {
    await authApi.logout().catch(() => undefined);
    setAccessToken(null);
    router.replace("/doctor/login");
  };

  if (loading) return <Loading label="Loading settings…" />;

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-xs text-[#6E6875]">Account, security and notification preferences.</p>
      </div>

      {error && <ErrorBanner message={error} />}
      {notice && <SuccessBanner message={notice} />}

      {profile && (
        <Card className="p-5 space-y-3">
          <SectionTitle title="Account" hint="Managed by Obiren" />
          <dl className="grid sm:grid-cols-2 gap-3 text-[11px]">
            <div className="bg-[#F9F7FC] rounded-xl p-3">
              <dt className="text-[9px] uppercase font-bold text-[#9B94A3]">Email</dt>
              <dd className="font-bold break-all">{profile.email}</dd>
              <dd className="text-[10px] text-[#6E6875]">{profile.emailVerified ? "Verified" : "Not verified"}</dd>
            </div>
            <div className="bg-[#F9F7FC] rounded-xl p-3">
              <dt className="text-[9px] uppercase font-bold text-[#9B94A3]">Timezone</dt>
              <dd className="font-bold">{profile.timeZone}</dd>
              <dd className="text-[10px] text-[#6E6875]">Contact Obiren to change it</dd>
            </div>
            <div className="bg-[#F9F7FC] rounded-xl p-3">
              <dt className="text-[9px] uppercase font-bold text-[#9B94A3]">Account status</dt>
              <dd className="font-bold capitalize">{profile.accountStatus}</dd>
            </div>
            <div className="bg-[#F9F7FC] rounded-xl p-3">
              <dt className="text-[9px] uppercase font-bold text-[#9B94A3]">Verification</dt>
              <dd className="font-bold capitalize">{profile.verificationStatus}</dd>
            </div>
          </dl>
        </Card>
      )}

      <Card className="p-5 space-y-3">
        <SectionTitle title="Password" hint="Obiren staff never see or set your password" />
        <button
          onClick={sendReset}
          disabled={sending}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6C4CF1] text-white text-xs font-bold disabled:opacity-60"
        >
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />} Send password reset link
        </button>
        <p className="text-[10px] text-[#6E6875] flex items-start gap-1.5">
          <Mail className="w-3 h-3 mt-0.5 shrink-0" /> Password resets revoke every existing refresh session on the account.
        </p>
      </Card>

      <Card className="p-5 space-y-3">
        <SectionTitle title="Notifications" hint="In-app events are always recorded" />
        <p className="text-[11px] text-[#6E6875]">
          New bookings, confirmations, cancellations and reschedules raise an in-app notification in this portal. Email or SMS
          delivery uses the platform&apos;s configured provider; a delivery failure never changes an appointment.
        </p>
        <a href="/doctor/notifications" className="text-xs font-bold text-[#6C4CF1]">
          Review your notification feed →
        </a>
      </Card>

      <Card className="p-5 space-y-3">
        <SectionTitle title="Access and security" hint="Server-enforced" />
        <p className="text-[11px] text-[#6E6875] flex items-start gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Every request in this portal is authorised against your clinician role and your own doctor profile. You cannot open
          another doctor&apos;s profile, schedule or appointments, and you only see the patient information an appointment
          requires.
        </p>
        <button
          onClick={signOut}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs font-bold"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign out of this device
        </button>
      </Card>
    </div>
  );
}
