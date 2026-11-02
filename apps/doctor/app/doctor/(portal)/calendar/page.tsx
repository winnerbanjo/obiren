"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CalendarDays,
  CalendarOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
} from "lucide-react";
import { doctorApi, DoctorAppointment } from "@obiren/api-client";
import { Card, EmptyState, ErrorBanner, Loading, StatusPill, formatDateTime, formatTime } from "@/components/ui";
import {
  WEEKDAY_LABELS,
  dateKey,
  longDateLabel,
  monthLabel,
  monthMatrix,
  parseDateKey,
  startOfDay,
} from "@/components/calendar-utils";

interface TimeOff {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}

function chipClass(status: string): string {
  if (status === "pending" || status === "reschedule_requested") {
    return "border-amber-200/80 bg-amber-50 text-amber-800";
  }
  if (status === "confirmed") return "border-[#DED1FF] bg-[#F1EBFF] text-[#5536C9]";
  if (status === "completed") return "border-emerald-200/80 bg-emerald-50 text-emerald-700";
  if (status === "cancelled" || status === "rejected") {
    return "border-rose-200/80 bg-rose-50 text-rose-700";
  }
  return "border-[#ECE7F2] bg-[#F8F6FB] text-[#6E6875]";
}

export default function CalendarPage() {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState(dateKey(today));
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
  const [timeZone, setTimeZone] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const from = new Date(year, month, 1).toISOString();
      const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      const [bookings, blocks, me] = await Promise.all([
        doctorApi.listAppointments({ from, to, limit: 100 }),
        doctorApi.timeOff(),
        doctorApi.me(),
      ]);
      setAppointments(bookings.appointments);
      setTimeOff(blocks.timeOff);
      setTimeZone(me.timeZone);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your calendar.");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const byDay = useMemo(() => {
    const map = new Map<string, DoctorAppointment[]>();
    for (const appointment of appointments) {
      const key = dateKey(new Date(appointment.startsAt));
      map.set(key, [...(map.get(key) ?? []), appointment]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }
    return map;
  }, [appointments]);

  const blockedDays = useMemo(() => {
    const set = new Set<string>();
    for (const block of timeOff) {
      const start = new Date(block.startsAt);
      const end = new Date(block.endsAt);
      for (
        let cursor = startOfDay(start);
        cursor <= end;
        cursor = new Date(cursor.getTime() + 86_400_000)
      ) {
        set.add(dateKey(cursor));
      }
    }
    return set;
  }, [timeOff]);

  const cells = useMemo(() => monthMatrix(year, month), [year, month]);
  const label = monthLabel(year, month);
  const todayKey = dateKey(today);
  const selectedDate = parseDateKey(selectedKey) ?? new Date(year, month, 1);
  const selectedAppointments = byDay.get(selectedKey) ?? [];
  const selectedBlocks = useMemo(() => {
    const dayStart = startOfDay(selectedDate).getTime();
    const dayEnd = dayStart + 86_400_000;
    return timeOff.filter(
      (block) =>
        new Date(block.startsAt).getTime() < dayEnd && new Date(block.endsAt).getTime() > dayStart,
    );
  }, [selectedDate, timeOff]);
  const pendingCount = appointments.filter(
    (appointment) => appointment.status === "pending" || appointment.status === "reschedule_requested",
  ).length;
  const completedCount = appointments.filter((appointment) => appointment.status === "completed").length;
  const nextAppointment = useMemo(
    () =>
      [...appointments]
        .filter(
          (appointment) =>
            new Date(appointment.startsAt).getTime() >= Date.now() &&
            !["cancelled", "rejected", "expired", "no_show"].includes(appointment.status),
        )
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0],
    [appointments],
  );

  const move = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
    setSelectedKey(dateKey(next));
  };

  const goToday = () => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelectedKey(dateKey(now));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E6DCFF] bg-[#F7F3FF] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#6C4CF1]">
            <Sparkles className="h-3 w-3" /> Practice calendar
          </span>
          <h1 className="mt-2 text-xl font-bold">Calendar</h1>
          <p className="text-xs text-[#6E6875]">
            Appointments and blocked time in {timeZone || "your timezone"}.
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-2xl border border-[#E7E2EB] bg-white p-1 shadow-[0_8px_24px_-20px_rgba(44,26,100,0.6)]">
          <button
            type="button"
            onClick={goToday}
            className="rounded-xl px-2.5 py-2 text-[10px] font-bold text-[#6C4CF1] transition-colors hover:bg-[#F4EFFF]"
          >
            Today
          </button>
          <span className="h-5 w-px bg-[#EFEAF5]" />
          <button
            type="button"
            onClick={() => move(-1)}
            className="rounded-xl p-2 text-[#6E6875] transition-colors hover:bg-[#F4EFFF] hover:text-[#6C4CF1]"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-32 px-1 text-center text-xs font-bold">{label}</span>
          <button
            type="button"
            onClick={() => move(1)}
            className="rounded-xl p-2 text-[#6E6875] transition-colors hover:bg-[#F4EFFF] hover:text-[#6C4CF1]"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <Loading label="Loading calendar…" />
      ) : (
        <Card className="overflow-hidden border-[#EAE2FF] shadow-[0_24px_70px_-48px_rgba(58,32,130,0.55)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0EBF8] bg-gradient-to-r from-[#F7F2FF] via-white to-[#FBF8FF] px-4 py-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#8A79B8]">Month overview</p>
              <p className="text-base font-bold text-[#17131D]">{label}</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-bold uppercase tracking-wide text-[#7D738B]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-gradient-to-br from-[#6C4CF1] to-[#9B6BFF]" />
                Sessions
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                Blocked
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full border-2 border-[#6C4CF1] bg-white" />
                Today
              </span>
            </div>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_304px]">
            <div className="p-3 sm:p-4">
              <div className="mb-1.5 grid grid-cols-7 gap-1.5 rounded-xl bg-[#F7F3FF] px-1 py-1.5">
                {WEEKDAY_LABELS.map((day) => (
                  <p
                    key={day}
                    className="text-center text-[9px] font-bold uppercase tracking-[0.12em] text-[#8A79B8]"
                  >
                    {day}
                  </p>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {cells.map((date, index) => {
                  if (!date) {
                    return (
                      <div
                        key={`empty-${index}`}
                        className="min-h-[64px] rounded-xl border border-transparent bg-[#FBF9FE]/70 sm:min-h-[76px]"
                      />
                    );
                  }
                  const key = dateKey(date);
                  const dayAppointments = byDay.get(key) ?? [];
                  const isToday = key === todayKey;
                  const isSelected = key === selectedKey;
                  const isBlocked = blockedDays.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedKey(key)}
                      aria-label={`${longDateLabel(date)}, ${dayAppointments.length} appointment(s)`}
                      aria-pressed={isSelected}
                      className={`group relative min-h-[64px] rounded-xl border p-1.5 text-left transition-all sm:min-h-[76px] ${
                        isSelected
                          ? "border-[#BFA9FF] bg-[#FBF9FF] shadow-[0_10px_24px_-18px_rgba(108,76,241,0.85)] ring-1 ring-[#6C4CF1]/25"
                          : isToday
                            ? "border-[#D7C8FF] bg-white hover:border-[#BFA9FF] hover:bg-[#FDFBFF]"
                            : "border-[#F0ECF6] bg-white hover:border-[#D9CFF5] hover:bg-[#FDFBFF]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                            isToday
                              ? "bg-gradient-to-br from-[#6C4CF1] to-[#9B6BFF] text-white shadow-[0_4px_10px_-5px_rgba(108,76,241,0.9)]"
                              : isSelected
                                ? "bg-[#EFE7FF] text-[#5536C9]"
                                : "text-[#6E6875] group-hover:text-[#5536C9]"
                          }`}
                        >
                          {date.getDate()}
                        </span>
                        {isBlocked && (
                          <span
                            className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 p-0.5 text-amber-600"
                            title="Blocked time"
                          >
                            <CalendarOff className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </div>

                      <div className="mt-1 space-y-0.5">
                        {dayAppointments.slice(0, 2).map((appointment) => (
                          <span
                            key={appointment.id}
                            className={`block truncate rounded-md border px-1 py-0.5 text-[8.5px] font-bold leading-tight ${chipClass(appointment.status)}`}
                            title={`${appointment.patient?.displayName ?? "Patient"} · ${appointment.statusLabel}`}
                          >
                            {formatTime(appointment.startsAt, timeZone)}
                            <span className="hidden sm:inline"> · {appointment.patient?.displayName ?? "Patient"}</span>
                          </span>
                        ))}
                        {dayAppointments.length > 2 && (
                          <span className="block pl-1 text-[8.5px] font-bold text-[#6C4CF1]">
                            +{dayAppointments.length - 2} more
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <aside className="border-t border-[#F0EBF8] bg-[#FDFCFF] p-4 lg:border-l lg:border-t-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#8A79B8]">Selected day</p>
              <p className="mt-0.5 text-sm font-bold text-[#17131D]">{longDateLabel(selectedDate)}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-[#F2ECFF] px-2 py-0.5 text-[9px] font-bold text-[#5A38D6]">
                  {selectedAppointments.length} session{selectedAppointments.length === 1 ? "" : "s"}
                </span>
                {selectedAppointments.some(
                  (appointment) =>
                    appointment.status === "pending" || appointment.status === "reschedule_requested",
                ) && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700">
                    Needs action
                  </span>
                )}
                {selectedBlocks.length > 0 && (
                  <span className="rounded-full bg-[#FFF7EA] px-2 py-0.5 text-[9px] font-bold text-amber-700">
                    Blocked
                  </span>
                )}
              </div>

              <div className="mt-3 space-y-1.5">
                {selectedAppointments.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#E7E0F2] bg-white/70 px-3 py-6 text-center">
                    <CalendarDays className="mx-auto h-6 w-6 text-[#C4B8D8]" />
                    <p className="mt-1.5 text-[11px] font-bold text-[#6E6875]">No sessions</p>
                    <p className="text-[10px] text-[#9B94A3]">A calm day in your practice.</p>
                  </div>
                ) : (
                  selectedAppointments.map((appointment) => (
                    <Link
                      key={appointment.id}
                      href={`/doctor/appointments/${appointment.id}`}
                      className="block rounded-xl border border-[#EFEAF7] bg-white p-2.5 transition-all hover:border-[#CFC0F5] hover:shadow-[0_8px_20px_-16px_rgba(58,32,130,0.5)]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#5536C9]">
                          <Clock className="h-3 w-3" />
                          {formatTime(appointment.startsAt, timeZone)}
                        </span>
                        <StatusPill status={appointment.status} label={appointment.statusLabel} />
                      </div>
                      <p className="mt-1 truncate text-[11px] font-bold text-[#17131D]">
                        {appointment.patient?.displayName ?? "Patient"}
                      </p>
                      <p className="truncate text-[9px] capitalize text-[#8C8399]">
                        {appointment.sessionType} · {appointment.durationMinutes} min
                      </p>
                    </Link>
                  ))
                )}

                {selectedBlocks.map((block) => (
                  <div
                    key={block.id}
                    className="rounded-xl border border-amber-200/70 bg-[#FFF9EF] p-2.5 text-[10px] text-amber-800"
                  >
                    <p className="flex items-center gap-1 font-bold">
                      <CalendarOff className="h-3 w-3" /> Blocked time
                    </p>
                    <p className="mt-0.5">
                      {formatTime(block.startsAt, timeZone)} – {formatTime(block.endsAt, timeZone)}
                    </p>
                    {block.reason && <p className="mt-0.5 text-[9px] text-amber-700/80">{block.reason}</p>}
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold">Month at a glance</p>
              <p className="text-[10px] text-[#6E6875]">Live totals from your booked sessions</p>
            </div>
            <span className="rounded-full bg-[#F5F2FF] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-[#6C4CF1]">
              {label}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: "Sessions", value: appointments.length, icon: CalendarDays },
              { label: "Pending", value: pendingCount, icon: CalendarClock },
              { label: "Completed", value: completedCount, icon: CheckCircle2 },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="rounded-xl border border-[#F0EBF7] bg-[#FCFAFF] p-2.5">
                  <Icon className="h-3.5 w-3.5 text-[#6C4CF1]" />
                  <p className="mt-1.5 text-lg font-bold leading-none">{stat.value}</p>
                  <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-[#8C8399]">{stat.label}</p>
                </div>
              );
            })}
          </div>
          {nextAppointment && (
            <Link
              href={`/doctor/appointments/${nextAppointment.id}`}
              className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-[#EFE7FF] bg-[#FBF8FF] px-3 py-2 text-[10px] transition-colors hover:border-[#D4C5FA]"
            >
              <span className="font-bold text-[#5536C9]">Next session</span>
              <span className="truncate text-[#6E6875]">
                {formatDateTime(nextAppointment.startsAt, timeZone)} ·{" "}
                {nextAppointment.patient?.displayName ?? "Patient"}
              </span>
            </Link>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold">Blocked time</p>
              <p className="text-[10px] text-[#6E6875]">Leave and one-off unavailability</p>
            </div>
            <Link href="/doctor/availability" className="text-[11px] font-bold text-[#6C4CF1]">
              Manage
            </Link>
          </div>
          {timeOff.length === 0 ? (
            <EmptyState
              title="No blocked periods"
              hint="Add leave or one-off unavailability from Availability."
              icon={<CalendarOff className="w-8 h-8" />}
            />
          ) : (
            <ul className="mt-2 divide-y divide-[#F3EFF8]">
              {timeOff.slice(0, 5).map((block) => (
                <li key={block.id} className="py-2 text-[11px]">
                  <p className="font-bold">
                    {new Intl.DateTimeFormat("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    }).format(new Date(block.startsAt))}
                    {" – "}
                    {new Intl.DateTimeFormat("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    }).format(new Date(block.endsAt))}
                  </p>
                  {block.reason && <p className="text-[10px] text-[#6E6875]">{block.reason}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
