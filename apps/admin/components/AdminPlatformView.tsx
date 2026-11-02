"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CreditCard,
  Database,
  Globe,
  KeyRound,
  Mail,
  MessageCircle,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { adminApi, ApiError, AdminPlatformStatusData } from "@obiren/api-client";
import {
  EmptyState,
  ErrorBanner,
  InfoBanner,
  NoticeBanner,
  StatusPill,
  TableSkeleton,
  formatDateTime,
} from "./admin-ui";

interface AuditLogRow {
  _id: string;
  actorUserId?: string;
  actorRole?: string;
  action?: string;
  module?: string;
  targetResourceId?: string;
  details?: string;
  ipAddress?: string;
  timestamp?: string;
}

/**
 * Platform readiness and the audit trail. Both are read-only: the app reports
 * what the running API is actually configured with and never exposes a secret
 * value. Feature toggles are environment configuration, not browser state.
 */
export default function AdminPlatformView({ activeTabId }: { selectedCountry: string; activeTabId?: string }) {
  const auditMode = activeTabId === "audit_logs";
  const [status, setStatus] = useState<AdminPlatformStatusData | null>(null);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      if (auditMode) {
        const data = await adminApi.auditLogs();
        setLogs((data ?? []) as AuditLogRow[]);
      } else {
        setStatus(await adminApi.platformStatus());
      }
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError && err.status === 403
          ? "Your role does not grant access to this platform module."
          : err instanceof ApiError
            ? err.message
            : "Could not load platform state.",
      );
      if (err instanceof ApiError && err.status === 403) {
        setNotice("Audit logs require the super_admin or compliance_officer role.");
      }
    } finally {
      setLoading(false);
    }
  }, [auditMode]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredLogs = logs.filter((log) => {
    if (!search.trim()) return true;
    const needle = search.trim().toLowerCase();
    return [log.action, log.module, log.details, log.actorRole, log.ipAddress]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
  });

  const integrationRows = status
    ? [
        {
          key: "payments",
          label: "Payments",
          icon: <CreditCard className="w-4 h-4" />,
          value: status.payments.enabled ? "Enabled" : "Policy pending",
          detail: status.payments.gatewayConfigured
            ? `Gateway configured • ${status.payments.currency} • policy ${status.payments.policyVersion || "unversioned"}`
            : "No gateway credentials configured on this environment",
          ok: status.payments.enabled && status.payments.gatewayConfigured,
        },
        {
          key: "email",
          label: "Email delivery",
          icon: <Mail className="w-4 h-4" />,
          value: status.email.delivery,
          detail: status.email.from ? `From ${status.email.from}` : "No verified sender configured",
          ok: status.email.delivery !== "mock",
        },
        {
          key: "whatsapp",
          label: "WhatsApp notifications",
          icon: <MessageCircle className="w-4 h-4" />,
          value: status.whatsapp.delivery,
          detail: "Notification channel provider",
          ok: status.whatsapp.delivery !== "mock",
        },
        {
          key: "google",
          label: "Google sign-in",
          icon: <KeyRound className="w-4 h-4" />,
          value: status.googleSignIn.enabled ? "Enabled" : "Disabled",
          detail: "OIDC audience verified server-side",
          ok: status.googleSignIn.enabled,
        },
        {
          key: "redis",
          label: "Redis",
          icon: <Database className="w-4 h-4" />,
          value: status.redis.configured ? "Configured" : "Not configured",
          detail: "Shared throttling and queue storage",
          ok: status.redis.configured,
        },
      ]
    : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm">
        <div>
          <h2 className="text-xl font-bold font-display text-[#17131D]">
            {auditMode ? "Audit logs" : "Platform readiness"}
          </h2>
          <p className="text-xs text-[#6E6875]">
            {auditMode
              ? "Immutable record of administrative and provider actions. Secret values are never written here."
              : "What the running API is actually configured with, market by market. No secret values are shown."}
          </p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] text-[#6C4CF1] text-xs font-bold rounded-full inline-flex items-center gap-2 self-start"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <ErrorBanner message={errorMsg} />
      <NoticeBanner message={notice} />

      {auditMode ? (
        <div className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-4">
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-[#E7E2EB] max-w-md">
            <Search className="w-3.5 h-3.5 text-[#918A98]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter by action, module, role or IP"
              className="w-full bg-transparent text-xs focus:outline-none"
            />
          </div>

          {loading ? (
            <TableSkeleton label="Loading audit records..." />
          ) : filteredLogs.length === 0 ? (
            <EmptyState
              icon={<ScrollText className="w-10 h-10" />}
              title="No audit records match"
              description="Administrative changes, verification decisions and provider events are recorded as they happen."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[10px] uppercase font-bold text-[#6E6875] border-b border-[#E7E2EB]">
                    <th className="py-2 pr-4">When</th>
                    <th className="py-2 pr-4">Actor role</th>
                    <th className="py-2 pr-4">Action</th>
                    <th className="py-2 pr-4">Module</th>
                    <th className="py-2 pr-4">Details</th>
                    <th className="py-2 pr-4">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log._id} className="border-b border-[#F5F2FF] last:border-0 align-top">
                      <td className="py-3 pr-4 text-[#6E6875] whitespace-nowrap">{formatDateTime(log.timestamp)}</td>
                      <td className="py-3 pr-4 font-bold text-[#17131D]">{log.actorRole || "system"}</td>
                      <td className="py-3 pr-4 font-mono text-[10px] text-[#6C4CF1]">{log.action}</td>
                      <td className="py-3 pr-4 text-[#6E6875]">{log.module}</td>
                      <td className="py-3 pr-4 text-[#6E6875] max-w-[360px]">{log.details}</td>
                      <td className="py-3 pr-4 text-[#6E6875] font-mono text-[10px]">{log.ipAddress || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="bg-white p-12 rounded-3xl border border-[#E7E2EB] text-center text-sm text-[#6E6875]">
          Reading platform configuration...
        </div>
      ) : status ? (
        <>
          <div
            className={`p-5 rounded-3xl border flex flex-wrap items-center justify-between gap-3 ${
              status.degraded
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-emerald-50 border-emerald-200 text-emerald-800"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {status.degraded ? <TriangleAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
              <div>
                <p className="text-xs font-black uppercase tracking-wide">
                  {status.degraded ? "Degraded configuration" : "Core configuration present"}
                </p>
                <p className="text-[11px] font-semibold">
                  Environment: {status.environment} • checked {formatDateTime(status.generatedAt)}
                </p>
              </div>
            </div>
            <p className="text-[11px] font-semibold max-w-md">
              Optional providers still mock-render in-app events instead of delivering externally; that limitation is
              reported per channel below.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-4">
            <h3 className="text-base font-bold font-display text-[#17131D]">Integrations</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {integrationRows.map((row) => (
                <div key={row.key} className="p-4 rounded-2xl border border-[#E7E2EB] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-bold text-[#17131D]">
                      <span className="text-[#6C4CF1]">{row.icon}</span>
                      {row.label}
                    </span>
                    <StatusPill status={row.ok ? "active" : "pending"} label={row.value} />
                  </div>
                  <p className="text-[11px] text-[#6E6875]">{row.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#6C4CF1]" />
              <h3 className="text-base font-bold font-display text-[#17131D]">Markets & features</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[10px] uppercase font-bold text-[#6E6875] border-b border-[#E7E2EB]">
                    <th className="py-2 pr-4">Market</th>
                    <th className="py-2 pr-4">Currency</th>
                    <th className="py-2 pr-4">Features</th>
                  </tr>
                </thead>
                <tbody>
                  {status.countries.map((country) => (
                    <tr key={country.code} className="border-b border-[#F5F2FF] last:border-0">
                      <td className="py-3 pr-4 font-bold text-[#17131D]">
                        {country.flag} {country.name}
                      </td>
                      <td className="py-3 pr-4 text-[#6E6875]">{country.currency}</td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(country.features).map(([feature, enabled]) => (
                            <span
                              key={feature}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                enabled
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-slate-100 text-slate-500 border-slate-200"
                              }`}
                            >
                              {feature.replace(/([A-Z])/g, " $1").toLowerCase()}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <InfoBanner message="Changing markets, feature availability or provider credentials is an environment change reviewed by engineering, not a browser toggle. Contact the platform owner before enabling a market." />
        </>
      ) : null}
    </div>
  );
}
