"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarOff, Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { doctorApi, DoctorScheduleData, DoctorScheduleRule } from "@obiren/api-client";
import { Card, EmptyState, ErrorBanner, Loading, SectionTitle, SuccessBanner, minutesToTime, timeToMinutes } from "@/components/ui";
import ObirenDatePicker from "@/components/date-picker";

const DAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const TIMEZONES = [
  "Africa/Lagos",
  "Africa/Accra",
  "Africa/Abuja",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Africa/Cairo",
  "Europe/London",
  "UTC",
];

const SESSION_TYPES: DoctorScheduleRule["sessionType"][] = ["video", "audio", "text", "clinic"];

interface DraftRule {
  startMinutes: number;
  endMinutes: number;
  sessionType: DoctorScheduleRule["sessionType"];
}

type Draft = Record<number, DraftRule[]>;

function toDraft(rules: DoctorScheduleRule[]): Draft {
  const draft: Draft = {};
  for (const rule of rules) {
    draft[rule.dayOfWeek] = [...(draft[rule.dayOfWeek] ?? []), { startMinutes: rule.startMinutes, endMinutes: rule.endMinutes, sessionType: rule.sessionType }];
  }
  for (let day = 0; day < 7; day += 1) {
    draft[day] = (draft[day] ?? []).sort((a, b) => a.startMinutes - b.startMinutes);
  }
  return draft;
}

function toLocalInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function AvailabilityPage() {
  const [schedule, setSchedule] = useState<DoctorScheduleData | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [timeZone, setTimeZone] = useState("Africa/Lagos");
  const [duration, setDuration] = useState(30);
  const [buffer, setBuffer] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [preview, setPreview] = useState<Array<{ id: string; startsAt: string; endsAt: string; sessionType: string }> | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  const [offStart, setOffStart] = useState("");
  const [offEnd, setOffEnd] = useState("");
  const [offReason, setOffReason] = useState("");
  const [offBusy, setOffBusy] = useState(false);
  const [offError, setOffError] = useState("");
  const [affected, setAffected] = useState<Array<{ id: string; startsAt: string; endsAt: string; status: string; patient: { displayName: string } | null }>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await doctorApi.schedule();
      setSchedule(data);
      setDraft(toDraft(data.rules));
      setTimeZone(data.timeZone);
      setDuration(data.consultationDurationMinutes);
      setBuffer(data.bufferMinutes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your availability.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const zones = useMemo(() => (TIMEZONES.includes(timeZone) ? TIMEZONES : [timeZone, ...TIMEZONES]), [timeZone]);

  const updateRule = (day: number, index: number, patch: Partial<DraftRule>) => {
    setDraft((current) => ({
      ...current,
      [day]: (current[day] ?? []).map((rule, i) => (i === index ? { ...rule, ...patch } : rule)),
    }));
  };

  const addRule = (day: number) => {
    setDraft((current) => {
      const existing = current[day] ?? [];
      const last = existing[existing.length - 1];
      const start = last ? Math.min(last.endMinutes + 30, 20 * 60) : 9 * 60;
      return { ...current, [day]: [...existing, { startMinutes: start, endMinutes: Math.min(start + 240, 22 * 60), sessionType: last?.sessionType ?? "video" }] };
    });
  };

  const removeRule = (day: number, index: number) => {
    setDraft((current) => ({ ...current, [day]: (current[day] ?? []).filter((_, i) => i !== index) }));
  };

  const save = async () => {
    setError("");
    setNotice("");
    const rules: DoctorScheduleRule[] = [];
    for (let day = 0; day < 7; day += 1) {
      const dayRules = [...(draft[day] ?? [])].sort((a, b) => a.startMinutes - b.startMinutes);
      for (let index = 0; index < dayRules.length; index += 1) {
        const rule = dayRules[index];
        if (rule.endMinutes <= rule.startMinutes) {
          setError(`${DAYS[day].label}: end time must be after start time.`);
          return;
        }
        if (index > 0 && dayRules[index - 1].endMinutes > rule.startMinutes) {
          setError(`${DAYS[day].label}: availability periods overlap. Adjust the times so they do not overlap.`);
          return;
        }
        rules.push({ dayOfWeek: day, startMinutes: rule.startMinutes, endMinutes: rule.endMinutes, sessionType: rule.sessionType });
      }
    }

    setSaving(true);
    try {
      const result = await doctorApi.saveSchedule({ timeZone, consultationDurationMinutes: duration, bufferMinutes: buffer, rules });
      setNotice(`Schedule saved. ${result.slotsGenerated} bookable slot(s) generated for patients.`);
      setPreview(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your availability.");
    } finally {
      setSaving(false);
    }
  };

  const runPreview = async () => {
    setPreviewBusy(true);
    setError("");
    try {
      const result = await doctorApi.previewSchedule(14);
      setPreview(result.slots);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not preview slots.");
    } finally {
      setPreviewBusy(false);
    }
  };

  const addTimeOff = async () => {
    setOffError("");
    setNotice("");
    if (!offStart || !offEnd) {
      setOffError("Choose a start and end date/time.");
      return;
    }
    const start = new Date(offStart);
    const end = new Date(offEnd);
    if (end <= start) {
      setOffError("The end must be after the start.");
      return;
    }
    setOffBusy(true);
    try {
      const result = await doctorApi.createTimeOff({ startsAt: start.toISOString(), endsAt: end.toISOString(), reason: offReason.trim() || undefined });
      setAffected(result.affectedAppointments);
      setNotice(result.message);
      setOffStart("");
      setOffEnd("");
      setOffReason("");
      await load();
    } catch (err) {
      setOffError(err instanceof Error ? err.message : "Could not block this time.");
    } finally {
      setOffBusy(false);
    }
  };

  const removeTimeOff = async (id: string) => {
    setOffError("");
    setNotice("");
    try {
      await doctorApi.deleteTimeOff(id);
      setNotice("Blocked period removed.");
      setAffected([]);
      await load();
    } catch (err) {
      setOffError(err instanceof Error ? err.message : "Could not remove this blocked period.");
    }
  };

  if (loading) return <Loading label="Loading availability…" />;
  if (error && !schedule) {
    return (
      <div className="space-y-3">
        <ErrorBanner message={error} />
        <button onClick={load} className="text-xs font-bold text-[#6C4CF1]">Try again</button>
      </div>
    );
  }
  if (!schedule) return null;

  const groupedPreview = (preview ?? []).reduce<Record<string, typeof preview>>((acc, slot) => {
    const key = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone }).format(new Date(slot!.startsAt));
    acc[key] = [...(acc[key] ?? []), slot];
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Availability</h1>
        <p className="text-xs text-[#6E6875]">
          Patients can only book the hours you publish here. Slots are generated server-side from this schedule, your
          duration, buffer, existing bookings and blocked time.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}
      {notice && <SuccessBanner message={notice} />}

      <Card className="p-5 space-y-4">
        <SectionTitle title="Consultation settings" hint="Applied to every working period" />
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-[11px] font-bold space-y-1 block">
            Timezone
            <select
              value={timeZone}
              onChange={(event) => setTimeZone(event.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-[#E7E2EB] text-xs bg-white font-normal"
            >
              {zones.map((zone) => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-bold space-y-1 block">
            Appointment duration
            <select
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
              className="w-full px-2.5 py-2 rounded-xl border border-[#E7E2EB] text-xs bg-white font-normal"
            >
              {[15, 20, 30, 45, 60, 90].map((minutes) => (
                <option key={minutes} value={minutes}>{minutes} minutes</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-bold space-y-1 block">
            Buffer between sessions
            <select
              value={buffer}
              onChange={(event) => setBuffer(Number(event.target.value))}
              className="w-full px-2.5 py-2 rounded-xl border border-[#E7E2EB] text-xs bg-white font-normal"
            >
              {[0, 5, 10, 15, 30].map((minutes) => (
                <option key={minutes} value={minutes}>{minutes} minutes</option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-[10px] text-[#6E6875]">
          Booking approval is <span className="font-bold">{schedule.bookingApprovalMode}</span> and is set by Obiren. Lead time:{" "}
          {schedule.leadTimeMinutes} minutes. Slots are published {schedule.slotGenerationHorizonDays} days ahead.
        </p>
      </Card>

      <Card className="p-5 space-y-3">
        <SectionTitle title="Weekly schedule" hint="Add more than one period per day for breaks or split sessions" />
        <div className="space-y-2">
          {DAYS.map((day) => {
            const rules = draft[day.value] ?? [];
            return (
              <div key={day.value} className={`rounded-xl border p-2.5 ${rules.length ? "border-[#E8E0FF] bg-[#FBFAFF]" : "border-[#F0EDF3]"}`}>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold">{day.label}</p>
                  <button onClick={() => addRule(day.value)} className="inline-flex items-center gap-1 text-[10px] font-bold text-[#6C4CF1]">
                    <Plus className="w-3 h-3" /> Add period
                  </button>
                </div>
                {rules.length === 0 ? (
                  <p className="text-[10px] text-[#9B94A3] mt-1">Not working</p>
                ) : (
                  <div className="mt-1.5 space-y-1.5">
                    {rules.map((rule, index) => (
                      <div key={index} className="flex flex-wrap items-center gap-1.5">
                        <input
                          type="time"
                          value={minutesToTime(rule.startMinutes)}
                          onChange={(event) => updateRule(day.value, index, { startMinutes: timeToMinutes(event.target.value) })}
                          className="px-2 py-1.5 rounded-lg border border-[#E7E2EB] text-[11px]"
                          aria-label={`${day.label} start time`}
                        />
                        <span className="text-[10px] text-[#9B94A3]">to</span>
                        <input
                          type="time"
                          value={minutesToTime(rule.endMinutes)}
                          onChange={(event) => updateRule(day.value, index, { endMinutes: timeToMinutes(event.target.value) })}
                          className="px-2 py-1.5 rounded-lg border border-[#E7E2EB] text-[11px]"
                          aria-label={`${day.label} end time`}
                        />
                        <select
                          value={rule.sessionType}
                          onChange={(event) => updateRule(day.value, index, { sessionType: event.target.value as DraftRule["sessionType"] })}
                          className="px-2 py-1.5 rounded-lg border border-[#E7E2EB] text-[11px] bg-white capitalize"
                          aria-label={`${day.label} consultation type`}
                        >
                          {SESSION_TYPES.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                        <button onClick={() => removeRule(day.value, index)} className="p-1.5 text-red-600" aria-label={`Remove ${day.label} period`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6C4CF1] text-white text-xs font-bold disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save schedule
          </button>
          <button
            onClick={runPreview}
            disabled={previewBusy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#E7E2EB] bg-white text-xs font-bold disabled:opacity-60"
          >
            {previewBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Preview bookable slots
          </button>
        </div>

        {preview !== null && (
          <div className="border-t border-[#F0EDF3] pt-3 space-y-2">
            <p className="text-[11px] font-bold">Patients can book these slots (next 14 days)</p>
            {preview.length === 0 ? (
              <p className="text-[11px] text-[#6E6875]">No bookable slots yet. Save a schedule with at least one working day.</p>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(groupedPreview).map(([day, slots]) => (
                  <div key={day} className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] font-bold w-28">{day}</span>
                    {slots?.map((slot) => (
                      <span key={slot!.id} className="text-[10px] px-1.5 py-0.5 rounded bg-[#F5F2FF] text-[#6C4CF1] font-bold">
                        {new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(new Date(slot!.startsAt))}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-3">
        <SectionTitle
          title="Time off and blocked dates"
          hint="Blocking time never cancels a booking silently — you will see any affected appointments"
        />

        {affected.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
            <p className="text-[11px] font-bold text-amber-800">
              {affected.length} existing appointment(s) fall inside this blocked period. Resolve them explicitly:
            </p>
            {affected.map((appointment) => (
              <Link
                key={appointment.id}
                href={`/doctor/appointments/${appointment.id}`}
                className="block text-[10px] font-bold text-amber-800 underline"
              >
                {appointment.patient?.displayName ?? "Patient"} ·{" "}
                {new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(appointment.startsAt))}{" "}
                · {appointment.status.replace(/_/g, " ")}
              </Link>
            ))}
          </div>
        )}

        {offError && <ErrorBanner message={offError} />}

        <div className="grid gap-2 rounded-xl border border-[#EFE8FA] bg-[#FCFAFF] p-2.5 sm:grid-cols-2">
          <ObirenDatePicker
            label="From"
            mode="datetime"
            value={offStart}
            onChange={setOffStart}
            min={toLocalInput(new Date())}
            max={offEnd || undefined}
            ariaLabel="Blocked time start"
            placeholder="Start date and time"
          />
          <ObirenDatePicker
            label="To"
            mode="datetime"
            value={offEnd}
            onChange={setOffEnd}
            min={offStart || toLocalInput(new Date())}
            ariaLabel="Blocked time end"
            placeholder="End date and time"
            align="right"
          />
          <label className="text-[11px] font-bold space-y-1 block sm:col-span-2">
            Reason (optional, not shown to patients)
            <input
              value={offReason}
              onChange={(event) => setOffReason(event.target.value)}
              maxLength={300}
              className="w-full px-2.5 py-2 rounded-xl border border-[#E7E2EB] text-xs font-normal"
              placeholder="Annual leave, conference…"
            />
          </label>
        </div>
        <button
          onClick={addTimeOff}
          disabled={offBusy}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#17131D] text-white text-xs font-bold disabled:opacity-60"
        >
          {offBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarOff className="w-3.5 h-3.5" />} Block this time
        </button>

        <div className="border-t border-[#F0EDF3] pt-2">
          {schedule.timeOff.length === 0 ? (
            <EmptyState title="No blocked periods" hint="Leave and one-off unavailability will be listed here." icon={<CalendarOff className="w-8 h-8" />} />
          ) : (
            <ul className="divide-y divide-[#F0EDF3]">
              {schedule.timeOff.map((block) => (
                <li key={block.id} className="py-2 flex items-center gap-2">
                  <div className="flex-1 text-[11px]">
                    <p className="font-bold">
                      {new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(block.startsAt))}
                      {" – "}
                      {new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(block.endsAt))}
                    </p>
                    {block.reason && <p className="text-[10px] text-[#6E6875]">{block.reason}</p>}
                  </div>
                  <button onClick={() => removeTimeOff(block.id)} className="p-1.5 text-red-600" aria-label="Remove blocked period">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
