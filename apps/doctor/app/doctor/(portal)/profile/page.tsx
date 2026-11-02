"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Loader2, Save, ShieldAlert } from "lucide-react";
import { doctorApi, DoctorProfileData } from "@obiren/api-client";
import { Card, ErrorBanner, Loading, SectionTitle, SuccessBanner } from "@/components/ui";

const CURRENCY_BY_COUNTRY: Record<string, string> = { NG: "NGN", GH: "GHS", GB: "GBP", US: "USD" };
const listToText = (values: string[]) => values.join(", ");
const textToList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export default function ProfilePage() {
  const [profile, setProfile] = useState<DoctorProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [form, setForm] = useState({
    bio: "",
    languages: "",
    specialties: "",
    certifications: "",
    licenceNumber: "",
    yearsOfExperience: "",
    clinicName: "",
    clinicAddress: "",
    phoneNumber: "",
    photoUrl: "",
  });

  const apply = (data: DoctorProfileData) => {
    setProfile(data);
    setForm({
      bio: data.bio ?? "",
      languages: listToText(data.languages),
      specialties: listToText(data.specialties),
      certifications: listToText(data.certifications),
      licenceNumber: data.licenceNumber ?? "",
      yearsOfExperience: data.yearsOfExperience !== null ? String(data.yearsOfExperience) : "",
      clinicName: data.clinicName ?? "",
      clinicAddress: data.clinicAddress ?? "",
      phoneNumber: data.phoneNumber ?? "",
      photoUrl: data.photoUrl ?? "",
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      apply(await doctorApi.me());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload: Record<string, unknown> = {
        bio: form.bio.trim() || null,
        languages: textToList(form.languages),
        specialties: textToList(form.specialties),
        certifications: textToList(form.certifications),
        clinicName: form.clinicName.trim() || null,
        clinicAddress: form.clinicAddress.trim() || null,
        phoneNumber: form.phoneNumber.trim() || null,
      };
      if (form.licenceNumber.trim()) payload.licenceNumber = form.licenceNumber.trim();
      if (form.yearsOfExperience !== "") payload.yearsOfExperience = Number(form.yearsOfExperience);
      if (form.photoUrl.trim()) payload.photoUrl = form.photoUrl.trim();

      const result = await doctorApi.updateMe(payload);
      apply(result.profile);
      setNotice(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading label="Loading your profile…" />;
  if (!profile) {
    return (
      <div className="space-y-3">
        <ErrorBanner message={error || "Profile unavailable."} />
        <button onClick={load} className="text-xs font-bold text-[#6C4CF1]">Try again</button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold">My profile</h1>
        <p className="text-xs text-[#6E6875]">
          This is what patients see in the Obiren app. Credentials and verification are checked by Obiren.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}
      {notice && <SuccessBanner message={notice} />}

      <Card className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold">{profile.displayName}</p>
            <p className="text-[11px] text-[#6E6875]">{profile.professionalTitle || profile.profession}</p>
            <p className="text-[11px] text-[#6E6875]">{profile.email}</p>
          </div>
          <div className="text-right space-y-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F5F2FF] text-[#6C4CF1]">
              <BadgeCheck className="w-3 h-3" /> {profile.verificationStatus}
            </span>
            <p className="text-[10px] text-[#6E6875]">
              {profile.listed ? "Listed in discovery" : "Hidden from discovery"}
            </p>
            <p className="text-[10px] text-[#6E6875]">
              {profile.accountStatus.replace(/_/g, " ")} · {profile.timeZone}
            </p>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-2 text-[10px]">
          {Object.entries(profile.feeBySessionType).map(([type, amount]) => (
            <div key={type} className="bg-[#F9F7FC] rounded-lg p-2">
              <p className="uppercase font-bold text-[#9B94A3]">{type} fee</p>
              <p className="font-bold text-[11px]">
                {typeof amount === "number"
                  ? (amount / 100).toLocaleString("en-NG", {
                      style: "currency",
                      currency: CURRENCY_BY_COUNTRY[profile.countryCode] ?? "NGN",
                    })
                  : "—"}
              </p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[#6E6875]">
          Fees, listing approval, account status and verification are managed by Obiren and cannot be edited here.
        </p>
      </Card>

      <Card className="p-5 space-y-3">
        <SectionTitle title="Public profile" hint="Comma-separate multiple values" />
        <label className="block text-[11px] font-bold space-y-1">
          Biography
          <textarea
            rows={4}
            maxLength={2000}
            value={form.bio}
            onChange={(event) => setForm({ ...form, bio: event.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-[#E7E2EB] text-xs font-normal focus:outline-none focus:ring-2 focus:ring-[#6C4CF1]/30"
            placeholder="Your experience, approach and the patients you support."
          />
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { key: "languages", label: "Languages" },
            { key: "specialties", label: "Areas of expertise" },
            { key: "certifications", label: "Qualifications / certifications" },
            { key: "clinicName", label: "Clinic or hospital" },
            { key: "clinicAddress", label: "Practice address" },
            { key: "phoneNumber", label: "Contact phone" },
            { key: "photoUrl", label: "Profile photo URL" },
            { key: "yearsOfExperience", label: "Years of experience" },
          ].map((field) => (
            <label key={field.key} className="block text-[11px] font-bold space-y-1">
              {field.label}
              <input
                value={form[field.key as keyof typeof form]}
                onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                type={field.key === "yearsOfExperience" ? "number" : "text"}
                min={field.key === "yearsOfExperience" ? 0 : undefined}
                max={field.key === "yearsOfExperience" ? 70 : undefined}
                className="w-full px-3 py-2 rounded-xl border border-[#E7E2EB] text-xs font-normal focus:outline-none focus:ring-2 focus:ring-[#6C4CF1]/30"
              />
            </label>
          ))}
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <SectionTitle title="Credentials" hint="Changing these triggers admin re-verification" />
        <label className="block text-[11px] font-bold space-y-1">
          Licence / registration number
          <input
            value={form.licenceNumber}
            onChange={(event) => setForm({ ...form, licenceNumber: event.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-[#E7E2EB] text-xs font-normal"
          />
        </label>
        {profile.credentialReviewRequired && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            A credential change is awaiting Obiren review. Your profile stays hidden from patient discovery until it is approved.
          </div>
        )}
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6C4CF1] text-white text-xs font-bold disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save profile
        </button>
      </Card>
    </div>
  );
}
