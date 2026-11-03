"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  Phone,
  ShieldAlert,
  UserX,
  Video,
  XCircle,
} from "lucide-react";
import { doctorApi, specialistsApi, SpecialistSlotData, DoctorAppointment, DoctorProfileData } from "@obiren/api-client";
import { Card, ErrorBanner, Loading, StatusPill, SuccessBanner, formatDate, formatDateTime, formatTime } from "@/components/ui";

type ActionState = null | "reject" | "cancel" | "reschedule" | "no-show";

export default function AppointmentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = String(params?.id || "");
  const [appointment, setAppointment] = useState<DoctorAppointment | null>(null);
  const [profile, setProfile] = useState<DoctorProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [panel, setPanel] = useState<ActionState>(null);
  const [reason, setReason] = useState("");
  const [slots, setSlots] = useState<SpecialistSlotData[] | null>(null);
  const [slotError, setSlotError] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [meetingBusy, setMeetingBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [detail, me] = await Promise.all([doctorApi.getAppointment(id), doctorApi.me()]);
      setAppointment(detail);
      setProfile(me);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this appointment.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (label: string, action: () => Promise<unknown>, message: string) => {
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(message);
      setPanel(null);
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The action could not be completed.");
    } finally {
      setBusy("");
    }
  };

  /**
   * Save or clear the doctor's own room link. The API rejects non-provider or
   * non-https links, so the message it returns is shown verbatim.
   */
  const saveMeetingLink = async (value: string | null) => {
    setMeetingBusy(value === null ? "remove" : "save");
    setError("");
    setNotice("");
    try {
      const updated = await doctorApi.setMeetingLink(id, value);
      setAppointment(updated);
      setMeetingUrl(updated.meetingUrl ?? "");
      setNotice(value === null ? "Consultation link removed." : "Consultation link saved. The patient can see it now.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The consultation link could not be saved.");
    } finally {
      setMeetingBusy("");
    }
  };

  const loadSlots = async () => {
    if (!profile) return;
    setSlotError("");
    setSlots(null);
    try {
      const from = new Date().toISOString();
      const to = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();
      const response = await specialistsApi.slots(profile.id, { from, to });
      setSlots(response.slots.filter((slot) => slot.available));
    } catch (err) {
      setSlotError(err instanceof Error ? err.message : "Could not load available slots.");
    }
  };

  useEffect(() => {
    if (panel === "reschedule" && slots === null && !slotError) loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel]);

  if (loading) return <Loading label="Loading appointment…" />;
  if (error && !appointment) {
    return (
      <div className="space-y-3">
        <ErrorBanner message={error} />
        <div className="flex gap-3">
          <button onClick={load} className="text-xs font-bold text-[#6C4CF1]">Try again</button>
          <Link href="/doctor/appointments" className="text-xs font-bold text-[#6E6875]">Back to appointments</Link>
        </div>
      </div>
    );
  }
  if (!appointment) return null;

  const timeZone = appointment.timeZone || profile?.timeZone || undefined;
  const canAct = appointment.actions;
  const isClosed = ["completed", "cancelled", "rejected", "no_show", "expired"].includes(appointment.status);

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-[#F5F2FF]" aria-label="Back">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold truncate">{appointment.patient?.displayName ?? "Patient"}</h1>
          <p className="text-[10px] text-[#6E6875] font-mono">{appointment.reference}</p>
        </div>
        <div className="ml-auto">
          <StatusPill status={appointment.status} label={appointment.statusLabel} />
        </div>
      </div>

      {notice && <SuccessBanner message={notice} />}
      {error && <ErrorBanner message={error} />}

      <Card className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#F5F2FF] text-[#6C4CF1] flex items-center justify-center">
            <CalendarClock className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold">{formatDate(appointment.startsAt, timeZone)}</p>
            <p className="text-[11px] text-[#6E6875]">
              {formatTime(appointment.startsAt, timeZone)} – {formatTime(appointment.endsAt, timeZone)} · {timeZone}
            </p>
            <p className="text-[11px] text-[#6E6875] capitalize mt-0.5">
              {appointment.sessionType} consultation · {appointment.durationMinutes} minutes
            </p>
          </div>
        </div>

        <dl className="grid sm:grid-cols-2 gap-3 text-[11px]">
          <div className="bg-[#F9F7FC] rounded-xl p-3">
            <dt className="text-[9px] uppercase font-bold text-[#9B94A3]">Patient</dt>
            <dd className="font-bold">{appointment.patient?.displayName ?? "—"}</dd>
            {appointment.patient?.phoneNumber && (
              <dd className="text-[#6E6875] flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3" /> {appointment.patient.phoneNumber}
              </dd>
            )}
          </div>
          <div className="bg-[#F9F7FC] rounded-xl p-3">
            <dt className="text-[9px] uppercase font-bold text-[#9B94A3]">Payment</dt>
            <dd className="font-bold capitalize">
              {appointment.paymentStatus ? appointment.paymentStatus.replace(/_/g, " ") : "Not required"}
            </dd>
            <dd className="text-[#6E6875]">
              {appointment.amountMinor > 0
                ? `${(appointment.amountMinor / 100).toLocaleString("en-NG", { style: "currency", currency: appointment.currency })}`
                : "No charge recorded"}
              {appointment.refundStatus && appointment.refundStatus !== "none" && ` · refund ${appointment.refundStatus.replace(/_/g, " ")}`}
            </dd>
          </div>
          <div className="bg-[#F9F7FC] rounded-xl p-3 sm:col-span-2">
            <dt className="text-[9px] uppercase font-bold text-[#9B94A3]">Booked</dt>
            <dd className="font-bold">{appointment.createdAt ? formatDateTime(appointment.createdAt, timeZone) : "—"}</dd>
            {appointment.patientNote && (
              <>
                <dt className="text-[9px] uppercase font-bold text-[#9B94A3] mt-2">Patient note</dt>
                <dd className="text-[#17131D] whitespace-pre-wrap">{appointment.patientNote}</dd>
              </>
            )}
          </div>
          {(appointment.cancellationReason || appointment.rejectionReason) && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 sm:col-span-2">
              <dt className="text-[9px] uppercase font-bold text-red-500">
                {appointment.rejectionReason ? "Rejection reason" : "Cancellation reason"}
              </dt>
              <dd className="text-red-800">{appointment.rejectionReason || appointment.cancellationReason}</dd>
            </div>
          )}
        </dl>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#F5F2FF] text-[#6C4CF1] flex items-center justify-center shrink-0">
            <Video className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold">Consultation link</p>
            <p className="text-[10px] text-[#6E6875]">
              Create the room in Google Meet, Zoom or Microsoft Teams and paste the link here. The patient sees this exact
              link on their appointment and joins there — Obiren stores the link but does not host or join the call.
            </p>
          </div>
        </div>

        {appointment.meetingUrl ? (
          <div className="rounded-xl bg-[#F9F7FC] p-3 space-y-1.5">
            <p className="text-[9px] uppercase font-bold text-[#9B94A3]">Link shared with the patient</p>
            <a
              href={appointment.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#6C4CF1] break-all"
            >
              <Link2 className="w-3 h-3 shrink-0" />
              <span className="truncate">{appointment.meetingUrl}</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
            {appointment.meetingUrlUpdatedAt && (
              <p className="text-[10px] text-[#6E6875]">
                Updated {formatDateTime(appointment.meetingUrlUpdatedAt, timeZone)}
              </p>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-[#6E6875] rounded-xl bg-amber-50 border border-amber-200 text-amber-800 p-3">
            No link yet. The patient sees “Your doctor will share the link” until you add one.
          </p>
        )}

        {appointment.meetingLinkEditable ? (
          <div className="space-y-2">
            <label htmlFor="meeting-url" className="block text-[11px] font-bold">
              Meeting URL
            </label>
            <input
              id="meeting-url"
              type="url"
              inputMode="url"
              maxLength={500}
              value={meetingUrl}
              onChange={(event) => setMeetingUrl(event.target.value)}
              placeholder="https://meet.google.com/abc-defg-hij"
              className="w-full px-3 py-2 rounded-xl border border-[#E7E2EB] text-xs focus:outline-none focus:ring-2 focus:ring-[#6C4CF1]/30"
            />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => saveMeetingLink(meetingUrl.trim())}
                disabled={!!meetingBusy || meetingUrl.trim().length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#6C4CF1] text-white text-[11px] font-bold disabled:opacity-50"
              >
                {meetingBusy === "save" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {appointment.meetingUrl ? "Update link" : "Save link"}
              </button>
              {appointment.meetingUrl && (
                <button
                  onClick={() => saveMeetingLink(null)}
                  disabled={!!meetingBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 text-red-700 border border-red-200 text-[11px] font-bold disabled:opacity-50"
                >
                  {meetingBusy === "remove" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                  Remove
                </button>
              )}
            </div>
            <p className="text-[10px] text-[#6E6875]">
              https links on meet.google.com, zoom.us, teams.microsoft.com or teams.live.com only. The patient is notified when a
              link is added or removed.
            </p>
          </div>
        ) : (
          <p className="text-[10px] text-[#6E6875]">
            This appointment is {appointment.status.replace(/_/g, " ")} and no longer accepts a consultation link.
          </p>
        )}
      </Card>

      {!isClosed && (
        <Card className="p-5 space-y-3">
          <p className="text-xs font-bold">Manage appointment</p>
          <p className="text-[10px] text-[#6E6875]">
            Only actions valid for the current status are enabled. Every change is recorded with your role and timestamp and
            is visible to the patient in the Obiren app.
          </p>
          <div className="flex flex-wrap gap-2">
            {canAct.confirm && (
              <button
                onClick={() => run("confirm", () => doctorApi.confirm(appointment.id), "Appointment confirmed. The patient has been notified.")}
                disabled={!!busy}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-[11px] font-bold disabled:opacity-60"
              >
                {busy === "confirm" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Confirm
              </button>
            )}
            {canAct.reschedule && (
              <button
                onClick={() => setPanel(panel === "reschedule" ? null : "reschedule")}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#6C4CF1] text-white text-[11px] font-bold"
              >
                <CalendarClock className="w-3.5 h-3.5" /> Reschedule
              </button>
            )}
            {canAct.complete && (
              <button
                onClick={() => run("complete", () => doctorApi.complete(appointment.id), "Marked completed.")}
                disabled={!!busy}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#17131D] text-white text-[11px] font-bold disabled:opacity-60"
              >
                {busy === "complete" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Mark completed
              </button>
            )}
            {canAct.noShow && (
              <button
                onClick={() => setPanel(panel === "no-show" ? null : "no-show")}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-50 text-orange-700 border border-orange-200 text-[11px] font-bold"
              >
                <UserX className="w-3.5 h-3.5" /> No-show
              </button>
            )}
            {canAct.reject && (
              <button
                onClick={() => setPanel(panel === "reject" ? null : "reject")}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 text-red-700 border border-red-200 text-[11px] font-bold"
              >
                <XCircle className="w-3.5 h-3.5" /> Reject
              </button>
            )}
            {canAct.cancel && (
              <button
                onClick={() => setPanel(panel === "cancel" ? null : "cancel")}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 text-red-700 border border-red-200 text-[11px] font-bold"
              >
                <ShieldAlert className="w-3.5 h-3.5" /> Cancel
              </button>
            )}
          </div>

          {(panel === "reject" || panel === "cancel" || panel === "no-show") && (
            <div className="border-t border-[#F0EDF3] pt-3 space-y-2">
              <label htmlFor="reason" className="block text-[11px] font-bold">
                {panel === "reject" ? "Reason for rejecting" : panel === "cancel" ? "Reason for cancelling" : "No-show note (optional)"}
              </label>
              <textarea
                id="reason"
                rows={3}
                maxLength={300}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E7E2EB] text-xs focus:outline-none focus:ring-2 focus:ring-[#6C4CF1]/30"
                placeholder="This reason is shared with the patient."
              />
              <p className="text-[10px] text-[#6E6875]">
                {panel === "reject"
                  ? "Rejecting frees the slot and notifies the patient. A paid booking becomes refund-pending; no automatic refund is issued."
                  : panel === "cancel"
                    ? "Cancelling notifies the patient and applies the platform's existing refund policy."
                    : "Recorded on the appointment only; payment state is not changed."}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (panel === "reject") run("reject", () => doctorApi.reject(appointment.id, reason.trim()), "Appointment rejected.");
                    if (panel === "cancel") run("cancel", () => doctorApi.cancel(appointment.id, reason.trim()), "Appointment cancelled.");
                    if (panel === "no-show") run("no-show", () => doctorApi.noShow(appointment.id, reason.trim() || undefined), "No-show recorded.");
                  }}
                  disabled={!!busy || (panel !== "no-show" && reason.trim().length < 3)}
                  className="px-3 py-2 rounded-xl bg-[#17131D] text-white text-[11px] font-bold disabled:opacity-50"
                >
                  {busy === panel ? "Saving…" : "Confirm action"}
                </button>
                <button onClick={() => setPanel(null)} className="px-3 py-2 rounded-xl border border-[#E7E2EB] text-[11px] font-bold">
                  Discard
                </button>
              </div>
            </div>
          )}

          {panel === "reschedule" && (
            <div className="border-t border-[#F0EDF3] pt-3 space-y-2">
              <p className="text-[11px] font-bold">Choose a new open slot (next 21 days)</p>
              {slotError && <ErrorBanner message={slotError} />}
              {slots === null && !slotError ? (
                <p className="text-[11px] text-[#6E6875] flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading your bookable slots…
                </p>
              ) : slots && slots.length === 0 ? (
                <p className="text-[11px] text-[#6E6875]">
                  No open slots. Configure your weekly availability, then try again.
                </p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
                  {slots?.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => run("reschedule", () => doctorApi.reschedule(appointment.id, slot.id, reason.trim() || undefined), "Appointment rescheduled and the patient notified.")}
                      disabled={!!busy}
                      className="text-left px-2.5 py-2 rounded-lg border border-[#E7E2EB] text-[10px] font-bold hover:border-[#6C4CF1] disabled:opacity-50"
                    >
                      {formatDateTime(slot.startsAt, timeZone)} <span className="text-[#6E6875] capitalize">· {slot.sessionType}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      <Card className="p-5 space-y-2">
        <p className="text-xs font-bold">Status history</p>
        <ol className="space-y-2">
          {appointment.statusHistory.length === 0 && <li className="text-[11px] text-[#6E6875]">No status changes recorded yet.</li>}
          {appointment.statusHistory.map((entry, index) => (
            <li key={index} className="flex items-start gap-2 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6C4CF1] mt-1.5" />
              <div>
                <p className="font-bold capitalize">
                  {entry.to.replace(/_/g, " ")}
                  <span className="font-normal text-[#6E6875]"> · {entry.actorRole}</span>
                </p>
                <p className="text-[10px] text-[#6E6875]">{formatDateTime(entry.at, timeZone)}</p>
                {entry.reason && <p className="text-[10px] text-[#6E6875] italic">“{entry.reason}”</p>}
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Link href="/doctor/appointments" className="inline-block text-xs font-bold text-[#6C4CF1]">
        ← Back to all appointments
      </Link>
    </div>
  );
}
