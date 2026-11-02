"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  ShieldCheck,
  Stethoscope,
  X,
} from "lucide-react";
import { adminApi, ApiError, AdminAppointmentData } from "@obiren/api-client";
import {
  EmptyState,
  ErrorBanner,
  NoticeBanner,
  StatusPill,
  TableSkeleton,
  formatDateTime,
  formatMoneyMinor,
  zonedDayBounds,
} from "./admin-ui";

interface AdminHealthcareViewProps {
  selectedCountry: string;
  activeTabId?: string;
}

interface ClinicianRow {
  _id: string;
  userId?: string;
  displayName?: string;
  specialties?: string[];
  languages?: string[];
  countryCode?: string;
  verificationStatus?: string;
  verificationEvidenceRef?: string | null;
  verificationNote?: string | null;
  reviewedAt?: string | null;
  active?: boolean;
}

const APPOINTMENT_STATUSES = [
  "pending",
  "confirmed",
  "reschedule_requested",
  "completed",
  "cancelled",
  "rejected",
  "no_show",
];

/**
 * Clinical operations. Both tabs read the same authoritative records the user
 * app and Doctor Portal use: clinician verification decisions and the global
 * appointment register. No patient clinical notes are joined into this view.
 */
export default function AdminHealthcareView({ selectedCountry, activeTabId }: AdminHealthcareViewProps) {
  const mode: "professionals" | "appointments" = activeTabId === "appointments" ? "appointments" : "professionals";

  return mode === "appointments" ? (
    <AppointmentRegister selectedCountry={selectedCountry} />
  ) : (
    <VerificationQueue selectedCountry={selectedCountry} />
  );
}

/* -------------------------------------------------------------------------- */
/* Clinician verification                                                     */
/* -------------------------------------------------------------------------- */

function VerificationQueue({ selectedCountry }: { selectedCountry: string }) {
  const [clinicians, setClinicians] = useState<ClinicianRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewTarget, setReviewTarget] = useState<ClinicianRow | null>(null);

  const load = useCallback(async (status = statusFilter) => {
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await adminApi.listClinicians({
        verificationStatus: status === "all" ? undefined : (status as "pending" | "verified" | "rejected"),
        limit: 50,
      });
      setClinicians((data.clinicians ?? []) as ClinicianRow[]);
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError && err.status === 403
          ? "Your role does not grant access to clinician verification."
          : err instanceof ApiError
            ? err.message
            : "Could not load clinician verification records.",
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load(statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const rows = clinicians.filter(
    (row) => selectedCountry === "ALL" || !row.countryCode || row.countryCode === selectedCountry,
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm">
        <div>
          <h2 className="text-xl font-bold font-display text-[#17131D]">Doctor verification</h2>
          <p className="text-xs text-[#6E6875]">
            Verification is an audited decision. Only verified, active doctors appear in user-facing discovery.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="px-3 py-2 bg-[#F5F2FF] border border-[#E8E0FF] rounded-full text-xs font-bold text-[#17131D]"
          >
            <option value="pending">Pending review</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
            <option value="all">All records</option>
          </select>
          <button
            onClick={() => load(statusFilter)}
            className="px-4 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] text-[#6C4CF1] text-xs font-bold rounded-full inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      <ErrorBanner message={errorMsg} />
      <NoticeBanner message={notice} />

      <div className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm">
        {loading ? (
          <TableSkeleton label="Loading verification records..." />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="w-10 h-10" />}
            title="Nothing in this queue"
            description="Doctors added from the Doctors section appear here until their credentials are verified."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase font-bold text-[#6E6875] border-b border-[#E7E2EB]">
                  <th className="py-2 pr-4">Doctor</th>
                  <th className="py-2 pr-4">Specialties</th>
                  <th className="py-2 pr-4">Market</th>
                  <th className="py-2 pr-4">Evidence</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Review</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id} className="border-b border-[#F5F2FF] last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-bold text-[#17131D]">{row.displayName || "Unnamed profile"}</p>
                      <p className="text-[10px] text-[#6E6875] font-mono">{row._id}</p>
                    </td>
                    <td className="py-3 pr-4 text-[#6E6875] max-w-[220px]">
                      {(row.specialties || []).join(", ") || "—"}
                    </td>
                    <td className="py-3 pr-4 text-[#6E6875]">{row.countryCode || "—"}</td>
                    <td className="py-3 pr-4 text-[#6E6875] max-w-[200px] truncate">
                      {row.verificationEvidenceRef || "Not recorded"}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusPill status={row.verificationStatus || "pending"} />
                    </td>
                    <td className="py-3 pr-4 text-[#6E6875]">{formatDateTime(row.reviewedAt)}</td>
                    <td className="py-3 pr-4 text-right">
                      <button
                        onClick={() => setReviewTarget(row)}
                        className="px-3 py-1.5 bg-[#F5F2FF] border border-[#E8E0FF] text-[#6C4CF1] rounded-full font-bold"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {reviewTarget ? (
        <ReviewDialog
          clinician={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onSaved={async (message) => {
            setReviewTarget(null);
            setNotice(message);
            await load(statusFilter);
          }}
          onError={setErrorMsg}
        />
      ) : null}
    </div>
  );
}

function ReviewDialog({
  clinician,
  onClose,
  onSaved,
  onError,
}: {
  clinician: ClinicianRow;
  onClose: () => void;
  onSaved: (message: string) => void | Promise<void>;
  onError: (message: string) => void;
}) {
  const [decision, setDecision] = useState<"verified" | "rejected" | "pending">(
    (clinician.verificationStatus as "verified" | "rejected" | "pending") || "pending",
  );
  const [evidenceRef, setEvidenceRef] = useState(clinician.verificationEvidenceRef || "");
  const [note, setNote] = useState(clinician.verificationNote || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await adminApi.verifyClinician(clinician._id, {
        verificationStatus: decision,
        evidenceRef: evidenceRef.trim() || undefined,
        note: note.trim() || undefined,
        active: decision === "verified",
      });
      await onSaved(
        decision === "verified"
          ? `${clinician.displayName || "Doctor"} verified. They can be listed once the doctor profile is active and listed.`
          : `Verification decision recorded for ${clinician.displayName || "the doctor"}.`,
      );
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not record the verification decision.";
      setError(message);
      onError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase font-bold text-[#6E6875]">Verification review</p>
            <h3 className="text-lg font-bold font-display text-[#17131D]">{clinician.displayName || "Doctor"}</h3>
            <p className="text-xs text-[#6E6875]">{(clinician.specialties || []).join(", ") || "No specialties recorded"}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[#F5F2FF] text-[#6E6875]" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-[#6E6875]">Decision</label>
          <div className="flex flex-wrap gap-1.5">
            {(["verified", "rejected", "pending"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setDecision(value)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold border capitalize ${
                  decision === value
                    ? "bg-[#6C4CF1] text-white border-[#6C4CF1]"
                    : "bg-white text-[#17131D] border-[#E7E2EB]"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-[#6E6875]">Evidence reference</label>
          <input
            value={evidenceRef}
            onChange={(event) => setEvidenceRef(event.target.value)}
            maxLength={300}
            placeholder="Licence registry check, document id or case reference"
            className="w-full p-3 rounded-2xl border border-[#E7E2EB] text-xs focus:outline-none focus:ring-2 focus:ring-[#6C4CF1]/30"
          />
          <p className="text-[10px] text-[#6E6875]">Required before a doctor can be verified. Stored with the decision.</p>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-[#6E6875]">Review note</label>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={500}
            className="w-full p-3 rounded-2xl border border-[#E7E2EB] text-xs focus:outline-none focus:ring-2 focus:ring-[#6C4CF1]/30"
          />
        </div>

        {error ? <ErrorBanner message={error} /> : null}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-full text-xs font-bold text-[#6E6875] hover:bg-[#F5F2FF]">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || (decision === "verified" && evidenceRef.trim().length < 3)}
            className="px-4 py-2 bg-[#6C4CF1] text-white rounded-full text-xs font-bold disabled:opacity-40"
          >
            {saving ? "Saving..." : "Record decision"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Appointment register                                                       */
/* -------------------------------------------------------------------------- */

function AppointmentRegister({ selectedCountry: _selectedCountry }: { selectedCountry: string }) {
  const [appointments, setAppointments] = useState<AdminAppointmentData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [selected, setSelected] = useState<AdminAppointmentData | null>(null);
  const limit = 20;

  const load = useCallback(
    async (targetPage = 1) => {
      setLoading(true);
      setErrorMsg("");
      try {
        const data = await adminApi.listAppointments({
          status: statusFilter || undefined,
          from: fromDate ? zonedDayBounds(fromDate).from : undefined,
          to: toDate ? zonedDayBounds(toDate).to : undefined,
          q: appliedSearch || undefined,
          page: targetPage,
          limit,
        });
        setAppointments(data.appointments ?? []);
        setTotal(data.total ?? 0);
        setPage(data.page ?? targetPage);
      } catch (err) {
        setErrorMsg(
          err instanceof ApiError && err.status === 403
            ? "Your role does not grant access to the appointment register."
            : err instanceof ApiError
              ? err.message
              : "Could not load appointments.",
        );
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, fromDate, toDate, appliedSearch],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  // The register is intentionally not filtered by market here: the booking API
  // returns the authoritative cross-market list and the doctor's market is not
  // stored on the booking snapshot.
  const rows = appointments;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold font-display text-[#17131D]">Appointment register</h2>
            <p className="text-xs text-[#6E6875]">
              Every booking made through the user app, with doctor assignment and current status. {total.toLocaleString()} matching booking(s).
            </p>
          </div>
          <button
            onClick={() => load(page)}
            className="px-4 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] text-[#6C4CF1] text-xs font-bold rounded-full inline-flex items-center gap-2 self-start"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[180px]">
            <label className="text-[10px] font-bold uppercase text-[#6E6875]">Search</label>
            <div className="flex items-center gap-1.5 mt-1 px-3 py-2 rounded-full border border-[#E7E2EB] bg-white">
              <Search className="w-3.5 h-3.5 text-[#918A98]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") setAppliedSearch(search.trim());
                }}
                placeholder="Reference, patient or doctor"
                className="w-full bg-transparent text-xs focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-[#6E6875]">Status</label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="block mt-1 px-3 py-2 rounded-full border border-[#E7E2EB] bg-white text-xs font-bold capitalize"
            >
              <option value="">All statuses</option>
              {APPOINTMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-[#6E6875]">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="block mt-1 px-3 py-2 rounded-full border border-[#E7E2EB] bg-white text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-[#6E6875]">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="block mt-1 px-3 py-2 rounded-full border border-[#E7E2EB] bg-white text-xs"
            />
          </div>
          <button
            onClick={() => setAppliedSearch(search.trim())}
            className="px-4 py-2 bg-[#17131D] text-white rounded-full text-xs font-bold"
          >
            Apply
          </button>
        </div>
      </div>

      <ErrorBanner message={errorMsg} />

      <div className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-4">
        {loading ? (
          <TableSkeleton label="Loading appointments..." />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="w-10 h-10" />}
            title="No appointments match these filters"
            description="Bookings made in the user app appear here with the assigned doctor."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase font-bold text-[#6E6875] border-b border-[#E7E2EB]">
                  <th className="py-2 pr-4">Reference</th>
                  <th className="py-2 pr-4">Patient</th>
                  <th className="py-2 pr-4">Doctor</th>
                  <th className="py-2 pr-4">Schedule</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-[#F5F2FF] last:border-0">
                    <td className="py-3 pr-4 font-mono text-[10px] text-[#6E6875]">{row.reference}</td>
                    <td className="py-3 pr-4 font-bold text-[#17131D]">{row.patient.displayName}</td>
                    <td className="py-3 pr-4 text-[#6E6875]">{row.doctor.displayName}</td>
                    <td className="py-3 pr-4 text-[#6E6875]">{formatDateTime(row.startsAt, row.timeZone)}</td>
                    <td className="py-3 pr-4 text-[#6E6875] capitalize">{row.sessionType}</td>
                    <td className="py-3 pr-4">
                      <StatusPill status={row.status} />
                    </td>
                    <td className="py-3 pr-4 text-[#17131D] font-bold">{formatMoneyMinor(row.amountMinor, row.currency)}</td>
                    <td className="py-3 pr-4 text-right">
                      <button
                        onClick={() => setSelected(row)}
                        className="px-3 py-1.5 bg-[#F5F2FF] border border-[#E8E0FF] text-[#6C4CF1] rounded-full font-bold"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-[#E7E2EB]">
            <button
              onClick={() => load(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 text-xs font-bold text-[#6C4CF1] disabled:opacity-30 inline-flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <span className="text-xs font-bold text-[#6E6875]">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => load(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-xs font-bold text-[#6C4CF1] disabled:opacity-30 inline-flex items-center gap-1"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase font-bold text-[#6E6875] font-mono">{selected.reference}</p>
                <h3 className="text-lg font-bold font-display text-[#17131D]">{selected.patient.displayName}</h3>
                <p className="text-xs text-[#6E6875]">with {selected.doctor.displayName}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-2 rounded-full hover:bg-[#F5F2FF] text-[#6E6875]"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <StatusPill status={selected.status} />
              <span className="text-[11px] text-[#6E6875] capitalize">{selected.sessionType} consultation</span>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-[10px] uppercase font-bold text-[#6E6875]">Starts</dt>
                <dd className="font-bold text-[#17131D]">{formatDateTime(selected.startsAt, selected.timeZone)}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase font-bold text-[#6E6875]">Ends</dt>
                <dd className="font-bold text-[#17131D]">{formatDateTime(selected.endsAt, selected.timeZone)}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase font-bold text-[#6E6875]">Patient contact</dt>
                <dd className="text-[#17131D]">{selected.patient.email || selected.patient.phoneNumber || "Not provided"}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase font-bold text-[#6E6875]">Payment</dt>
                <dd className="text-[#17131D]">
                  {formatMoneyMinor(selected.amountMinor, selected.currency)} • {selected.paymentStatus || "no payment record"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase font-bold text-[#6E6875]">Booked</dt>
                <dd className="text-[#17131D]">{formatDateTime(selected.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase font-bold text-[#6E6875]">Refund</dt>
                <dd className="text-[#17131D] capitalize">{selected.refundStatus?.replace(/_/g, " ") || "none"}</dd>
              </div>
            </dl>

            {selected.cancellationReason || selected.rejectionReason ? (
              <div className="p-3 rounded-2xl bg-[#F5F2FF] border border-[#E8E0FF]">
                <p className="text-[10px] font-bold uppercase text-[#6E6875]">Recorded reason</p>
                <p className="text-xs text-[#17131D]">{selected.cancellationReason || selected.rejectionReason}</p>
              </div>
            ) : null}

            <p className="text-[10px] text-[#6E6875]">
              Appointment status changes are made by the assigned doctor in the Doctor Portal or by the patient in
              the user app. This register is read-only so the same booking record stays authoritative.
            </p>

            <div className="flex justify-end">
              <button
                onClick={() => setSelected(null)}
                className="px-4 py-2 bg-[#17131D] text-white rounded-full text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
