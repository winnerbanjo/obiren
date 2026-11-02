"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck, CalendarClock, CheckCircle2, Clock, Inbox, Plus, Video } from "lucide-react";
import { doctorApi, DoctorAppointment, DoctorDashboardData, getAccessToken } from "@obiren/api-client";
import { Card, EmptyState, ErrorBanner, SectionTitle, StatusPill, formatDateTime, formatTime } from "@/components/ui";

/**
 * Short-lived, in-memory dashboard cache keyed by the current access token.
 * Returning to the dashboard is instant while a fresh copy loads in the
 * background. The token key means a new session can never read another
 * account's cached appointments.
 */
const DASHBOARD_CACHE_TTL_MS = 5 * 60_000;
const dashboardCache = new Map<string, { at: number; data: DoctorDashboardData }>();
let dashboardInFlight: { key: string; promise: Promise<DoctorDashboardData> } | null = null;

function readDashboardCache(): DoctorDashboardData | null {
  const key = getAccessToken();
  if (!key) return null;
  const entry = dashboardCache.get(key);
  if (!entry || Date.now() - entry.at > DASHBOARD_CACHE_TTL_MS) {
    if (entry) dashboardCache.delete(key);
    return null;
  }
  return entry.data;
}

function writeDashboardCache(data: DoctorDashboardData) {
  const key = getAccessToken();
  if (!key) return;
  if (dashboardCache.size >= 4) dashboardCache.delete(dashboardCache.keys().next().value as string);
  dashboardCache.set(key, { at: Date.now(), data });
}

function fetchDashboard() {
  const key = getAccessToken() ?? "anonymous";
  if (dashboardInFlight?.key === key) return dashboardInFlight.promise;
  const promise = doctorApi.dashboard().finally(() => {
    if (dashboardInFlight?.promise === promise) dashboardInFlight = null;
  });
  dashboardInFlight = { key, promise };
  return promise;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading your dashboard">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="h-6 w-52 animate-pulse rounded-lg bg-[#EDE8F5]" />
          <div className="h-3 w-40 animate-pulse rounded bg-[#F1EDF7]" />
        </div>
        <div className="h-9 w-36 animate-pulse rounded-xl bg-[#E9E1FB]" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="rounded-2xl border border-[#EFEAF6] bg-white p-4">
            <div className="h-8 w-8 animate-pulse rounded-xl bg-[#F0EBFA]" />
            <div className="mt-3 h-6 w-10 animate-pulse rounded bg-[#EAE3F5]" />
            <div className="mt-2 h-2.5 w-20 animate-pulse rounded bg-[#F2EEF8]" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#EFEAF6] bg-white p-5 lg:col-span-2">
          <div className="h-4 w-36 animate-pulse rounded bg-[#EAE3F5]" />
          <div className="mt-5 h-24 animate-pulse rounded-xl bg-[#F7F4FC]" />
        </div>
        <div className="rounded-2xl border border-[#EFEAF6] bg-white p-5">
          <div className="h-4 w-32 animate-pulse rounded bg-[#EAE3F5]" />
          <div className="mt-5 h-24 animate-pulse rounded-xl bg-[#F7F4FC]" />
        </div>
      </div>
    </div>
  );
}

function AppointmentRow({ appointment, timeZone }: { appointment: DoctorAppointment; timeZone: string }) {
  return (
    <Link
      href={`/doctor/appointments/${appointment.id}`}
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#F9F7FC] transition-colors"
    >
      <div className="w-14 shrink-0 text-center">
        <p className="text-xs font-bold">{formatTime(appointment.startsAt, timeZone)}</p>
        <p className="text-[9px] uppercase font-bold text-[#9B94A3]">{appointment.durationMinutes} min</p>
      </div>
      <div className="w-px h-8 bg-[#E7E2EB]" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold truncate">{appointment.patient?.displayName ?? "Patient"}</p>
        <p className="text-[10px] text-[#6E6875] capitalize flex items-center gap-1">
          {appointment.sessionType === "video" ? <Video className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          {appointment.sessionType} · {appointment.reference}
        </p>
      </div>
      <StatusPill status={appointment.status} label={appointment.statusLabel} />
    </Link>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DoctorDashboardData | null>(() => readDashboardCache());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(() => readDashboardCache() === null);

  const load = useCallback(async (background = false) => {
    if (background) setLoading(false);
    else setLoading(true);
    setError("");
    try {
      const fresh = await fetchDashboard();
      setData(fresh);
      writeDashboardCache(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = readDashboardCache();
    void load(Boolean(cached));
  }, [load]);

  if (loading && !data) return <DashboardSkeleton />;
  if (error && !data) {
    return (
      <div className="space-y-3">
        <ErrorBanner message={error} />
        <button onClick={() => void load(false)} className="text-xs font-bold text-[#6C4CF1]">
          Try again
        </button>
      </div>
    );
  }
  if (!data) return null;

  const timeZone = data.doctor.timeZone;
  // Professional titles are stored with the name, so "Dr. Ada Obi" must greet
  // Ada, not "Dr.".
  const firstName =
    data.doctor.displayName.replace(/^(dr|prof|mr|mrs|ms|miss)\.?\s+/i, "").trim().split(/\s+/)[0] || "Doctor";
  const cards = [
    { label: "Today", value: data.summary.today, icon: CalendarCheck, tone: "bg-[#F5F2FF] text-[#6C4CF1]" },
    { label: "Upcoming", value: data.summary.upcoming, icon: CalendarClock, tone: "bg-sky-50 text-sky-600" },
    { label: "Pending requests", value: data.summary.pending, icon: Clock, tone: "bg-amber-50 text-amber-600" },
    { label: "Completed", value: data.summary.completed, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600" },
  ];

  return (
    <div className="space-y-5">
      {error && <ErrorBanner message={`${error} Showing your last loaded dashboard.`} />}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Welcome back, {firstName}</h1>
          <p className="text-xs text-[#6E6875]">
            {data.today.date} · times shown in {timeZone}
          </p>
        </div>
        <Link
          href="/doctor/availability"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#6C4CF1] text-white text-xs font-bold"
        >
          <Plus className="w-3.5 h-3.5" /> Manage availability
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="p-4">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${card.tone}`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold mt-2">{card.value}</p>
              <p className="text-[10px] uppercase font-bold text-[#6E6875] tracking-wide">{card.label}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2 space-y-2">
          <SectionTitle
            title="Today's schedule"
            hint={`${data.today.appointments.length} appointment(s) on ${data.today.date}`}
            action={
              <Link href="/doctor/appointments?range=today" className="text-[11px] font-bold text-[#6C4CF1]">
                View all
              </Link>
            }
          />
          {data.today.appointments.length === 0 ? (
            <EmptyState title="No appointments today" hint="New bookings from the Obiren app will appear here." />
          ) : (
            <div className="divide-y divide-[#F0EDF3]">
              {data.today.appointments.map((appointment) => (
                <AppointmentRow key={appointment.id} appointment={appointment} timeZone={timeZone} />
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 space-y-3">
          <SectionTitle title="Availability snapshot" hint="Bookable hours patients can see" />
          {data.availability.configuredDays.length === 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] text-[#6E6875]">
                You have no working hours configured, so patients cannot book you yet.
              </p>
              <Link href="/doctor/availability" className="inline-flex items-center gap-1 text-xs font-bold text-[#6C4CF1]">
                Set your weekly hours <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {data.availability.weeklyGrid
                .filter((day) => data.availability.configuredDays.includes(day.dayOfWeek))
                .map((day) => (
                  <div key={day.dayOfWeek} className="flex items-center justify-between text-[11px]">
                    <span className="font-bold">{day.label}</span>
                    <span className="text-[#6E6875]">
                      {day.slots.length === 0
                        ? "—"
                        : day.slots.map((slot) => `${slot.startTime}–${slot.endTime}`).join(", ")}
                    </span>
                  </div>
                ))}
              <p className="text-[10px] text-[#6E6875] pt-2 border-t border-[#F0EDF3]">
                Next bookable:{" "}
                <span className="font-bold text-[#17131D]">
                  {data.availability.nextAvailableAt ? formatDateTime(data.availability.nextAvailableAt, timeZone) : "none in the next 14 days"}
                </span>
              </p>
            </div>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2 space-y-2">
          <SectionTitle
            title="Pending requests"
            hint="Bookings waiting for your decision"
            action={
              <Link href="/doctor/appointments?status=pending" className="text-[11px] font-bold text-[#6C4CF1]">
                Review
              </Link>
            }
          />
          {data.pendingRequests.length === 0 ? (
            <EmptyState title="Nothing needs your attention" hint="Requests awaiting confirmation will show up here." icon={<CheckCircle2 className="w-8 h-8" />} />
          ) : (
            <div className="divide-y divide-[#F0EDF3]">
              {data.pendingRequests.map((appointment) => (
                <AppointmentRow key={appointment.id} appointment={appointment} timeZone={timeZone} />
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 space-y-2">
          <SectionTitle title="Upcoming appointments" hint="Next confirmed sessions" />
          {data.upcoming.length === 0 ? (
            <EmptyState title="No upcoming appointments" />
          ) : (
            <div className="divide-y divide-[#F0EDF3]">
              {data.upcoming.slice(0, 4).map((appointment) => (
                <Link key={appointment.id} href={`/doctor/appointments/${appointment.id}`} className="block py-2.5">
                  <p className="text-[11px] font-bold">{appointment.patient?.displayName ?? "Patient"}</p>
                  <p className="text-[10px] text-[#6E6875]">{formatDateTime(appointment.startsAt, timeZone)}</p>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5 space-y-2">
        <SectionTitle title="Recent activity" hint="Latest changes on your bookings" />
        {data.recentActivity.length === 0 ? (
          <EmptyState title="No activity yet" icon={<Inbox className="w-8 h-8" />} />
        ) : (
          <ul className="divide-y divide-[#F0EDF3]">
            {data.recentActivity.map((item, index) => (
              <li key={`${item.bookingId}-${index}`} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold capitalize">
                    {item.to.replace(/_/g, " ")}
                    <span className="font-normal text-[#6E6875]"> · {item.actorRole}</span>
                  </p>
                  {item.reason && <p className="text-[10px] text-[#6E6875]">“{item.reason}”</p>}
                </div>
                <Link href={`/doctor/appointments/${item.bookingId}`} className="text-[10px] text-[#6E6875] whitespace-nowrap">
                  {formatDateTime(item.at, timeZone)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
