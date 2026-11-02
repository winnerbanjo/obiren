"use client";

import { useCallback, useEffect, useState } from "react";
import { Phone, RefreshCw, ShieldAlert, X } from "lucide-react";
import {
  adminApi,
  ApiError,
  AdminSafetyIncidentData,
  EmergencyResourceFreshness,
  EmergencyVerificationStatus,
} from "@obiren/api-client";
import {
  EmptyState,
  ErrorBanner,
  InfoBanner,
  NoticeBanner,
  StatusPill,
  TableSkeleton,
  formatDateTime,
} from "./admin-ui";

interface AdminSafetyViewProps {
  selectedCountry: string;
  activeTabId?: string;
}

interface ResourceRow {
  recordId: string;
  organisationName: string;
  countryCode: string;
  category: string;
  phone: string;
  sourceUrl: string;
  editorialFollowUp: string;
  verificationStatus: string;
  operationallyConfirmed: boolean;
  lastCheckedAt: string | null;
  nextReviewDueAt: string | null;
  evidenceRef: string | null;
  note: string | null;
  freshness: string;
}

const INCIDENT_STATUSES = ["all", "active", "triggered", "completed", "cancelled"] as const;

export default function AdminSafetyView({ selectedCountry, activeTabId }: AdminSafetyViewProps) {
  return activeTabId === "safety_incidents" ? (
    <SosRegister />
  ) : (
    <ResourceDirectory selectedCountry={selectedCountry} />
  );
}

/* -------------------------------------------------------------------------- */
/* SOS incidents                                                              */
/* -------------------------------------------------------------------------- */

function SosRegister() {
  const [incidents, setIncidents] = useState<AdminSafetyIncidentData[]>([]);
  const [statusFilter, setStatusFilter] = useState<(typeof INCIDENT_STATUSES)[number]>("all");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const load = useCallback(async (status = statusFilter) => {
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await adminApi.listSafetyIncidents({
        status: status === "all" ? undefined : status,
        limit: 50,
      });
      setIncidents(data.incidents ?? []);
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError && err.status === 403
          ? "Your role does not grant access to the SOS register."
          : err instanceof ApiError
            ? err.message
            : "Could not load SOS incidents.",
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load(statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm">
        <div>
          <h2 className="text-xl font-bold font-display text-[#17131D]">SOS incidents</h2>
          <p className="text-xs text-[#6E6875]">
            Delivery counts are what the provider actually reported. A skipped or failed channel is never shown as
            delivered, and no incident here implies emergency-service dispatch.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as (typeof INCIDENT_STATUSES)[number])}
            className="px-3 py-2 bg-[#F5F2FF] border border-[#E8E0FF] rounded-full text-xs font-bold text-[#17131D] capitalize"
          >
            {INCIDENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status === "all" ? "All statuses" : status}
              </option>
            ))}
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

      <div className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm">
        {loading ? (
          <TableSkeleton label="Loading incidents..." />
        ) : incidents.length === 0 ? (
          <EmptyState
            icon={<ShieldAlert className="w-10 h-10" />}
            title="No incidents in this view"
            description="SOS activations are append-only records; exact coordinates stay out of this list."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase font-bold text-[#6E6875] border-b border-[#E7E2EB]">
                  <th className="py-2 pr-4">Account</th>
                  <th className="py-2 pr-4">Triggered</th>
                  <th className="py-2 pr-4">State</th>
                  <th className="py-2 pr-4">Dispatch</th>
                  <th className="py-2 pr-4">Deliveries</th>
                  <th className="py-2 pr-4">Guardians</th>
                  <th className="py-2 pr-4">Mode</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((incident) => (
                  <tr key={incident.id} className="border-b border-[#F5F2FF] last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-bold text-[#17131D]">{incident.patient.displayName}</p>
                      <p className="text-[10px] text-[#6E6875]">
                        {incident.patient.email || "no email"} • {incident.patient.countryCode || "—"}
                      </p>
                    </td>
                    <td className="py-3 pr-4 text-[#6E6875]">{formatDateTime(incident.triggeredAt)}</td>
                    <td className="py-3 pr-4">
                      <StatusPill status={incident.status} />
                    </td>
                    <td className="py-3 pr-4">
                      <StatusPill status={incident.dispatchStatus} />
                    </td>
                    <td className="py-3 pr-4 text-[#6E6875]">
                      <span className="font-bold text-emerald-700">{incident.delivery.sent} sent</span>
                      {" • "}
                      <span className="font-bold text-red-600">{incident.delivery.failed} failed</span>
                      {" • "}
                      {incident.delivery.simulated} simulated
                    </td>
                    <td className="py-3 pr-4 text-[#6E6875]">{incident.trustedContactCount}</td>
                    <td className="py-3 pr-4 text-[#6E6875]">{incident.isTestMode ? "test" : "live"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Emergency resource directory                                               */
/* -------------------------------------------------------------------------- */

function ResourceDirectory({ selectedCountry }: { selectedCountry: string }) {
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [freshness, setFreshness] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewTarget, setReviewTarget] = useState<ResourceRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await adminApi.listEmergencyResources({
        countryCode: selectedCountry === "ALL" ? undefined : selectedCountry,
        freshness: (freshness || undefined) as EmergencyResourceFreshness | undefined,
        limit: 100,
      });
      setResources((data.resources ?? []) as unknown as ResourceRow[]);
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError && err.status === 403
          ? "Your role does not grant access to emergency resources."
          : err instanceof ApiError
            ? err.message
            : "Could not load emergency resources.",
      );
    } finally {
      setLoading(false);
    }
  }, [selectedCountry, freshness]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = resources.filter((row) => {
    if (!search.trim()) return true;
    const needle = search.trim().toLowerCase();
    return (
      row.organisationName.toLowerCase().includes(needle) ||
      row.category.toLowerCase().includes(needle) ||
      row.phone.toLowerCase().includes(needle)
    );
  });

  const counts = resources.reduce<Record<string, number>>((acc, row) => {
    acc[row.freshness] = (acc[row.freshness] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold font-display text-[#17131D]">Emergency resources</h2>
            <p className="text-xs text-[#6E6875]">
              Published contacts with recorded review state. Freshness is derived from the next review date recorded by
              the team, not assumed.
            </p>
          </div>
          <button
            onClick={load}
            className="px-4 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] text-[#6C4CF1] text-xs font-bold rounded-full inline-flex items-center gap-2 self-start"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["", "due_soon", "overdue", "unreviewed", "current"] as const).map((value) => (
            <button
              key={value || "all"}
              onClick={() => setFreshness(value)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold border capitalize ${
                freshness === value
                  ? "bg-[#6C4CF1] text-white border-[#6C4CF1]"
                  : "bg-white text-[#17131D] border-[#E7E2EB]"
              }`}
            >
              {value ? `${value.replace(/_/g, " ")} (${counts[value] ?? 0})` : `All (${resources.length})`}
            </button>
          ))}
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search organisation, category or number"
            className="flex-1 min-w-[200px] px-4 py-2 rounded-full border border-[#E7E2EB] text-xs focus:outline-none focus:ring-2 focus:ring-[#6C4CF1]/30"
          />
        </div>
      </div>

      <InfoBanner message="Recording a review stores who checked the resource and when. Marking a contact operationally confirmed requires an evidence reference so safety claims stay auditable." />
      <ErrorBanner message={errorMsg} />
      <NoticeBanner message={notice} />

      <div className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm">
        {loading ? (
          <TableSkeleton label="Loading resources..." />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Phone className="w-10 h-10" />}
            title="No resources match"
            description="Try clearing the freshness or search filters."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase font-bold text-[#6E6875] border-b border-[#E7E2EB]">
                  <th className="py-2 pr-4">Organisation</th>
                  <th className="py-2 pr-4">Market</th>
                  <th className="py-2 pr-4">Contact</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Last checked</th>
                  <th className="py-2 pr-4">Next review</th>
                  <th className="py-2 pr-4">Freshness</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.recordId} className="border-b border-[#F5F2FF] last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-bold text-[#17131D]">{row.organisationName}</p>
                      <p className="text-[10px] text-[#6E6875]">{row.category}</p>
                    </td>
                    <td className="py-3 pr-4 text-[#6E6875]">{row.countryCode}</td>
                    <td className="py-3 pr-4">
                      <a href={`tel:${row.phone}`} className="font-bold text-[#6C4CF1] inline-flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {row.phone}
                      </a>
                    </td>
                    <td className="py-3 pr-4">
                      <StatusPill status={row.verificationStatus} />
                    </td>
                    <td className="py-3 pr-4 text-[#6E6875]">{formatDateTime(row.lastCheckedAt)}</td>
                    <td className="py-3 pr-4 text-[#6E6875]">{formatDateTime(row.nextReviewDueAt)}</td>
                    <td className="py-3 pr-4">
                      <StatusPill status={row.freshness} />
                    </td>
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
        <ReviewResourceDialog
          resource={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onSaved={async (message) => {
            setReviewTarget(null);
            setNotice(message);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}

function ReviewResourceDialog({
  resource,
  onClose,
  onSaved,
}: {
  resource: ResourceRow;
  onClose: () => void;
  onSaved: (message: string) => void | Promise<void>;
}) {
  const [status, setStatus] = useState<EmergencyVerificationStatus>(
    (resource.verificationStatus as EmergencyVerificationStatus) || "unverified",
  );
  const [evidenceRef, setEvidenceRef] = useState(resource.evidenceRef || "");
  const [note, setNote] = useState(resource.note || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await adminApi.reviewEmergencyResource(resource.recordId, {
        verificationStatus: status,
        evidenceRef: evidenceRef.trim() || undefined,
        note: note.trim() || undefined,
      });
      await onSaved(`Review recorded for ${resource.organisationName}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record the review.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase font-bold text-[#6E6875]">{resource.recordId}</p>
            <h3 className="text-lg font-bold font-display text-[#17131D]">{resource.organisationName}</h3>
            <p className="text-xs text-[#6E6875]">
              {resource.category} • {resource.countryCode} • {resource.phone}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[#F5F2FF] text-[#6E6875]" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-[#6E6875]">Verification status</label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as EmergencyVerificationStatus)}
            className="w-full px-3 py-2 rounded-2xl border border-[#E7E2EB] text-xs font-bold"
          >
            <option value="source_verified">Source verified</option>
            <option value="directory_source_verified">Directory source verified</option>
            <option value="operationally_confirmed">Operationally confirmed</option>
            <option value="unverified">Unverified</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-[#6E6875]">Evidence reference</label>
          <input
            value={evidenceRef}
            onChange={(event) => setEvidenceRef(event.target.value)}
            maxLength={300}
            placeholder="Call log, provider website snapshot or case reference"
            className="w-full p-3 rounded-2xl border border-[#E7E2EB] text-xs focus:outline-none focus:ring-2 focus:ring-[#6C4CF1]/30"
          />
          <p className="text-[10px] text-[#6E6875]">
            Required to mark a resource operationally confirmed.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-[#6E6875]">Note</label>
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
            disabled={saving || (status === "operationally_confirmed" && evidenceRef.trim().length < 3)}
            className="px-4 py-2 bg-[#6C4CF1] text-white rounded-full text-xs font-bold disabled:opacity-40"
          >
            {saving ? "Saving..." : "Record review"}
          </button>
        </div>
      </div>
    </div>
  );
}
