"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Plus,
  RefreshCw,
  Search,
  Stethoscope,
  X,
} from "lucide-react";
import { adminApi, ApiError } from "@obiren/api-client";

/**
 * Doctors section of the EXISTING Admin.
 *
 * This is not a second admin product: it reuses the Admin session, navigation
 * and API. Every row and count comes from the real backend. Adding a doctor
 * creates the linked account and sends a single-use activation link — an
 * administrator can never set or view a doctor's password.
 */

const SESSION_TYPES = ["clinic", "audio", "video", "text"] as const;

const EMPTY_FORM = {
  fullName: "",
  email: "",
  phoneNumber: "",
  photoUrl: "",
  professionalTitle: "",
  specialization: "",
  qualifications: "",
  licenceNumber: "",
  yearsOfExperience: "",
  biography: "",
  languages: "English",
  clinicName: "",
  clinicAddress: "",
  countryCode: "NG",
  timeZone: "Africa/Lagos",
  consultationTypes: ["video"] as string[],
  consultationDurationMinutes: "45",
  consultationFeeMajor: "",
  bookingApprovalMode: "instant" as "instant" | "manual",
  verificationStatus: "pending" as "pending" | "verified",
  listed: false,
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  invited: "bg-amber-50 text-amber-700 border-amber-200",
  inactive: "bg-slate-100 text-slate-600 border-slate-200",
  suspended: "bg-red-50 text-red-700 border-red-200",
};

interface InvitationState {
  activationUrl?: string;
  message: string;
  emailDelivered: boolean;
}

/** Absolute Doctor Portal URL for a one-time activation token. */
function doctorActivationUrl(token: string): string {
  const configured = process.env.NEXT_PUBLIC_DOCTOR_PORTAL_URL;
  // In production the portal is its own host. Falling back to this admin origin
  // produced activation links pointing at admin.obiren.co/doctor/activate, which
  // does not exist, whenever the variable was not set at build time.
  const fallback =
    typeof window === "undefined"
      ? ""
      : window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? `${window.location.protocol}//${window.location.hostname}:3003`
        : "https://doctors.obiren.co";
  return `${(configured || fallback).replace(/\/$/, "")}/doctor/activate?token=${encodeURIComponent(token)}`;
}

export default function AdminDoctorsView() {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [listedFilter, setListedFilter] = useState("");
  const [specializationFilter, setSpecializationFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [notice, setNotice] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [invitation, setInvitation] = useState<InvitationState | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [verifyTarget, setVerifyTarget] = useState<any | null>(null);
  const [verifyEvidence, setVerifyEvidence] = useState("");
  const [verifyNote, setVerifyNote] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const limit = 20;

  const load = useCallback(
    async (targetPage = page) => {
      setLoading(true);
      setErrorMsg("");
      try {
        const data = await adminApi.listDoctors({
          q: search.trim() || undefined,
          status: statusFilter || undefined,
          listed: (listedFilter as "true" | "false") || undefined,
          specialization: specializationFilter.trim() || undefined,
          page: targetPage,
          limit,
        });
        setDoctors(data.doctors ?? []);
        setTotal(data.total ?? 0);
        setStatusCounts(data.statusCounts ?? {});
        setPage(data.page ?? targetPage);
      } catch (err) {
        setErrorMsg(
          err instanceof ApiError && err.status === 403
            ? "Your admin role does not grant access to doctor management."
            : err instanceof ApiError
              ? err.message
              : "Could not load doctors.",
        );
      } finally {
        setLoading(false);
      }
    },
    [page, search, statusFilter, listedFilter, specializationFilter],
  );

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, listedFilter, specializationFilter]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormError("");
    setInvitation(null);
    setFormOpen(true);
  };

  const openEdit = async (id: string) => {
    setEditingId(id);
    setFormError("");
    setInvitation(null);
    setFormOpen(true);
    try {
      const doctor: any = await adminApi.getDoctor(id);
      setForm({
        fullName: doctor.displayName ?? "",
        email: doctor.email ?? "",
        phoneNumber: doctor.phoneNumber ?? "",
        photoUrl: doctor.photoUrl ?? "",
        professionalTitle: doctor.professionalTitle ?? "",
        specialization: doctor.specialization ?? "",
        qualifications: (doctor.certifications ?? []).join(", "),
        licenceNumber: doctor.licenceNumber ?? "",
        yearsOfExperience: doctor.yearsOfExperience != null ? String(doctor.yearsOfExperience) : "",
        biography: doctor.bio ?? "",
        languages: (doctor.languages ?? []).join(", "),
        clinicName: doctor.clinicName ?? "",
        clinicAddress: doctor.clinicAddress ?? "",
        countryCode: doctor.countryCode ?? "NG",
        timeZone: doctor.timeZone ?? "Africa/Lagos",
        consultationTypes: Object.keys(doctor.feeBySessionType ?? {}).length
          ? Object.keys(doctor.feeBySessionType)
          : ["video"],
        consultationDurationMinutes: String(doctor.consultationDurationMinutes ?? 45),
        consultationFeeMajor: doctor.feeBySessionType
          ? String(Math.max(0, ...Object.values(doctor.feeBySessionType as Record<string, number>)) / 100)
          : "",
        bookingApprovalMode: (doctor.bookingApprovalMode as "instant" | "manual") ?? "instant",
        verificationStatus: (doctor.verificationStatus as "pending" | "verified") ?? "pending",
        listed: Boolean(doctor.listed),
      });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not load the doctor.");
    }
  };

  const payload = () => ({
    fullName: form.fullName.trim(),
    ...(editingId ? {} : { email: form.email.trim() }),
    phoneNumber: form.phoneNumber.trim() || undefined,
    photoUrl: form.photoUrl.trim() || undefined,
    professionalTitle: form.professionalTitle.trim(),
    specialization: form.specialization.trim(),
    qualifications: form.qualifications.split(",").map((item) => item.trim()).filter(Boolean),
    licenceNumber: form.licenceNumber.trim() || undefined,
    yearsOfExperience: form.yearsOfExperience ? Number(form.yearsOfExperience) : undefined,
    biography: form.biography.trim() || undefined,
    languages: form.languages.split(",").map((item) => item.trim()).filter(Boolean),
    clinicName: form.clinicName.trim() || undefined,
    clinicAddress: form.clinicAddress.trim() || undefined,
    countryCode: form.countryCode,
    timeZone: form.timeZone,
    consultationTypes: form.consultationTypes,
    consultationDurationMinutes: Number(form.consultationDurationMinutes),
    consultationFeeMinor: form.consultationFeeMajor ? Math.round(Number(form.consultationFeeMajor) * 100) : undefined,
    bookingApprovalMode: form.bookingApprovalMode,
  });

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    setNotice("");
    try {
      if (editingId) {
        await adminApi.updateDoctor(editingId, {
          ...payload(),
          listed: form.listed,
        });
        setNotice("Doctor profile updated.");
        setFormOpen(false);
        await load(page);
      } else {
        const result = await adminApi.createDoctor({
          ...payload(),
          verificationStatus: form.verificationStatus,
          listed: form.listed,
        });
        const inv = result.invitation;
        setInvitation({
          message: inv.message,
          emailDelivered: inv.emailDelivered,
          activationUrl: inv.activationToken ? doctorActivationUrl(inv.activationToken) : undefined,
        });
        await load(1);
      }
    } catch (err) {
      setFormError(
        err instanceof ApiError && err.fields
          ? Object.values(err.fields)[0] || err.message
          : err instanceof ApiError
            ? err.message
            : "Could not save the doctor.",
      );
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (id: string, status: "active" | "inactive" | "suspended", reason?: string) => {
    setActingId(id);
    setErrorMsg("");
    setNotice("");
    try {
      await adminApi.setDoctorStatus(id, status, reason);
      setNotice(`Doctor marked ${status}.`);
      setSuspendTarget(null);
      setSuspendReason("");
      await load(page);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Could not update the doctor.");
    } finally {
      setActingId(null);
    }
  };

  const verify = async () => {
    if (!verifyTarget) return;
    setActingId(verifyTarget.id);
    setVerifyError("");
    setErrorMsg("");
    setNotice("");
    try {
      await adminApi.verifyClinician(verifyTarget.id, {
        verificationStatus: "verified",
        evidenceRef: verifyEvidence.trim(),
        note: verifyNote.trim() || undefined,
        // Never list a doctor who has not taken control of their account yet.
        active: verifyTarget.status === "active",
      });
      setNotice(`${verifyTarget.displayName} verified. ${verifyTarget.status === "active" ? "The profile can now be listed." : "They become bookable after activating their account and listing the profile."}`);
      setVerifyTarget(null);
      setVerifyEvidence("");
      setVerifyNote("");
      await load(page);
    } catch (err) {
      setVerifyError(err instanceof ApiError ? err.message : "Could not record the verification decision.");
    } finally {
      setActingId(null);
    }
  };

  const resendInvite = async (id: string) => {
    setActingId(id);
    setErrorMsg("");
    setNotice("");
    try {
      const result = await adminApi.inviteDoctor(id);
      setInvitation({
        message: result.message,
        emailDelivered: result.emailDelivered,
        activationUrl: result.activationToken ? doctorActivationUrl(result.activationToken) : undefined,
      });
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Could not reissue the invitation.");
    } finally {
      setActingId(null);
    }
  };

  const copyActivation = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Activation link copied. Share it only with the doctor and note that it expires in 7 days.");
    } catch {
      setNotice("Copy failed — select the link and copy it manually.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-[#17131D] flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-[#6C4CF1]" /> Doctors
          </h2>
          <p className="text-xs text-[#6E6875] mt-1">
            Add and manage doctor accounts. Doctors configure their own availability and manage appointments in the Doctor Portal.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white text-xs font-bold rounded-xl shadow-md"
        >
          <Plus className="w-4 h-4" /> Add Doctor
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(["active", "invited", "inactive", "suspended"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(statusFilter === status ? "" : status)}
            className={`text-left p-4 rounded-2xl border bg-white transition-all ${
              statusFilter === status ? "border-[#6C4CF1] shadow-md" : "border-[#E7E2EB] hover:border-[#C9BEF5]"
            }`}
          >
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#6E6875]">{status}</span>
            <span className="block text-2xl font-bold font-display text-[#17131D] mt-1">{statusCounts[status] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#918A98] absolute left-3.5 top-3" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") load(1);
            }}
            placeholder="Search name, email or licence number"
            className="w-full pl-10 pr-3 py-2.5 bg-white border border-[#E7E2EB] rounded-xl text-xs font-semibold focus:outline-none focus:border-[#6C4CF1]"
          />
        </div>
        <input
          value={specializationFilter}
          onChange={(event) => setSpecializationFilter(event.target.value)}
          placeholder="Filter by specialization"
          aria-label="Filter by specialization"
          className="px-3 py-2.5 bg-white border border-[#E7E2EB] rounded-xl text-xs font-semibold text-[#17131D] md:w-52"
        />
        <select
          value={listedFilter}
          onChange={(event) => setListedFilter(event.target.value)}
          className="px-3 py-2.5 bg-white border border-[#E7E2EB] rounded-xl text-xs font-bold text-[#17131D]"
        >
          <option value="">Any visibility</option>
          <option value="true">Listed publicly</option>
          <option value="false">Hidden</option>
        </select>
        <button
          onClick={() => load(1)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-[#E7E2EB] rounded-xl text-xs font-bold text-[#17131D]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{errorMsg}</span>
        </div>
      )}
      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> <span>{notice}</span>
        </div>
      )}

      {invitation && (
        <div className="p-4 bg-[#F5F2FF] border border-[#E8E0FF] rounded-2xl text-xs space-y-2">
          <div className="flex items-start justify-between gap-3">
            <p className="font-bold text-[#17131D]">{invitation.message}</p>
            <button onClick={() => setInvitation(null)} className="text-[#6E6875]" aria-label="Dismiss">
              <X className="w-4 h-4" />
            </button>
          </div>
          {!invitation.emailDelivered && (
            <p className="text-amber-700 font-semibold">
              Email delivery is not configured in this environment. The single-use link below is shown once — it is not a password.
            </p>
          )}
          {invitation.activationUrl && (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                readOnly
                value={invitation.activationUrl}
                className="flex-1 px-3 py-2 bg-white border border-[#E8E0FF] rounded-lg font-mono text-[11px]"
                onFocus={(event) => event.currentTarget.select()}
              />
              <button
                onClick={() => copyActivation(invitation.activationUrl!)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#6C4CF1] text-white rounded-lg font-bold"
              >
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bg-white border border-[#E7E2EB] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#FBFAFD] text-[10px] uppercase tracking-wider text-[#6E6875]">
              <tr>
                <th className="px-4 py-3 font-bold">Doctor</th>
                <th className="px-4 py-3 font-bold">Email / phone</th>
                <th className="px-4 py-3 font-bold">Specialization</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">Visibility</th>
                <th className="px-4 py-3 font-bold">Bookings</th>
                <th className="px-4 py-3 font-bold">Created</th>
                <th className="px-4 py-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0ECF4]">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-xs font-bold text-[#6E6875]">
                    Loading doctors…
                  </td>
                </tr>
              )}
              {!loading && doctors.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-xs text-[#6E6875]">
                    No doctors match these filters. Add the first doctor to get started.
                  </td>
                </tr>
              )}
              {!loading &&
                doctors.map((doctor) => (
                  <tr key={doctor.id} className="text-xs hover:bg-[#FBFAFD]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {doctor.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={doctor.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[#E8E0FF] text-[#6C4CF1] font-bold flex items-center justify-center">
                            {(doctor.displayName || "D")[0]}
                          </div>
                        )}
                        <span className="font-bold text-[#17131D]">{doctor.displayName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#6E6875]">
                      <span className="block">{doctor.email}</span>
                      <span className="block text-[11px]">{doctor.phoneNumber || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-[#17131D]">
                      <span className="block">{doctor.specialization || "—"}</span>
                      <span className={`block text-[10px] font-bold ${doctor.verificationStatus === "verified" ? "text-emerald-600" : "text-amber-600"}`}>
                        {doctor.verificationStatus === "verified" ? "Verified" : `${doctor.verificationStatus} verification`}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${STATUS_STYLES[doctor.status]}`}>
                        {doctor.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#17131D]">{doctor.listed ? "Listed" : "Hidden"}</td>
                    <td className="px-4 py-3 font-bold text-[#17131D]">{doctor.bookingCount}</td>
                    <td className="px-4 py-3 text-[#6E6875]">
                      {doctor.createdAt ? new Date(doctor.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button onClick={() => openEdit(doctor.id)} className="px-2.5 py-1.5 rounded-lg border border-[#E7E2EB] font-bold">
                          Edit
                        </button>
                        {doctor.verificationStatus !== "verified" && (
                          <button
                            onClick={() => {
                              setVerifyTarget(doctor);
                              setVerifyEvidence(doctor.licenceNumber ? `licence:${doctor.licenceNumber}` : "");
                              setVerifyNote("");
                              setVerifyError("");
                            }}
                            disabled={actingId === doctor.id}
                            className="px-2.5 py-1.5 rounded-lg bg-[#F5F2FF] text-[#6C4CF1] border border-[#E8E0FF] font-bold disabled:opacity-50"
                          >
                            Verify
                          </button>
                        )}
                        {doctor.status === "invited" && (
                          <button
                            onClick={() => resendInvite(doctor.id)}
                            disabled={actingId === doctor.id}
                            className="px-2.5 py-1.5 rounded-lg border border-[#E8E0FF] text-[#6C4CF1] font-bold disabled:opacity-50"
                          >
                            Resend invite
                          </button>
                        )}
                        {doctor.status !== "active" && doctor.status !== "invited" && (
                          <button
                            onClick={() => changeStatus(doctor.id, "active")}
                            disabled={actingId === doctor.id}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold disabled:opacity-50"
                          >
                            Activate
                          </button>
                        )}
                        {doctor.status === "active" && (
                          <button
                            onClick={() => changeStatus(doctor.id, "inactive")}
                            disabled={actingId === doctor.id}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-bold disabled:opacity-50"
                          >
                            Deactivate
                          </button>
                        )}
                        {doctor.status !== "suspended" ? (
                          <button
                            onClick={() => setSuspendTarget(doctor.id)}
                            disabled={actingId === doctor.id}
                            className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 font-bold disabled:opacity-50"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => changeStatus(doctor.id, "active")}
                            disabled={actingId === doctor.id}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold disabled:opacity-50"
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#F0ECF4] text-xs text-[#6E6875]">
          <span>
            {total} doctor{total === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(page - 1)}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-lg border border-[#E7E2EB] disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-[#17131D]">Page {page}</span>
            <button
              onClick={() => load(page + 1)}
              disabled={page * limit >= total || loading}
              className="p-1.5 rounded-lg border border-[#E7E2EB] disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {suspendTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-[#17131D]">Suspend doctor</h3>
            <p className="text-xs text-[#6E6875]">
              Suspension blocks sign-in, revokes active sessions and hides the doctor from discovery. A reason is required and recorded.
            </p>
            <textarea
              value={suspendReason}
              onChange={(event) => setSuspendReason(event.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-[#E7E2EB] rounded-xl text-xs"
              placeholder="Reason (required)"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setSuspendTarget(null)} className="px-3 py-2 text-xs font-bold rounded-xl border border-[#E7E2EB]">
                Cancel
              </button>
              <button
                onClick={() => changeStatus(suspendTarget, "suspended", suspendReason.trim())}
                disabled={suspendReason.trim().length < 3 || actingId === suspendTarget}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-red-600 text-white disabled:opacity-50"
              >
                Suspend doctor
              </button>
            </div>
          </div>
        </div>
      )}

      {verifyTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <div>
              <h3 className="font-bold text-[#17131D]">Verify {verifyTarget.displayName}</h3>
              <p className="text-xs text-[#6E6875] mt-1">
                Verification is an audited decision backed by stored evidence. Only verified, active and listed doctors appear
                in patient discovery.
              </p>
            </div>
            {verifyError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl">{verifyError}</div>
            )}
            <label className="block text-xs font-bold text-[#17131D]">
              Evidence reference *
              <input
                value={verifyEvidence}
                onChange={(event) => setVerifyEvidence(event.target.value)}
                placeholder="e.g. MDCN licence number or verification record id"
                className="mt-1 w-full px-3 py-2 border border-[#E7E2EB] rounded-xl text-xs font-normal"
              />
            </label>
            <label className="block text-xs font-bold text-[#17131D]">
              Review note
              <textarea
                value={verifyNote}
                onChange={(event) => setVerifyNote(event.target.value)}
                rows={2}
                maxLength={500}
                className="mt-1 w-full px-3 py-2 border border-[#E7E2EB] rounded-xl text-xs font-normal"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setVerifyTarget(null)} className="px-3 py-2 text-xs font-bold rounded-xl border border-[#E7E2EB]">
                Cancel
              </button>
              <button
                onClick={verify}
                disabled={verifyEvidence.trim().length < 3 || actingId === verifyTarget.id}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-[#6C4CF1] text-white disabled:opacity-50"
              >
                {actingId === verifyTarget.id ? "Recording…" : "Record verification"}
              </button>
            </div>
          </div>
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 overflow-y-auto p-4 sm:p-8">
          <form onSubmit={save} className="bg-white rounded-3xl max-w-3xl mx-auto p-6 sm:p-8 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold font-display text-[#17131D]">{editingId ? "Edit doctor" : "Add Doctor"}</h3>
                <p className="text-xs text-[#6E6875]">
                  {editingId
                    ? "Account status is changed from the list. Doctors are never sent a password."
                    : "The doctor receives a single-use activation link and sets their own password."}
                </p>
              </div>
              <button type="button" onClick={() => setFormOpen(false)} aria-label="Close">
                <X className="w-5 h-5 text-[#6E6875]" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl">{formError}</div>
            )}

            <section className="space-y-3">
              <h4 className="text-[10px] uppercase tracking-wider font-bold text-[#6E6875]">Personal details</h4>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Full name *" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} required />
                <Field
                  label="Email *"
                  type="email"
                  value={form.email}
                  onChange={(v) => setForm({ ...form, email: v })}
                  required
                  disabled={Boolean(editingId)}
                />
                <Field label="Phone number" value={form.phoneNumber} onChange={(v) => setForm({ ...form, phoneNumber: v })} />
                <Field label="Profile photo URL" value={form.photoUrl} onChange={(v) => setForm({ ...form, photoUrl: v })} />
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-[10px] uppercase tracking-wider font-bold text-[#6E6875]">Professional details</h4>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Professional title *" value={form.professionalTitle} onChange={(v) => setForm({ ...form, professionalTitle: v })} required />
                <Field label="Specialization *" value={form.specialization} onChange={(v) => setForm({ ...form, specialization: v })} required />
                <Field label="Qualifications (comma separated)" value={form.qualifications} onChange={(v) => setForm({ ...form, qualifications: v })} />
                <Field label="Licence / registration number" value={form.licenceNumber} onChange={(v) => setForm({ ...form, licenceNumber: v })} />
                <Field label="Years of experience" type="number" value={form.yearsOfExperience} onChange={(v) => setForm({ ...form, yearsOfExperience: v })} />
                <Field label="Languages (comma separated)" value={form.languages} onChange={(v) => setForm({ ...form, languages: v })} />
              </div>
              <label className="block text-xs font-bold text-[#17131D]">
                Short biography
                <textarea
                  value={form.biography}
                  onChange={(event) => setForm({ ...form, biography: event.target.value })}
                  rows={3}
                  className="mt-1 w-full px-3 py-2 border border-[#E7E2EB] rounded-xl text-xs font-normal"
                />
              </label>
            </section>

            <section className="space-y-3">
              <h4 className="text-[10px] uppercase tracking-wider font-bold text-[#6E6875]">Practice details</h4>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Clinic / hospital name" value={form.clinicName} onChange={(v) => setForm({ ...form, clinicName: v })} />
                <Field label="Practice address" value={form.clinicAddress} onChange={(v) => setForm({ ...form, clinicAddress: v })} />
                <label className="block text-xs font-bold text-[#17131D]">
                  Country
                  <select
                    value={form.countryCode}
                    onChange={(event) => setForm({ ...form, countryCode: event.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-[#E7E2EB] rounded-xl text-xs font-normal"
                  >
                    <option value="NG">Nigeria</option>
                    <option value="GH">Ghana</option>
                    <option value="GB">United Kingdom</option>
                    <option value="US">United States</option>
                  </select>
                </label>
                <Field label="Timezone (IANA)" value={form.timeZone} onChange={(v) => setForm({ ...form, timeZone: v })} />
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-[10px] uppercase tracking-wider font-bold text-[#6E6875]">Booking setup</h4>
              <div className="flex flex-wrap gap-2">
                {SESSION_TYPES.map((type) => {
                  const selected = form.consultationTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          consultationTypes: selected
                            ? form.consultationTypes.filter((item) => item !== type)
                            : [...form.consultationTypes, type],
                        })
                      }
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold border capitalize ${
                        selected ? "bg-[#6C4CF1] text-white border-[#6C4CF1]" : "bg-white text-[#6E6875] border-[#E7E2EB]"
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <Field
                  label="Duration (minutes)"
                  type="number"
                  value={form.consultationDurationMinutes}
                  onChange={(v) => setForm({ ...form, consultationDurationMinutes: v })}
                />
                <Field
                  label="Fee (major unit, optional)"
                  type="number"
                  value={form.consultationFeeMajor}
                  onChange={(v) => setForm({ ...form, consultationFeeMajor: v })}
                />
                <label className="block text-xs font-bold text-[#17131D]">
                  Booking approval
                  <select
                    value={form.bookingApprovalMode}
                    onChange={(event) => setForm({ ...form, bookingApprovalMode: event.target.value as "instant" | "manual" })}
                    className="mt-1 w-full px-3 py-2 border border-[#E7E2EB] rounded-xl text-xs font-normal"
                  >
                    <option value="instant">Instant confirmation (current user flow)</option>
                    <option value="manual">Doctor confirms each request</option>
                  </select>
                </label>
              </div>
              <p className="text-[11px] text-[#6E6875]">
                Leaving the fee empty keeps checkout disabled for this doctor — no amount is ever guessed.
              </p>
            </section>

            <section className="space-y-3">
              <h4 className="text-[10px] uppercase tracking-wider font-bold text-[#6E6875]">Account setup</h4>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block text-xs font-bold text-[#17131D]">
                  Verification
                  <select
                    value={form.verificationStatus}
                    onChange={(event) => setForm({ ...form, verificationStatus: event.target.value as "pending" | "verified" })}
                    disabled={Boolean(editingId)}
                    className="mt-1 w-full px-3 py-2 border border-[#E7E2EB] rounded-xl text-xs font-normal disabled:bg-[#FBFAFD]"
                  >
                    <option value="pending">Pending review</option>
                    <option value="verified">Verified (licence required)</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 mt-5 text-xs font-bold text-[#17131D]">
                  <input
                    type="checkbox"
                    checked={form.listed}
                    onChange={(event) => setForm({ ...form, listed: event.target.checked })}
                    className="w-4 h-4 accent-[#6C4CF1]"
                  />
                  List publicly once verified
                </label>
              </div>
              {editingId && (
                <p className="text-[11px] text-[#6E6875]">Verification is granted from the verification endpoint with stored evidence, not from this form.</p>
              )}
            </section>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2.5 text-xs font-bold rounded-xl border border-[#E7E2EB]">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-[#6C4CF1] text-white disabled:opacity-50 inline-flex items-center gap-2"
              >
                {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {editingId ? "Save changes" : "Create doctor & send invite"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block text-xs font-bold text-[#17131D]">
      {label}
      <input
        type={type}
        value={value}
        required={required}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full px-3 py-2 border border-[#E7E2EB] rounded-xl text-xs font-normal disabled:bg-[#FBFAFD]"
      />
    </label>
  );
}
