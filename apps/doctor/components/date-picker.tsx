"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
} from "lucide-react";
import {
  WEEKDAY_LABELS,
  dateKey,
  longDateLabel,
  monthLabel,
  monthMatrix,
  parseDateKey,
} from "./calendar-utils";

type PickerMode = "date" | "datetime";

interface ObirenDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  mode?: PickerMode;
  label?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  ariaLabel?: string;
  className?: string;
  align?: "left" | "right";
}

function timeOf(value: string): string {
  return value.includes("T") ? value.slice(11, 16) : "09:00";
}

function displayValue(value: string, mode: PickerMode): string {
  const date = parseDateKey(value);
  if (!date) return "";
  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
  return mode === "datetime" && value.includes("T") ? `${formatted} · ${value.slice(11, 16)}` : formatted;
}

/**
 * Obiren-branded date / date-time chooser.
 *
 * Native date inputs render differently in every browser; this keeps the
 * Doctor Portal visually consistent and gives doctors a clear Today shortcut,
 * month navigation and a readable selected state. Values stay local wall-clock
 * strings (YYYY-MM-DD or YYYY-MM-DDTHH:mm) so they never drift across timezones.
 */
export default function ObirenDatePicker({
  value,
  onChange,
  mode = "date",
  label,
  placeholder = "Select a date",
  min,
  max,
  ariaLabel,
  className = "",
  align = "left",
}: ObirenDatePickerProps) {
  const selected = parseDateKey(value);
  const initial = selected ?? new Date();
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const rootRef = useRef<HTMLDivElement>(null);

  const minKey = min ? min.slice(0, 10) : null;
  const maxKey = max ? max.slice(0, 10) : null;
  const todayKey = dateKey(new Date());
  const selectedKey = selected ? dateKey(selected) : "";
  const cells = useMemo(() => monthMatrix(viewYear, viewMonth), [viewYear, viewMonth]);
  const time = timeOf(value);

  useEffect(() => {
    if (!open) return;
    const anchor = parseDateKey(value) ?? new Date();
    setViewYear(anchor.getFullYear());
    setViewMonth(anchor.getMonth());
    // Keep the whole panel on screen when the field sits near the bottom of
    // the page (for example the time-off form).
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) {
      const needed = mode === "datetime" ? 430 : 380;
      setOpenUp(window.innerHeight - rect.bottom < needed && rect.top > needed);
    }
  }, [open, value, mode]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const disabled = (date: Date) => {
    const key = dateKey(date);
    return Boolean((minKey && key < minKey) || (maxKey && key > maxKey));
  };

  const emit = (date: Date, nextTime = time) => {
    if (mode === "date") {
      onChange(dateKey(date));
      setOpen(false);
      return;
    }
    onChange(`${dateKey(date)}T${nextTime}`);
  };

  const pickToday = () => {
    emit(new Date());
  };

  const moveMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const prettyValue = displayValue(value, mode);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label && <span className="block text-[11px] font-bold text-[#17131D] mb-1.5">{label}</span>}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel || label || placeholder}
        className={`group w-full flex items-center gap-2 rounded-xl border bg-white px-2.5 py-2 text-left transition-all ${
          open
            ? "border-[#6C4CF1] ring-2 ring-[#6C4CF1]/15 shadow-[0_6px_20px_-12px_rgba(108,76,241,0.7)]"
            : "border-[#E7E2EB] hover:border-[#CFC2F5] hover:shadow-[0_4px_14px_-10px_rgba(108,76,241,0.6)]"
        }`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#F4EFFF] to-[#E7DCFF] text-[#6C4CF1]">
          <CalendarDays className="h-3.5 w-3.5" />
        </span>
        <span
          className={`min-w-0 flex-1 truncate text-xs ${
            prettyValue ? "font-semibold text-[#17131D]" : "text-[#9B94A3]"
          }`}
        >
          {prettyValue || placeholder}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-[#9B94A3] transition-transform ${open ? "rotate-180 text-[#6C4CF1]" : ""}`}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={ariaLabel || label || "Choose a date"}
          className={`absolute z-50 w-[19.5rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[#E5DAFF] bg-white shadow-[0_24px_70px_-24px_rgba(58,32,130,0.55)] ${
            align === "right" ? "right-0" : "left-0"
          } ${openUp ? "bottom-[calc(100%+0.5rem)]" : "top-[calc(100%+0.5rem)]"}`}
        >
          <div className="relative overflow-hidden bg-gradient-to-br from-[#2C1A64] via-[#5030B8] to-[#8261FF] px-4 py-3 text-white">
            <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/60">
              {mode === "datetime" ? "Obiren schedule" : "Obiren date"}
            </p>
            <p className="mt-0.5 truncate text-sm font-bold">
              {selected ? longDateLabel(selected) : "Choose a day"}
            </p>
          </div>

          <div className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                className="rounded-lg p-1.5 text-[#6E6875] transition-colors hover:bg-[#F4EFFF] hover:text-[#6C4CF1]"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="text-xs font-bold text-[#17131D]">{monthLabel(viewYear, viewMonth)}</p>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                className="rounded-lg p-1.5 text-[#6E6875] transition-colors hover:bg-[#F4EFFF] hover:text-[#6C4CF1]"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7">
              {WEEKDAY_LABELS.map((day) => (
                <p
                  key={day}
                  className="py-1 text-center text-[9px] font-bold uppercase tracking-wide text-[#A79CB8]"
                >
                  {day.slice(0, 2)}
                </p>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {cells.map((date, index) => {
                if (!date) return <span key={`empty-${index}`} className="h-8" />;
                const key = dateKey(date);
                const isSelected = key === selectedKey;
                const isToday = key === todayKey;
                const isDisabled = disabled(date);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => emit(date)}
                    aria-label={longDateLabel(date)}
                    aria-pressed={isSelected}
                    className={`relative flex h-8 items-center justify-center rounded-xl text-[11px] font-bold transition-all ${
                      isSelected
                        ? "bg-gradient-to-br from-[#6C4CF1] to-[#9B6BFF] text-white shadow-[0_6px_14px_-7px_rgba(108,76,241,0.9)]"
                        : isDisabled
                          ? "cursor-not-allowed text-[#D6CFDF]"
                          : isToday
                            ? "bg-[#F2ECFF] text-[#5A38D6] ring-1 ring-[#D9CBFF] hover:bg-[#E9E0FF]"
                            : "text-[#3B3346] hover:bg-[#F7F3FF] hover:text-[#5A38D6]"
                    }`}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          {mode === "datetime" && (
            <div className="flex items-center gap-2 border-t border-[#F0EBF8] bg-[#FCFAFF] px-3 py-2.5">
              <Clock3 className="h-3.5 w-3.5 text-[#6C4CF1]" />
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#6E6875]">Time</span>
              <input
                type="time"
                value={time}
                onChange={(event) => {
                  const date = parseDateKey(value) ?? new Date();
                  emit(date, event.target.value || "09:00");
                }}
                className="ml-auto rounded-lg border border-[#E5DAFF] bg-white px-2 py-1 text-[11px] font-semibold text-[#17131D] focus:border-[#6C4CF1] focus:outline-none focus:ring-2 focus:ring-[#6C4CF1]/20"
                aria-label="Time"
              />
            </div>
          )}

          <div className="flex items-center justify-between border-t border-[#F0EBF8] px-3 py-2">
            <button
              type="button"
              onClick={pickToday}
              className="rounded-lg px-2 py-1 text-[10px] font-bold text-[#6C4CF1] transition-colors hover:bg-[#F4EFFF]"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 rounded-lg bg-[#17131D] px-2.5 py-1.5 text-[10px] font-bold text-white transition-colors hover:bg-[#322A3D]"
            >
              <Check className="h-3 w-3" /> Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
