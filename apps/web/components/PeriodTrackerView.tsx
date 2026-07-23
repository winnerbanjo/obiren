"use client";

import { useState } from "react";
import {
  Calendar as CalendarIcon,
  Plus,
  Info,
  CheckCircle2,
  AlertTriangle,
  Download,
  Clock,
  ChevronLeft,
  ChevronRight,
  Heart,
  Droplets,
  Activity,
  FileText,
  Sun,
} from "lucide-react";
import { calculateCyclePrediction } from "@obiren/health-engine";

interface PeriodTrackerViewProps {
  userProfile: any;
  onOpenDailyLog: () => void;
}

export default function PeriodTrackerView({
  userProfile,
  onOpenDailyLog,
}: PeriodTrackerViewProps) {
  const [viewMode, setViewMode] = useState<"calendar" | "timeline" | "history">("calendar");

  const prediction = calculateCyclePrediction({
    userId: userProfile?.email || "user_1",
    confirmedCycles: [
      { periodStartDate: "2026-07-01", periodEndDate: "2026-07-06", cycleLengthDays: 28 },
      { periodStartDate: "2026-06-03", periodEndDate: "2026-06-08", cycleLengthDays: 28 },
      { periodStartDate: "2026-05-06", periodEndDate: "2026-05-11", cycleLengthDays: 28 },
    ],
    statedAverageCycleLength: userProfile?.cycleLengthDays || 28,
  });

  const exportCycleData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(prediction, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `obiren_cycle_history_${new Date().toISOString().split("T")[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-[#E7E2EB] shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-[#17131D]">Period & Cycle Tracker</h2>
          <p className="text-xs text-[#6E6875]">Complete reproductive health tracking & algorithmic forecasts.</p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            onClick={exportCycleData}
            className="px-3.5 py-2.5 bg-white border border-[#E7E2EB] hover:bg-[#F5F2FF] text-[#17131D] text-xs font-bold rounded-full transition-colors flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 text-[#6C4CF1]" />
            <span>Export</span>
          </button>
          <button
            onClick={onOpenDailyLog}
            className="px-4 py-2.5 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white text-xs font-bold rounded-full shadow-md shadow-[#6C4CF1]/20 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Log Today</span>
          </button>
        </div>
      </div>

      {/* Cycle Prediction Metrics Card */}
      <div className="bg-gradient-to-br from-[#21182F] via-[#2F2148] to-[#21182F] text-white p-6 sm:p-8 rounded-3xl shadow-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#E8E0FF] bg-white/10 px-3 py-1 rounded-full border border-white/10">
            Current Cycle Day 14
          </span>
          <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/30">
            Confidence: {prediction.confidence} ({prediction.explanationCode})
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-4 bg-white/10 rounded-2xl border border-white/10 space-y-1">
            <p className="text-[10px] sm:text-[11px] text-white/70 uppercase font-bold">Estimated Next Period</p>
            <p className="text-lg sm:text-xl font-extrabold">{prediction.predictedStartDate}</p>
            <p className="text-[10px] text-white/60">Range: {prediction.rangeStart} – {prediction.rangeEnd}</p>
          </div>

          <div className="p-4 bg-white/10 rounded-2xl border border-white/10 space-y-1">
            <p className="text-[10px] sm:text-[11px] text-white/70 uppercase font-bold">Estimated Fertile Window</p>
            <p className="text-lg sm:text-xl font-extrabold">{prediction.estimatedFertileWindowStart || "N/A"}</p>
            <p className="text-[10px] text-emerald-400 font-medium">To {prediction.estimatedFertileWindowEnd}</p>
          </div>

          <div className="p-4 bg-white/10 rounded-2xl border border-white/10 space-y-1">
            <p className="text-[10px] sm:text-[11px] text-white/70 uppercase font-bold">Estimated Ovulation</p>
            <p className="text-lg sm:text-xl font-extrabold">{prediction.estimatedOvulationDate || "N/A"}</p>
            <p className="text-[10px] text-white/60">Version: {prediction.calculationVersion}</p>
          </div>
        </div>

        {/* Disclaimer Notice */}
        <div className="p-3.5 bg-white/10 rounded-2xl border border-white/10 text-xs text-white/80 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-[#E8E0FF] shrink-0 mt-0.5" />
          <span>
            Fertility estimates are non-diagnostic statistical ranges based on past cycle length variations and must not be used as the sole method of contraception.
          </span>
        </div>
      </div>

      {/* Calendar Legend & View Switcher */}
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E7E2EB] pb-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-[#6C4CF1]" />
            <h3 className="text-lg font-bold font-display text-[#17131D]">July 2026</h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("calendar")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                viewMode === "calendar" ? "bg-[#6C4CF1] text-white" : "bg-[#F5F2FF] text-[#6E6875]"
              }`}
            >
              Calendar View
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                viewMode === "timeline" ? "bg-[#6C4CF1] text-white" : "bg-[#F5F2FF] text-[#6E6875]"
              }`}
            >
              Timeline View
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-[11px] sm:text-xs font-semibold text-[#6E6875]">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Confirmed Period</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-200 border border-rose-300" /> Predicted Period</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#6C4CF1]" /> Fertile Window</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Estimated Ovulation</span>
        </div>

        {/* Calendar Grid Container with Mobile Overflow Protection */}
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[320px] grid grid-cols-7 gap-1.5 text-center">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="text-[11px] font-bold text-[#6E6875] py-1">
                {day}
              </div>
            ))}

            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
              const isConfirmedBleed = day >= 1 && day <= 5;
              const isOvulation = day === 14;
              const isFertile = day >= 10 && day <= 15;
              const isPredictedNext = day >= 28 && day <= 31;

              return (
                <div
                  key={day}
                  onClick={onOpenDailyLog}
                  className={`h-11 sm:h-14 rounded-xl p-1 border transition-all cursor-pointer flex flex-col justify-between items-center text-[10px] sm:text-xs font-bold ${
                    isConfirmedBleed
                      ? "bg-rose-500 text-white border-rose-600 shadow-sm"
                      : isOvulation
                      ? "bg-emerald-500 text-white border-emerald-600 shadow-md"
                      : isFertile
                      ? "bg-[#F5F2FF] text-[#6C4CF1] border-[#E8E0FF]"
                      : isPredictedNext
                      ? "bg-rose-50 text-rose-600 border-rose-200 border-dashed"
                      : "bg-white text-[#17131D] border-[#E7E2EB] hover:bg-[#F5F2FF]"
                  }`}
                >
                  <span>{day}</span>
                  {isConfirmedBleed && <Droplets className="w-3 h-3 fill-white/80" />}
                  {isOvulation && <Sun className="w-3 h-3" />}
                  {isFertile && !isOvulation && <span className="w-1.5 h-1.5 rounded-full bg-[#6C4CF1]" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
