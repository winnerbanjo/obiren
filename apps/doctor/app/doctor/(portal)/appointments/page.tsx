"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarClock, ChevronDown, Search } from "lucide-react";
import { doctorApi, DoctorAppointment } from "@obiren/api-client";
import { Card, EmptyState, ErrorBanner, Loading, StatusPill, formatDateTime } from "@/components/ui";
import ObirenDatePicker from "@/components/date-picker";

const STATUS_FILTERS = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "reschedule_requested", label: "Reschedule requested" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "rejected", label: "Rejected" },
  { key: "no_show", label: "No-show" },
];

const RANGE_FILTERS = [
  { key: "", label: "All dates" },
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "custom", label: "Custom range" },
];

function dayBounds(kind: "today" | "upcoming" | "past") {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  if (kind === "today") return { from: startOfToday.toISOString(), to: startOfTomorrow.toISOString() };
  if (kind === "upcoming") return { from: startOfToday.toISOString(), to: undefined };
  return { from: undefined, to: startOfToday.toISOString() };
}

function AppointmentsInner() {
  const params = useSearchParams();
  const [status, setStatus] = useState(params.get("status") || "");
  const [range, setRange] = useState(params.get("range") || "");
  const [sessionType, setSessionType] = useState(params.get("sessionType") || "");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState(params.get("q") || "");
  const [debounced, setDebounced] = useState(search);
  const [items, setItems] = useState<DoctorAppointment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [timeZone, setTimeZone] = useState<string>("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const query = useMemo(() => {
    const bounds =
      range === "today" || range === "upcoming" || range === "past"
        ? dayBounds(range)
        : range === "custom"
          ? {
              from: customFrom ? new Date(`${customFrom}T00:00:00`).toISOString() : undefined,
              to: customTo ? new Date(`${customTo}T23:59:59`).toISOString() : undefined,
            }
          : { from: undefined, to: undefined };
    return {
      status: status || undefined,
      sessionType: sessionType || undefined,
      q: debounced || undefined,
      ...bounds,
      limit: 20,
    };
  }, [status, range, sessionType, debounced, customFrom, customTo]);

  const load = useCallback(
    async (append = false, nextCursor?: string | null) => {
      append ? setLoadingMore(true) : setLoading(true);
      setError("");
      try {
        const response = await doctorApi.listAppointments({ ...query, cursor: nextCursor || undefined });
        setItems((current) => (append ? [...current, ...response.appointments] : response.appointments));
        setCursor(response.nextCursor);
        if (!timeZone) {
          const me = await doctorApi.me();
          setTimeZone(me.timeZone);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load appointments.");
      } finally {
        append ? setLoadingMore(false) : setLoading(false);
      }
    },
    // timeZone is only read to avoid a redundant profile call after the first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Appointments</h1>
        <p className="text-xs text-[#6E6875]">
          Every appointment booked through the Obiren app is assigned to you here. Patient details are limited to what the
          consultation needs.
        </p>
      </div>

      <Card className="p-3 space-y-3">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setStatus(filter.key)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-[11px] font-bold ${
                status === filter.key ? "bg-[#6C4CF1] text-white" : "bg-[#F5F2FF] text-[#6E6875] hover:text-[#6C4CF1]"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#9B94A3] absolute left-3 top-2.5" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search reference or patient name"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E7E2EB] text-xs focus:outline-none focus:ring-2 focus:ring-[#6C4CF1]/30"
              aria-label="Search appointments"
            />
          </div>
          <select
            value={sessionType}
            onChange={(event) => setSessionType(event.target.value)}
            className="px-3 py-2 rounded-xl border border-[#E7E2EB] text-xs bg-white font-semibold"
            aria-label="Consultation type filter"
          >
            <option value="">All consultation types</option>
            <option value="video">Video</option>
            <option value="audio">Audio</option>
            <option value="text">Text</option>
            <option value="clinic">Clinic</option>
          </select>
          <select
            value={range}
            onChange={(event) => setRange(event.target.value)}
            className="px-3 py-2 rounded-xl border border-[#E7E2EB] text-xs bg-white font-semibold"
            aria-label="Date filter"
          >
            {RANGE_FILTERS.map((filter) => (
              <option key={filter.key} value={filter.key}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>
        {range === "custom" && (
          <div className="grid gap-2 rounded-xl border border-[#EFE8FA] bg-[#FCFAFF] p-2.5 sm:grid-cols-2">
            <ObirenDatePicker
              label="From"
              value={customFrom}
              onChange={setCustomFrom}
              max={customTo || undefined}
              ariaLabel="Custom range start date"
              placeholder="Start date"
            />
            <ObirenDatePicker
              label="To"
              value={customTo}
              onChange={setCustomTo}
              min={customFrom || undefined}
              ariaLabel="Custom range end date"
              placeholder="End date"
              align="right"
            />
          </div>
        )}
      </Card>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <Loading label="Loading appointments…" />
      ) : items.length === 0 ? (
        <Card className="p-5">
          <EmptyState
            title="No appointments match these filters"
            hint="Try a different status or date range. New bookings appear the moment a patient pays or confirms."
            icon={<CalendarClock className="w-8 h-8" />}
          />
        </Card>
      ) : (
        <Card className="divide-y divide-[#F0EDF3]">
          {items.map((appointment) => (
            <Link
              key={appointment.id}
              href={`/doctor/appointments/${appointment.id}`}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 hover:bg-[#F9F7FC]"
            >
              <div className="sm:w-40 shrink-0">
                <p className="text-[11px] font-bold">{formatDateTime(appointment.startsAt, timeZone || appointment.timeZone)}</p>
                <p className="text-[10px] text-[#6E6875]">{appointment.durationMinutes} min · {appointment.sessionType}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{appointment.patient?.displayName ?? "Patient"}</p>
                <p className="text-[10px] text-[#6E6875] truncate">
                  {appointment.reference} · {appointment.paymentStatus ? `payment ${appointment.paymentStatus}` : "no payment required"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {appointment.meetingUrl ? (
                  <span className="text-[10px] font-bold text-[#6C4CF1] bg-[#F5F2FF] border border-[#E7E2EB] rounded-full px-2 py-0.5">
                    link shared
                  </span>
                ) : (
                  appointment.sessionType !== "clinic" &&
                  !["cancelled", "rejected", "no_show", "expired", "completed"].includes(appointment.status) && (
                    <span className="text-[10px] font-bold text-[#6E6875] border border-dashed border-[#E7E2EB] rounded-full px-2 py-0.5">
                      no link
                    </span>
                  )
                )}
                {appointment.actions.confirm && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                    needs action
                  </span>
                )}
                <StatusPill status={appointment.status} label={appointment.statusLabel} />
              </div>
            </Link>
          ))}
        </Card>
      )}

      {cursor && !loading && (
        <button
          onClick={() => load(true, cursor)}
          disabled={loadingMore}
          className="w-full py-2.5 rounded-xl border border-[#E7E2EB] bg-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          {loadingMore ? "Loading…" : "Load more"} <ChevronDown className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default function AppointmentsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AppointmentsInner />
    </Suspense>
  );
}
