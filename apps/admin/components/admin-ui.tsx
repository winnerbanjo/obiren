"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

/**
 * Shared presentation primitives for the Admin control centre. Every screen in
 * this app renders real API data, so these helpers only handle states and
 * formatting - never placeholder business values.
 */

const GREEN = new Set([
  "active",
  "verified",
  "confirmed",
  "completed",
  "succeeded",
  "sent",
  "current",
  "approved",
  "published",
  "resolved",
  "source_verified",
  "directory_source_verified",
  "operationally_confirmed",
]);
const AMBER = new Set([
  "pending",
  "invited",
  "awaiting_payment",
  "initialized",
  "queued",
  "due_soon",
  "held",
  "in_progress",
  "unverified",
  "draft",
  "partial",
]);
const RED = new Set([
  "suspended",
  "suspended_by_admin",
  "rejected",
  "failed",
  "cancelled",
  "overdue",
  "expired",
  "no_show",
  "triggered",
  "restricted",
  "abandoned",
]);
const BLUE = new Set(["reschedule_requested", "notice", "info"]);

export function statusTone(status: string): string {
  const key = (status || "").toLowerCase();
  if (GREEN.has(key)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (AMBER.has(key)) return "bg-amber-50 text-amber-700 border-amber-200";
  if (RED.has(key)) return "bg-red-50 text-red-700 border-red-200";
  if (BLUE.has(key)) return "bg-sky-50 text-sky-700 border-sky-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

export function StatusPill({ status, label }: { status: string; label?: string }) {
  const text = label ?? (status ? status.replace(/_/g, " ") : "unknown");
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${statusTone(status)}`}
    >
      {text}
    </span>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-2xl flex items-center gap-2.5">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function NoticeBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-2xl flex items-center gap-2.5">
      <CheckCircle2 className="w-4 h-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function InfoBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="p-4 bg-[#F5F2FF] border border-[#E8E0FF] text-[#4B3B85] text-xs font-semibold rounded-2xl flex items-start gap-2.5">
      <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#6C4CF1]" />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="py-12 text-center space-y-2">
      {icon ? <div className="flex justify-center text-[#918A98]">{icon}</div> : null}
      <p className="text-sm font-bold text-[#17131D]">{title}</p>
      {description ? <p className="text-xs text-[#6E6875] max-w-md mx-auto">{description}</p> : null}
    </div>
  );
}

export function TableSkeleton({ label }: { label: string }) {
  return <div className="py-10 text-center text-sm text-[#6E6875]">{label}</div>;
}

/** Minor units (kobo/pesewa/pence) as a localised currency string. */
export function formatMoneyMinor(amountMinor: number, currency: string): string {
  const code = (currency || "NGN").toUpperCase();
  const amount = Number(amountMinor || 0) / 100;
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: code, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${code} ${amount.toLocaleString()}`;
  }
}

export function formatDateTime(value?: string | null, timeZone?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timeZone || undefined,
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

/** Offset of an IANA timezone at a given instant, in milliseconds. */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return asUtc - date.getTime();
}

/**
 * UTC bounds of one calendar day in an IANA timezone. Operational date filters
 * (today, date ranges) use the market timezone, not the viewer's browser.
 */
export function zonedDayBounds(dateKey: string, timeZone = "Africa/Lagos"): { from: string; to: string } {
  const naive = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(naive.getTime())) return { from: "", to: "" };
  const start = new Date(naive.getTime() - timeZoneOffsetMs(naive, timeZone));
  const next = new Date(naive.getTime() + 24 * 60 * 60 * 1000);
  const end = new Date(next.getTime() - timeZoneOffsetMs(next, timeZone) - 1000);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function errorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { status?: number; message?: string };
  if (anyErr?.status === 403) return "Your admin role does not grant access to this module.";
  if (anyErr?.message) return anyErr.message;
  return fallback;
}
