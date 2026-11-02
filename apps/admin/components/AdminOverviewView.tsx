"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Baby,
  CalendarClock,
  CalendarDays,
  CreditCard,
  LifeBuoy,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  UserPlus,
  Users,
} from "lucide-react";
import { adminApi, ApiError, AdminMetricsData, AdminAppointmentData } from "@obiren/api-client";
import {
  EmptyState,
  ErrorBanner,
  InfoBanner,
  StatusPill,
  formatDateTime,
  formatMoneyMinor,
  zonedDayBounds,
} from "./admin-ui";

interface AdminOverviewViewProps {
  selectedCountry: string;
  onNavigate: (tab: string) => void;
}

interface KpiProps {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tone?: "default" | "warning" | "danger";
  onClick?: () => void;
}

function Kpi({ label, value, hint, icon, tone = "default", onClick }: KpiProps) {
  const toneRing =
    tone === "danger"
      ? "border-red-200 bg-red-50/40"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50/40"
        : "border-[#E7E2EB] bg-white";
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={`text-left p-5 rounded-3xl border shadow-sm space-y-2.5 transition-all ${toneRing} ${
        onClick ? "hover:shadow-md hover:-translate-y-0.5" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase font-bold text-[#6E6875] tracking-wide">{label}</span>
        <span className="text-[#6C4CF1]">{icon}</span>
      </div>
      <p className="text-3xl font-black font-display text-[#17131D] leading-none">{value}</p>
      {hint ? <p className="text-[11px] font-semibold text-[#6E6875]">{hint}</p> : null}
    </Wrapper>
  );
}

export default function AdminOverviewView({ selectedCountry, onNavigate }: AdminOverviewViewProps) {
  const [metrics, setMetrics] = useState<AdminMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [todayAppointments, setTodayAppointments] = useState<AdminAppointmentData[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await adminApi.metrics();
      setMetrics(data);

      // Today's register is loaded from the same operational clock the server
      // used to produce `today`, so no client-side timezone guessing.
      setScheduleLoading(true);
      setScheduleError("");
      try {
        const bounds = zonedDayBounds(data.today, data.operationsTimeZone);
        const today = await adminApi.listAppointments({ from: bounds.from, to: bounds.to, limit: 8 });
        setTodayAppointments(today.appointments ?? []);
      } catch (err) {
        setTodayAppointments([]);
        setScheduleError(
          err instanceof ApiError ? err.message : "Today's schedule could not be loaded from the API.",
        );
      } finally {
        setScheduleLoading(false);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError && err.status === 403
          ? "Your role does not grant access to platform metrics."
          : err instanceof ApiError
            ? err.message
            : "Could not load platform metrics.",
      );
    } finally {
      setLoading(false);
      setScheduleLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const countryRows = metrics ? Object.entries(metrics.countryBreakdown || {}) : [];
  const revenue = metrics?.payments.byCurrency ?? [];
  const attention = metrics
    ? [
        {
          key: "pending_appointments",
          label: "Appointments awaiting action",
          count: metrics.pendingAppointments,
          tab: "appointments",
          icon: <CalendarClock className="w-4 h-4" />,
        },
        {
          key: "support",
          label: "Open support tickets",
          count: metrics.openSupportTickets,
          tab: "support",
          icon: <LifeBuoy className="w-4 h-4" />,
        },
        {
          key: "sos",
          label: "Active SOS incidents",
          count: metrics.activeSosIncidents,
          tab: "safety_incidents",
          icon: <ShieldAlert className="w-4 h-4" />,
        },
        {
          key: "verification",
          label: "Doctors not yet verified",
          count: Math.max(0, metrics.totalDoctors - metrics.verifiedDoctors),
          tab: "professionals",
          icon: <ShieldCheck className="w-4 h-4" />,
        },
      ].filter((row) => row.count > 0)
    : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Operational banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#21182F] via-[#2D1F45] to-[#21182F] text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-purple-900/40">
        <div className="space-y-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#9B6BFF] bg-white/10 px-3 py-1 rounded-full border border-white/15">
            Live operations • {selectedCountry === "ALL" ? "All markets" : `${selectedCountry} market`}
            {metrics ? ` • ${metrics.operationsTimeZone}` : ""}
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold font-display">Platform Command Centre</h2>
          <p className="text-xs text-white/70">
            {metrics
              ? `Operational date ${metrics.today} • generated ${formatDateTime(metrics.generatedAt, metrics.operationsTimeZone)}`
              : "Reading live figures from the Obiren API."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onNavigate("doctors")}
            className="px-4 py-2.5 bg-white text-[#21182F] text-xs font-bold rounded-full inline-flex items-center gap-2 hover:bg-white/90"
          >
            <UserPlus className="w-4 h-4" /> Add doctor
          </button>
          <button
            onClick={load}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold rounded-full inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      <ErrorBanner message={errorMsg} />

      {loading ? (
        <div className="bg-white p-12 rounded-3xl border border-[#E7E2EB] text-center text-sm text-[#6E6875]">
          Loading live platform metrics...
        </div>
      ) : metrics ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Kpi
              label="Registered users"
              value={metrics.totalUsers.toLocaleString()}
              hint={`${metrics.newUsersLast7Days.toLocaleString()} joined in the last 7 days`}
              icon={<Users className="w-5 h-5" />}
              onClick={() => onNavigate("users")}
            />
            <Kpi
              label="Appointments today"
              value={metrics.appointmentsToday.toLocaleString()}
              hint={`${metrics.pendingAppointments} pending • ${metrics.confirmedUpcoming} confirmed upcoming`}
              icon={<CalendarDays className="w-5 h-5" />}
              onClick={() => onNavigate("appointments")}
            />
            <Kpi
              label="Open support tickets"
              value={metrics.openSupportTickets.toLocaleString()}
              hint="Queue awaiting a support reply"
              icon={<LifeBuoy className="w-5 h-5" />}
              tone={metrics.openSupportTickets > 0 ? "warning" : "default"}
              onClick={() => onNavigate("support")}
            />
            <Kpi
              label="Active SOS incidents"
              value={metrics.activeSosIncidents.toLocaleString()}
              hint={metrics.activeSosIncidents > 0 ? "Needs immediate review" : "No open incidents"}
              icon={<ShieldAlert className="w-5 h-5" />}
              tone={metrics.activeSosIncidents > 0 ? "danger" : "default"}
              onClick={() => onNavigate("safety_incidents")}
            />
            <Kpi
              label="Doctors"
              value={metrics.totalDoctors.toLocaleString()}
              hint={`${metrics.verifiedDoctors} verified • ${metrics.activeDoctors} active`}
              icon={<Stethoscope className="w-5 h-5" />}
              onClick={() => onNavigate("doctors")}
            />
            <Kpi
              label="Active pregnancies"
              value={metrics.activePregnancies.toLocaleString()}
              hint="Journeys currently in progress"
              icon={<Baby className="w-5 h-5" />}
            />
            <Kpi
              label="Verified emergency resources"
              value={metrics.verifiedEmergencyResources.toLocaleString()}
              hint="Published contacts with recorded review state"
              icon={<ShieldCheck className="w-5 h-5" />}
              onClick={() => onNavigate("emergency_resources")}
            />
            <Kpi
              label="Settled payments"
              value={
                revenue.length === 0
                  ? "—"
                  : revenue.map((row) => formatMoneyMinor(row.amountMinor, row.currency)).join(" • ")
              }
              hint={
                metrics.payments.policyPending
                  ? "Payment policy not approved — no live checkout"
                  : `${revenue.reduce((sum, row) => sum + row.count, 0)} verified transactions`
              }
              icon={<CreditCard className="w-5 h-5" />}
              onClick={() => onNavigate("payments")}
            />
          </div>

          {metrics.payments.policyPending ? (
            <InfoBanner message="Live payments are not enabled on this environment. The payment register shows gateway state as recorded; nothing here implies a charge or refund was processed." />
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Needs attention */}
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#6C4CF1]" />
                <h3 className="text-base font-bold font-display text-[#17131D]">Needs attention</h3>
              </div>

              {attention.length === 0 ? (
                <EmptyState title="Nothing is waiting" description="No pending appointments, open tickets, SOS incidents or unverified doctors." />
              ) : (
                <ul className="space-y-2">
                  {attention.map((row) => (
                    <li key={row.key}>
                      <button
                        onClick={() => onNavigate(row.tab)}
                        className="w-full flex items-center justify-between gap-3 p-3 rounded-2xl border border-[#E7E2EB] hover:border-[#C9B8FF] hover:bg-[#FBFAFF] transition-colors text-left"
                      >
                        <span className="flex items-center gap-2.5 text-xs font-bold text-[#17131D]">
                          <span className="text-[#6C4CF1]">{row.icon}</span>
                          {row.label}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-full bg-[#F5F2FF] text-[#6C4CF1] text-[11px] font-black">
                            {row.count}
                          </span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-[#918A98]" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Today's schedule */}
            <div className="lg:col-span-3 bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-[#6C4CF1]" />
                  <h3 className="text-base font-bold font-display text-[#17131D]">Today&apos;s schedule</h3>
                </div>
                <button
                  onClick={() => onNavigate("appointments")}
                  className="text-[11px] font-bold text-[#6C4CF1] inline-flex items-center gap-1"
                >
                  Full register <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>

              {scheduleLoading ? (
                <p className="py-6 text-center text-xs text-[#6E6875]">Loading today&apos;s appointments...</p>
              ) : scheduleError ? (
                <p className="py-6 text-center text-xs font-bold text-red-600">{scheduleError}</p>
              ) : todayAppointments.length === 0 ? (
                <EmptyState title="No appointments today" description="Bookings scheduled for the operational day will appear here." />
              ) : (
                <ul className="divide-y divide-[#F5F2FF]">
                  {todayAppointments.map((appointment) => (
                    <li key={appointment.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#17131D] truncate">
                          {appointment.patient.displayName} · {appointment.doctor.displayName}
                        </p>
                        <p className="text-[11px] text-[#6E6875]">
                          {formatDateTime(appointment.startsAt, appointment.timeZone)} • {appointment.sessionType}
                        </p>
                      </div>
                      <StatusPill status={appointment.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Market coverage */}
          <div className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#6C4CF1]" />
              <h3 className="text-base font-bold font-display text-[#17131D]">Users by market</h3>
            </div>
            {countryRows.length === 0 ? (
              <p className="text-xs text-[#6E6875]">No registered accounts yet.</p>
            ) : (
              <div className="space-y-2.5">
                {countryRows.map(([code, row]) => {
                  const share = metrics.totalUsers > 0 ? Math.round((row.users / metrics.totalUsers) * 100) : 0;
                  return (
                    <div key={code} className="flex items-center gap-3">
                      <span className="text-[11px] font-black text-[#17131D] w-8">{code}</span>
                      <div className="flex-1 h-2 rounded-full bg-[#F5F2FF] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#6C4CF1] to-[#9B6BFF]"
                          style={{ width: `${Math.max(share, row.users > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-[#6E6875] w-24 text-right">
                        {row.users.toLocaleString()} ({share}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
