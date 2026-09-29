"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Baby,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Plus,
  Heart,
  Activity,
  ShieldAlert,
} from "lucide-react";
import {
  pregnancyApi,
  ApiError,
  PregnancyData,
} from "@obiren/api-client";

interface PregnancyViewProps {
  userProfile: any;
  onSessionRefresh?: () => void;
}

const HIGH_RISK_SYMPTOMS = ["severe_bleeding", "severe_abdominal_pain", "vision_loss", "reduced_fetal_movement"];

export default function PregnancyView({ userProfile, onSessionRefresh }: PregnancyViewProps) {
  const [pregnancy, setPregnancy] = useState<PregnancyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [notice, setNotice] = useState("");
  const [safetyNotice, setSafetyNotice] = useState<{ title: string; message: string } | null>(null);

  // Setup form
  const [showSetup, setShowSetup] = useState(false);
  const [lmpDate, setLmpDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Symptom log
  const [symptomsText, setSymptomsText] = useState("");
  const [logging, setLogging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const current = await pregnancyApi.getCurrent();
      setPregnancy(current ?? null);
      setShowSetup(!current);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Could not load your pregnancy profile.");
      setPregnancy(null);
      setShowSetup(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createPregnancy = async () => {
    setSubmitting(true);
    setErrorMsg("");
    setNotice("");
    try {
      await pregnancyApi.create({
        ...(lmpDate ? { lastMenstrualPeriod: lmpDate } : {}),
        ...(dueDate ? { estimatedDueDate: dueDate } : {}),
        calculationSource: lmpDate ? "last_menstrual_period" : "user_entered",
      });
      setNotice("Pregnancy profile created.");
      setShowSetup(false);
      await load();
      onSessionRefresh?.();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Could not create your pregnancy profile.");
    } finally {
      setSubmitting(false);
    }
  };

  const endPregnancy = async () => {
    if (!pregnancy) return;
    if (!window.confirm("Archive this pregnancy profile? You can start a new one afterwards.")) return;
    setSubmitting(true);
    try {
      await pregnancyApi.end(pregnancy.id, "archived");
      setNotice("Pregnancy profile archived.");
      await load();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Could not archive the profile.");
    } finally {
      setSubmitting(false);
    }
  };

  const logSymptoms = async () => {
    if (!pregnancy) return;
    setLogging(true);
    setErrorMsg("");
    setNotice("");
    setSafetyNotice(null);
    try {
      const symptoms = symptomsText
        .split(",")
        .map((s) => s.trim().toLowerCase().replace(/\s+/g, "_"))
        .filter(Boolean)
        .slice(0, 20);

      const result = await pregnancyApi.logSymptom(
        pregnancy.id,
        new Date().toISOString().split("T")[0],
        { symptoms },
      );

      const highRisk = symptoms.some((s) => HIGH_RISK_SYMPTOMS.includes(s));
      if (highRisk || result?.safetyNotice) {
        setSafetyNotice({
          title: "Please seek urgent medical advice",
          message:
            "This symptom may require urgent clinical assessment. Contact your midwife or hospital immediately.",
        });
      } else {
        setNotice("Symptoms logged for today.");
      }
      setSymptomsText("");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Could not log symptoms.");
    } finally {
      setLogging(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-10 text-center text-sm text-[#6E6875]">Loading pregnancy profile...</div>
    );
  }

  if (!pregnancy) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Baby className="w-5 h-5 text-[#6C4CF1]" />
            <h2 className="text-2xl font-bold font-display text-[#17131D]">Pregnancy Companion</h2>
          </div>
          <p className="text-xs text-[#6E6875]">
            {showSetup
              ? "Set up your pregnancy profile with your last menstrual period or due date to unlock week-by-week tracking."
              : "No active pregnancy profile."}
          </p>

          {showSetup && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-[#6E6875] mb-1">Last Menstrual Period</label>
                  <input
                    type="date"
                    value={lmpDate}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setLmpDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] rounded-xl text-sm focus:outline-none focus:border-[#6C4CF1]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-[#6E6875] mb-1">Or Estimated Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] rounded-xl text-sm focus:outline-none focus:border-[#6C4CF1]"
                  />
                </div>
              </div>
              <button
                onClick={createPregnancy}
                disabled={submitting || (!lmpDate && !dueDate)}
                className="px-6 py-3 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white text-xs font-bold rounded-full shadow-md disabled:opacity-50 inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {submitting ? "Creating..." : "Create Pregnancy Profile"}
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {errorMsg}
            </div>
          )}
        </div>
      </div>
    );
  }

  const dueDateObj = new Date(pregnancy.estimatedDueDate);
  const daysRemaining = Math.max(0, Math.ceil((dueDateObj.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="space-y-4 sm:space-y-8 max-w-6xl mx-auto pb-6">
      {/* Header */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-[#E7E2EB] shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-2xl font-bold font-display text-[#17131D]">Pregnancy Companion</h2>
            <p className="text-[11px] sm:text-xs text-[#6E6875]">
              Due {pregnancy.estimatedDueDate} • {daysRemaining} days to go
            </p>
          </div>
          <span className="text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            W{pregnancy.currentWeek ?? "?"} Active
          </span>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {errorMsg}
          </div>
        )}
        {notice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> {notice}
          </div>
        )}
        {safetyNotice && (
          <div className="p-4 bg-red-50 border border-red-300 text-red-800 rounded-xl space-y-1">
            <p className="text-sm font-black flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> {safetyNotice.title}</p>
            <p className="text-xs">{safetyNotice.message}</p>
          </div>
        )}
      </div>

      {/* Milestone Card */}
      <div className="bg-gradient-to-br from-[#21182F] via-[#2F2148] to-[#21182F] text-white p-6 sm:p-8 rounded-3xl shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-white/10 rounded-2xl border border-white/10 space-y-1">
            <p className="text-[10px] uppercase font-bold text-white/70">Current Week</p>
            <p className="text-2xl font-extrabold">Week {pregnancy.currentWeek ?? "—"}, Day {pregnancy.currentDay ?? "—"}</p>
          </div>
          <div className="p-4 bg-white/10 rounded-2xl border border-white/10 space-y-1">
            <p className="text-[10px] uppercase font-bold text-white/70">Baby Size</p>
            <p className="text-2xl font-extrabold">{pregnancy.babyMilestone?.fruitSize ?? "—"}</p>
          </div>
          <div className="p-4 bg-white/10 rounded-2xl border border-white/10 space-y-1">
            <p className="text-[10px] uppercase font-bold text-white/70">Estimated Weight</p>
            <p className="text-2xl font-extrabold">{pregnancy.babyMilestone ? `${pregnancy.babyMilestone.weightGrams}g` : "—"}</p>
          </div>
        </div>
        <div className="p-3.5 mt-4 bg-white/10 rounded-2xl border border-white/10 text-xs text-white/80 flex items-start gap-2.5">
          <Calendar className="w-4 h-4 text-[#E8E0FF] shrink-0 mt-0.5" />
          <span>
            Gestational age is calculated server-side from your recorded dates and is an estimate, not a diagnostic.
          </span>
        </div>
      </div>

      {/* Symptom Logging */}
      <div className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-[#6C4CF1]" />
          <h3 className="text-lg font-bold font-display text-[#17131D]">Log Today&apos;s Symptoms</h3>
        </div>
        <p className="text-xs text-[#6E6875]">
          Comma-separated, e.g. <em>nausea, fatigue, reduced fetal movement</em>. High-risk symptoms trigger urgent-care guidance immediately.
        </p>
        <textarea
          rows={2}
          value={symptomsText}
          onChange={(e) => setSymptomsText(e.target.value)}
          placeholder="nausea, fatigue..."
          className="w-full px-4 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] rounded-xl text-xs focus:outline-none focus:border-[#6C4CF1]"
        />
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={logSymptoms}
            disabled={logging || !symptomsText.trim()}
            className="px-5 py-2.5 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white text-xs font-bold rounded-full disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Activity className="w-4 h-4" />
            {logging ? "Logging..." : "Log Symptoms"}
          </button>
          <button
            onClick={endPregnancy}
            disabled={submitting}
            className="px-5 py-2.5 bg-white border border-[#E7E2EB] text-[#6E6875] text-xs font-bold rounded-full disabled:opacity-50"
          >
            Archive Profile
          </button>
        </div>
      </div>
    </div>
  );
}
