"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Calendar as CalendarIcon,
  Plus,
  Info,
  AlertTriangle,
  Download,
  Play,
  Square,
  RefreshCw,
} from "lucide-react";
import {
  cyclesApi,
  ApiError,
  CycleData,
} from "@obiren/api-client";

interface PeriodTrackerViewProps {
  userProfile: any;
  onOpenDailyLog: () => void;
}

export default function PeriodTrackerView({
  userProfile,
  onOpenDailyLog,
}: PeriodTrackerViewProps) {
  const [viewMode, setViewMode] = useState<"calendar" | "timeline">("calendar");
  const [current, setCurrent] = useState<CycleData | null>(null);
  const [history, setHistory] = useState<CycleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const [cur, hist] = await Promise.all([
        cyclesApi.getCurrent(),
        cyclesApi.getHistory(),
      ]);
      setCurrent(cur ?? null);
      setHistory(hist ?? []);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(`Could not load your cycle data: ${err.message}`);
      } else {
        setErrorMsg("Could not load your cycle data. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startPeriod = async () => {
    setActing(true);
    setErrorMsg("");
    setNotice("");
    try {
      const result = await cyclesApi.startPeriod();
      setNotice(`Period logged. Next period predicted for ${result?.prediction?.predictedStartDate ?? "calculating..."}`);
      await load();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Could not log your period. Please try again.");
    } finally {
      setActing(false);
    }
  };

  const endPeriod = async () => {
    setActing(true);
    setErrorMsg("");
    setNotice("");
    try {
      await cyclesApi.endPeriod();
      setNotice("Period end recorded.");
      await load();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Could not record period end. Please try again.");
    } finally {
      setActing(false);
    }
  };

  const exportCycleData = async () => {
    try {
      const [cur, hist] = await Promise.all([cyclesApi.getCurrent(), cyclesApi.getHistory()]);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ current: cur, history: hist }, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `obiren_cycle_history_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch {
      setErrorMsg("Export failed. Please try again.");
    }
  };

  const prediction = current?.prediction;
  const dayOfCycle = current?.dayOfCycle;
  const hasActiveCycle = Boolean(current?.id && current?.status === "active");

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

      {/* Errors / notices */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-2xl flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {notice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-2xl flex items-center gap-2.5">
          <Info className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Cycle Prediction Metrics Card */}
      <div className="bg-gradient-to-br from-[#21182F] via-[#2F2148] to-[#21182F] text-white p-6 sm:p-8 rounded-3xl shadow-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#E8E0FF] bg-white/10 px-3 py-1 rounded-full border border-white/10">
            {loading
              ? "Loading cycle..."
              : hasActiveCycle
                ? `Current Cycle Day ${dayOfCycle}`
                : "No Active Cycle"}
          </span>
          {prediction && (
            <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/30">
              Confidence: {prediction.confidence} ({prediction.explanationCode})
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-8 text-center text-white/60 text-sm">Loading your cycle data...</div>
        ) : !hasActiveCycle ? (
          <div className="py-6 space-y-4 text-center">
            <p className="text-sm text-white/80">
              Track your first period to unlock personalized predictions, fertile window estimates, and daily insights.
            </p>
            <button
              onClick={startPeriod}
              disabled={acting}
              className="px-6 py-3 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white text-xs font-bold rounded-full shadow-lg transition-all inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              <span>Log Period Start Today</span>
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-white/10 rounded-2xl border border-white/10 space-y-1">
                <p className="text-[10px] sm:text-[11px] text-white/70 uppercase font-bold">Estimated Next Period</p>
                <p className="text-lg sm:text-xl font-extrabold">{prediction?.predictedStartDate ?? "—"}</p>
                <p className="text-[10px] text-white/60">Range: {prediction?.rangeStart ?? "—"} – {prediction?.rangeEnd ?? "—"}</p>
              </div>

              <div className="p-4 bg-white/10 rounded-2xl border border-white/10 space-y-1">
                <p className="text-[10px] sm:text-[11px] text-white/70 uppercase font-bold">Estimated Fertile Window</p>
                <p className="text-lg sm:text-xl font-extrabold">{prediction?.estimatedFertileWindowStart ?? "N/A"}</p>
                <p className="text-[10px] text-emerald-400 font-medium">To {prediction?.estimatedFertileWindowEnd ?? "N/A"}</p>
              </div>

              <div className="p-4 bg-white/10 rounded-2xl border border-white/10 space-y-1">
                <p className="text-[10px] sm:text-[11px] text-white/70 uppercase font-bold">Period Started</p>
                <p className="text-lg sm:text-xl font-extrabold">{current?.startedAt ?? "—"}</p>
                <p className="text-[10px] text-white/60">Source: server-side health engine</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={endPeriod}
                disabled={acting}
                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-full border border-white/15 transition-all inline-flex items-center gap-2 disabled:opacity-50"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Log Period End</span>
              </button>
              <button
                onClick={startPeriod}
                disabled={acting}
                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-full border border-white/15 transition-all inline-flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>New Cycle (restart today)</span>
              </button>
            </div>

            {/* Disclaimer Notice */}
            <div className="p-3.5 bg-white/10 rounded-2xl border border-white/10 text-xs text-white/80 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-[#E8E0FF] shrink-0 mt-0.5" />
              <span>
                Fertility estimates are non-diagnostic statistical ranges based on past cycle length variations and must not be used as the sole method of contraception.
              </span>
            </div>
          </>
        )}
      </div>

      {/* Calendar Legend & View Switcher */}
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E7E2EB] pb-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-[#6C4CF1]" />
            <h3 className="text-lg font-bold font-display text-[#17131D]">
              Cycle History ({history.length})
            </h3>
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
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Active Cycle</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-200 border border-rose-300" /> Completed</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#6C4CF1]" /> Prediction Engine</span>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <CalendarIcon className="w-10 h-10 text-[#918A98] mx-auto" />
            <p className="text-sm font-bold text-[#17131D]">No cycles recorded yet</p>
            <p className="text-xs text-[#6E6875]">Log your first period above to begin building your history.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 12).map((c) => (
              <div
                key={c.id}
                className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                  c.status === "active"
                    ? "bg-rose-50 border-rose-200"
                    : "bg-[#F5F2FF]/60 border-[#E8E0FF]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${c.status === "active" ? "bg-rose-500" : "bg-rose-200 border border-rose-300"}`} />
                  <div>
                    <p className="text-xs font-bold text-[#17131D]">Started {c.startedAt}</p>
                    <p className="text-[10px] text-[#6E6875]">Status: {c.status}</p>
                  </div>
                </div>
                {c.status === "active" && (
                  <span className="text-[10px] font-bold text-rose-600 bg-white px-2.5 py-1 rounded-full border border-rose-200">
                    Day {c.dayOfCycle}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
