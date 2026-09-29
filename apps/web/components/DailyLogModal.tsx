"use client";

import { useEffect, useState } from "react";
import { X, Droplets, AlertCircle, CheckCircle2 } from "lucide-react";
import { cyclesApi, ApiError, DailyLogData } from "@obiren/api-client";

interface DailyLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveLog?: (logData: DailyLogData) => void;
}

const BLEEDING_MAP: Record<string, string> = {
  NONE: "none",
  SPOTTING: "spotting",
  LIGHT: "light",
  MEDIUM: "medium",
  HEAVY: "heavy",
};
const PAIN_MAP: Record<string, number> = { NONE: 0, MILD: 3, MODERATE: 6, SEVERE: 9 };

export default function DailyLogModal({ isOpen, onClose, onSaveLog }: DailyLogModalProps) {
  const [logDate, setLogDate] = useState(new Date().toISOString().split("T")[0]);
  const [bleeding, setBleeding] = useState<"NONE" | "SPOTTING" | "LIGHT" | "MEDIUM" | "HEAVY">("NONE");
  const [pain, setPain] = useState<"NONE" | "MILD" | "MODERATE" | "SEVERE">("NONE");
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [privateNote, setPrivateNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [saved, setSaved] = useState(false);

  const symptomsList = ["Cramps", "Headache", "Back Pain", "Bloating", "Breast Pain", "Acne", "Fatigue", "Nausea"];
  const moodsList = ["Calm", "Happy", "Low", "Anxious", "Irritable", "Energetic", "Overwhelmed"];

  // Load the existing log for the chosen date so edits reflect persisted state.
  useEffect(() => {
    if (!isOpen) return;
    setSaved(false);
    setErrorMsg("");
    (async () => {
      try {
        const existing = await cyclesApi.getDailyLog(logDate);
        if (existing) {
          setBleeding(
            (Object.keys(BLEEDING_MAP).find(
              (k) => BLEEDING_MAP[k] === existing.bleeding?.level,
            ) as typeof bleeding) || "NONE",
          );
          const lvl = existing.pain?.level ?? 0;
          setPain(lvl >= 7 ? "SEVERE" : lvl >= 4 ? "MODERATE" : lvl >= 1 ? "MILD" : "NONE");
          setSelectedSymptoms(existing.symptoms ?? []);
          setSelectedMoods(existing.moods ?? []);
          setPrivateNote(existing.notes ?? "");
        } else {
          setBleeding("NONE");
          setPain("NONE");
          setSelectedSymptoms([]);
          setSelectedMoods([]);
          setPrivateNote("");
        }
      } catch {
        // Starting a fresh log is fine if the fetch fails.
      }
    })();
  }, [isOpen, logDate]);

  const toggleSymptom = (s: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(s) ? prev.filter((item) => item !== s) : [...prev, s]
    );
  };

  const toggleMood = (m: string) => {
    setSelectedMoods((prev) =>
      prev.includes(m) ? prev.filter((item) => item !== m) : [...prev, m]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");
    try {
      const payload: Partial<DailyLogData> = {
        bleeding: { level: BLEEDING_MAP[bleeding] },
        pain: { level: PAIN_MAP[pain] },
        symptoms: selectedSymptoms,
        moods: selectedMoods,
        ...(privateNote.trim() ? { notes: privateNote.trim() } : {}),
      };
      const savedLog = await cyclesApi.upsertDailyLog(logDate, payload);
      onSaveLog?.(savedLog);
      setSaved(true);
      setTimeout(onClose, 700);
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError ? err.message : "Could not save your check-in. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-lg space-y-6 shadow-2xl border border-[#E7E2EB]">
        <div className="flex justify-between items-center border-b border-[#E7E2EB] pb-3">
          <div>
            <h3 className="text-xl font-bold font-display text-[#17131D]">Daily Health Check-In</h3>
            <p className="text-xs text-[#6E6875]">Takes ~20 seconds to record your day</p>
          </div>
          <button onClick={onClose} className="p-2 text-[#6E6875] hover:bg-[#F5F2FF] rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Log Date */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#6E6875] mb-1">Date</label>
            <input
              type="date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className="w-full px-4 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] rounded-xl text-xs font-bold focus:outline-none"
            />
          </div>

          {/* Bleeding Intensity */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#6E6875]">
              <Droplets className="w-3.5 h-3.5 text-rose-500" /> Bleeding Intensity
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {(["NONE", "SPOTTING", "LIGHT", "MEDIUM", "HEAVY"] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBleeding(b)}
                  className={`py-2 text-[10px] font-bold rounded-xl border transition-all ${
                    bleeding === b
                      ? "bg-rose-500 text-white border-rose-600 shadow-sm"
                      : "bg-[#F5F2FF] text-[#17131D] border-[#E8E0FF] hover:bg-rose-50"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Pain Level */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#6E6875]">Pain Level</label>
            <div className="grid grid-cols-4 gap-2">
              {(["NONE", "MILD", "MODERATE", "SEVERE"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPain(p)}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                    pain === p
                      ? "bg-[#6C4CF1] text-white border-[#6C4CF1] shadow-sm"
                      : "bg-[#F5F2FF] text-[#17131D] border-[#E8E0FF]"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Symptoms Chips */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#6E6875]">Symptoms Logged</label>
            <div className="flex flex-wrap gap-1.5">
              {symptomsList.map((sym) => {
                const active = selectedSymptoms.includes(sym);
                return (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => toggleSymptom(sym)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      active ? "bg-[#6C4CF1] text-white" : "bg-[#F5F2FF] text-[#6E6875] border border-[#E8E0FF]"
                    }`}
                  >
                    {active ? "✓ " : "+ "}{sym}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Moods Chips */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#6E6875]">Mood & Energy</label>
            <div className="flex flex-wrap gap-1.5">
              {moodsList.map((m) => {
                const active = selectedMoods.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleMood(m)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      active ? "bg-[#6C4CF1] text-white" : "bg-[#F5F2FF] text-[#6E6875] border border-[#E8E0FF]"
                    }`}
                  >
                    {active ? "✓ " : "+ "}{m}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Private Note */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#6E6875] mb-1">Private Encrypted Note</label>
            <textarea
              rows={2}
              placeholder="Add optional notes..."
              value={privateNote}
              onChange={(e) => setPrivateNote(e.target.value)}
              maxLength={2000}
              className="w-full px-4 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] rounded-xl text-xs focus:outline-none"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {saved && !errorMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Check-in saved securely.</span>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white font-bold text-xs rounded-full shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            <span>{saving ? "Saving..." : "Save Check-In"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
