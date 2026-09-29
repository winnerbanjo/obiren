"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ShieldAlert,
  MapPin,
  PhoneCall,
  X,
  AlertCircle,
  CheckCircle2,
  Lock,
  Search,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";
import { getCountryConfig } from "@obiren/localization";
import {
  safetyApi,
  directoryApi,
  ApiError,
  SosIncident,
  DirectoryRecord,
} from "@obiren/api-client";

interface SafetyCentreViewProps {
  userProfile: any;
}

export default function SafetyCentreView({ userProfile }: SafetyCentreViewProps) {
  const countryCode = userProfile?.countryCode || "NG";
  const countryConfig = getCountryConfig(countryCode);

  const [activeTab, setActiveTab] = useState<"circle" | "sos" | "directory">("directory");
  const [directoryCategory, setDirectoryCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [directory, setDirectory] = useState<DirectoryRecord[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [directoryError, setDirectoryError] = useState("");

  // Safety PIN state
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinSetupMode, setPinSetupMode] = useState(false);
  const [pinMessage, setPinMessage] = useState("");
  const [pinError, setPinError] = useState("");

  // SOS Flow State
  const [isTestMode, setIsTestMode] = useState(true);
  const [sosActive, setSosActive] = useState<SosIncident | null>(null);
  const [sosLogs, setSosLogs] = useState<Array<{ time: string; msg: string }>>([]);
  const [cancelPin, setCancelPin] = useState("");
  const [sosError, setSosError] = useState("");
  const [acting, setActing] = useState(false);

  const loadDirectory = useCallback(async () => {
    setDirectoryLoading(true);
    setDirectoryError("");
    try {
      const results = await directoryApi.search({ countryCode, limit: 50 });
      setDirectory(results ?? []);
    } catch (err) {
      setDirectoryError(
        err instanceof ApiError
          ? `Could not load the emergency directory: ${err.message}`
          : "Could not load the emergency directory. Please try again."
      );
      setDirectory([]);
    } finally {
      setDirectoryLoading(false);
    }
  }, [countryCode]);

  const loadPinStatus = useCallback(async () => {
    try {
      const status = await safetyApi.pinStatus();
      setHasPin(status.hasSafetyPin);
    } catch {
      setHasPin(null);
    }
  }, []);

  useEffect(() => {
    loadDirectory();
    loadPinStatus();
  }, [loadDirectory, loadPinStatus]);

  const filteredDirectory = directory.filter((rec) => {
    const matchesCat =
      directoryCategory === "All" ||
      rec.top_category?.toLowerCase().includes(directoryCategory.toLowerCase());
    const matchesQuery =
      !searchQuery ||
      rec.organisation_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.service_summary?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  const categoryOptions = ["All", "Emergency services", "Safety and abuse support", "Women's healthcare", "Mental health", "Legal and safety support"];

  // ---------------- PIN management ----------------

  const handleSavePin = async () => {
    setPinError("");
    setPinMessage("");
    if (!/^\d{4,8}$/.test(pinInput)) {
      setPinError("Your Safety PIN must be 4-8 digits.");
      return;
    }
    setActing(true);
    try {
      const result = await safetyApi.setPin(pinInput);
      setPinMessage(result.message);
      setPinInput("");
      setPinSetupMode(false);
      setHasPin(true);
    } catch (err) {
      setPinError(err instanceof ApiError ? err.message : "Could not save your PIN. Try again.");
    } finally {
      setActing(false);
    }
  };

  // ---------------- SOS flow ----------------

  const triggerSos = async () => {
    setActing(true);
    setSosError("");
    setSosLogs([]);
    try {
      const result = await safetyApi.triggerSos({ isTestMode });
      setSosActive(result.incident);
      setSosLogs([
        { time: new Date().toLocaleTimeString(), msg: `SOS Triggered (${isTestMode ? "TEST MODE" : "LIVE INCIDENT"})` },
        { time: new Date().toLocaleTimeString(), msg: result.message },
      ]);
    } catch (err) {
      setSosError(err instanceof ApiError ? err.message : "Could not trigger SOS. Try again or call emergency services.");
    } finally {
      setActing(false);
    }
  };

  const cancelSos = async () => {
    setSosError("");
    if (!/^\d{4,8}$/.test(cancelPin)) {
      setSosError("Enter your 4-8 digit Safety PIN to cancel the active SOS.");
      return;
    }
    setActing(true);
    try {
      await safetyApi.cancelSos(cancelPin);
      setSosLogs((prev) => [
        { time: new Date().toLocaleTimeString(), msg: "Incident cancelled after PIN verification" },
        ...prev,
      ]);
      setSosActive(null);
      setCancelPin("");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "SAFETY_PIN_LOCKED") {
          setSosError("PIN verification locked after repeated failures. The SOS remains active.");
        } else {
          setSosError(err.message);
        }
      } else {
        setSosError("Could not cancel the SOS. The incident remains active.");
      }
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-[#E7E2EB] shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-[#17131D]">Safety Centre & Emergency Directory</h2>
          <p className="text-xs text-[#6E6875]">
            Web SOS panic dispatch & verified emergency records for {countryConfig.name} {countryConfig.flag}.
          </p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: "directory", label: `Directory (${filteredDirectory.length})` },
            { id: "sos", label: "Web SOS Flow" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-full text-xs font-bold capitalize transition-all shrink-0 ${
                activeTab === tab.id ? "bg-[#6C4CF1] text-white shadow-sm" : "bg-[#F5F2FF] text-[#6E6875]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. DIRECTORY TAB */}
      {activeTab === "directory" && (
        <div className="space-y-6">
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold font-display text-[#17131D]">Verified Emergency Directory</h3>
                <p className="text-xs text-[#6E6875]">Source-verified emergency numbers, crisis shelters, legal aid, and maternal health services.</p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#6E6875]" />
                <input
                  type="text"
                  placeholder="Search helpline, legal aid..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#F5F2FF] border border-[#E8E0FF] rounded-full text-xs font-medium focus:outline-none focus:border-[#6C4CF1]"
                />
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
              {categoryOptions.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setDirectoryCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                    directoryCategory === cat
                      ? "bg-[#6C4CF1] text-white shadow-sm"
                      : "bg-[#F5F2FF] text-[#6E6875] hover:bg-[#E8E0FF] hover:text-[#6C4CF1]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {directoryError && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> {directoryError}</span>
                <button onClick={loadDirectory} className="underline shrink-0">Retry</button>
              </div>
            )}

            {directoryLoading ? (
              <div className="py-10 text-center text-sm text-[#6E6875]">Loading verified emergency services...</div>
            ) : filteredDirectory.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <ShieldAlert className="w-10 h-10 text-[#918A98] mx-auto" />
                <p className="text-sm font-bold text-[#17131D]">No matching services</p>
                <p className="text-xs text-[#6E6875]">
                  In an emergency, call {countryConfig.emergencyNumbers.medical} immediately.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {filteredDirectory.map((rec) => (
                  <div
                    key={rec.record_id}
                    className="p-5 bg-[#F5F2FF]/60 rounded-2xl border border-[#E8E0FF] space-y-3 hover:border-[#6C4CF1] transition-colors flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-[#17131D]">{rec.organisation_name}</span>
                            <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-[#E8E0FF] text-[#6C4CF1]">
                              {rec.record_id}
                            </span>
                          </div>
                          <p className="text-[11px] font-bold text-[#6C4CF1] mt-0.5">{rec.top_category}</p>
                        </div>

                        {rec.verification_status && (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-[#238A5A] border border-emerald-200 shrink-0">
                            {rec.verification_status}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-[#6E6875] leading-relaxed">{rec.service_summary}</p>

                      <div className="flex flex-wrap gap-2 text-[10px] text-[#6E6875]">
                        {rec.hours && <span className="bg-white px-2 py-1 rounded border border-[#E8E0FF]">Hours: <strong>{rec.hours}</strong></span>}
                        {rec.cost && <span className="bg-white px-2 py-1 rounded border border-[#E8E0FF]">Cost: <strong>{rec.cost}</strong></span>}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#E8E0FF] flex items-center justify-between gap-2">
                      {rec.phone ? (
                        <a
                          href={`tel:${rec.phone.split(";")[0]}`}
                          className="px-4 py-2 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white text-xs font-bold rounded-full flex items-center gap-1.5 shadow-sm"
                        >
                          <PhoneCall className="w-3.5 h-3.5" /> Call {rec.phone.split(";")[0]}
                        </a>
                      ) : (
                        <span />
                      )}
                      {rec.whatsapp_or_text && (
                        <a
                          href={`https://wa.me/${rec.whatsapp_or_text.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 bg-white border border-[#E8E0FF] text-[#6C4CF1] text-xs font-bold rounded-full flex items-center gap-1.5"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. SOS TAB */}
      {activeTab === "sos" && (
        <div className="space-y-6">
          {/* Safety PIN Management */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#6C4CF1]" />
                <h3 className="text-lg font-bold font-display text-[#17131D]">Safety PIN</h3>
              </div>
              {hasPin !== null && (
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${hasPin ? "bg-emerald-50 text-[#238A5A] border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                  {hasPin ? "Configured" : "Not set"}
                </span>
              )}
            </div>
            <p className="text-xs text-[#6E6875]">
              Your Safety PIN is required to cancel an active SOS alert. It is stored as a cryptographic hash - nobody (including Obiren staff) can read it.
            </p>

            {hasPin === false || pinSetupMode ? (
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <input
                  type="password"
                  inputMode="numeric"
                  placeholder="Set 4-8 digit PIN"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  className="flex-1 px-4 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] rounded-xl text-sm tracking-widest focus:outline-none focus:border-[#6C4CF1]"
                />
                <button
                  onClick={handleSavePin}
                  disabled={acting}
                  className="px-5 py-2.5 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white text-xs font-bold rounded-full disabled:opacity-50"
                >
                  {hasPin ? "Update PIN" : "Create PIN"}
                </button>
                {pinSetupMode && (
                  <button onClick={() => setPinSetupMode(false)} className="px-4 py-2.5 text-xs font-bold text-[#6E6875]">
                    Cancel
                  </button>
                )}
              </div>
            ) : hasPin ? (
              <button
                onClick={() => setPinSetupMode(true)}
                className="px-4 py-2 bg-[#F5F2FF] border border-[#E8E0FF] text-[#6C4CF1] text-xs font-bold rounded-full"
              >
                Change PIN
              </button>
            ) : (
              <div className="text-xs text-amber-700 font-bold">Checking PIN status...</div>
            )}

            {pinMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> {pinMessage}
              </div>
            )}
            {pinError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {pinError}
              </div>
            )}
          </div>

          {/* SOS Trigger Panel */}
          <div className="bg-gradient-to-br from-[#2A1420] via-[#3A1826] to-[#2A1420] text-white p-6 sm:p-8 rounded-3xl shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold font-display">Web SOS Panic Alert</h3>
              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTestMode}
                  onChange={(e) => setIsTestMode(e.target.checked)}
                  className="accent-[#6C4CF1] w-4 h-4"
                />
                Test Mode (no real alerts)
              </label>
            </div>

            {!sosActive ? (
              <div className="space-y-4">
                <p className="text-xs text-white/70 leading-relaxed">
                  Triggering an SOS records a live safety incident, and alerts your Trusted Circle. To stop an active SOS you must verify your Safety PIN.
                  {!isTestMode && " You are about to trigger a LIVE alert."}
                </p>
                {!hasPin && (
                  <div className="p-3 bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-bold rounded-xl">
                    Set your Safety PIN above first - you will need it to cancel an SOS.
                  </div>
                )}
                <button
                  onClick={triggerSos}
                  disabled={acting}
                  className="w-full py-6 bg-red-600 hover:bg-red-700 text-white text-lg font-black rounded-3xl shadow-2xl transition-all flex flex-col items-center justify-center gap-1 disabled:opacity-50"
                >
                  <ShieldAlert className="w-8 h-8" />
                  <span>{acting ? "Triggering..." : isTestMode ? "START TEST SOS" : "TRIGGER SOS ALERT"}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-red-500/20 border border-red-400/40 rounded-2xl space-y-1">
                  <p className="text-sm font-black text-red-200 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5" /> SOS {sosActive.isTestMode ? "(TEST)" : "LIVE"} - {sosActive.status.toUpperCase()}
                  </p>
                  <p className="text-xs text-white/70">Triggered at {new Date(sosActive.triggeredAt).toLocaleString()}</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="Enter Safety PIN to cancel"
                    value={cancelPin}
                    onChange={(e) => setCancelPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-sm tracking-widest text-white placeholder-white/50 focus:outline-none focus:border-white/40"
                  />
                  <button
                    onClick={cancelSos}
                    disabled={acting}
                    className="px-6 py-3 bg-white text-[#17131D] hover:bg-white/90 text-xs font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    <X className="w-4 h-4" /> Cancel SOS
                  </button>
                </div>
                <p className="text-[10px] text-white/50">
                  Repeated incorrect PIN attempts temporarily lock cancellation for your protection.
                </p>
              </div>
            )}

            {sosError && (
              <div className="p-3 bg-red-500/20 border border-red-400/40 text-red-200 text-xs font-bold rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {sosError}
              </div>
            )}

            {sosLogs.length > 0 && (
              <div className="space-y-1.5 pt-2">
                {sosLogs.map((log, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] text-white/70 font-mono">
                    <span className="text-white/40">{log.time}</span>
                    <span>{log.msg}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
