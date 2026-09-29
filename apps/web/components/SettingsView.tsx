"use client";

import { useState } from "react";
import {
  Settings,
  Eye,
  ShieldCheck,
  Download,
  Trash2,
  Lock,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { usersApi, ApiError } from "@obiren/api-client";

interface SettingsViewProps {
  userProfile: any;
  onLogout?: () => void;
}

export default function SettingsView({ userProfile, onLogout }: SettingsViewProps) {
  const [textSize, setTextSize] = useState<"normal" | "large" | "xlarge">("normal");
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [discreetNotifications, setDiscreetNotifications] = useState(true);

  const [exporting, setExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [deletionPending, setDeletionPending] = useState(false);
  const [deletionNotice, setDeletionNotice] = useState("");

  // Real NDPR/GDPR export through the API (not a local profile dump).
  const handleExportData = async () => {
    setExporting(true);
    setErrorMsg("");
    try {
      const data = await usersApi.exportData();
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `obiren_user_data_export_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setExportComplete(true);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleRequestDeletion = async () => {
    if (!confirm("Request deletion of your Obiren account? There is a 30-day grace period during which you can cancel.")) return;
    setErrorMsg("");
    try {
      const result: any = await usersApi.requestDeletion();
      setDeletionPending(true);
      setDeletionNotice(
        result?.data?.gracePeriodDays
          ? `Deletion scheduled in ${result.data.gracePeriodDays} days. Sign in again before then to cancel.`
          : "Deletion scheduled. Sign in again before the grace period ends to cancel.",
      );
      setTimeout(() => onLogout?.(), 2500);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Could not request deletion.");
    }
  };

  const handleCancelDeletion = async () => {
    setErrorMsg("");
    try {
      await usersApi.cancelDeletion();
      setDeletionPending(false);
      setDeletionNotice("Deletion request cancelled.");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Could not cancel deletion.");
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm">
        <h2 className="text-2xl font-bold font-display text-[#17131D]">Accessibility & User Settings</h2>
        <p className="text-xs text-[#6E6875]">Manage interface accessibility, privacy preferences, and data portability.</p>
      </div>

      {/* WCAG 2.2 AA Accessibility Settings */}
      <div className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-6">
        <div className="flex items-center gap-2 text-[#6C4CF1]">
          <Eye className="w-5 h-5" />
          <h3 className="text-lg font-bold font-display text-[#17131D]">Accessibility Controls (WCAG 2.2 AA)</h3>
        </div>

        <div className="space-y-4">
          {/* Text Size */}
          <div className="p-4 bg-[#F5F2FF]/60 rounded-2xl border border-[#E8E0FF] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#17131D]">Text Resizing</p>
              <p className="text-[11px] text-[#6E6875]">Adjust display font scaling across all product modules.</p>
            </div>
            <div className="flex gap-2">
              {(["normal", "large", "xlarge"] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setTextSize(size)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                    textSize === size ? "bg-[#6C4CF1] text-white" : "bg-white text-[#6E6875] border border-[#E7E2EB]"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* High Contrast */}
          <div className="p-4 bg-[#F5F2FF]/60 rounded-2xl border border-[#E8E0FF] flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#17131D]">Increased Contrast Mode</p>
              <p className="text-[11px] text-[#6E6875]">Enhances text contrast ratio for high readability.</p>
            </div>
            <input
              type="checkbox"
              checked={highContrast}
              onChange={(e) => setHighContrast(e.target.checked)}
              className="accent-[#6C4CF1] w-4 h-4 cursor-pointer"
            />
          </div>

          {/* Reduced Motion */}
          <div className="p-4 bg-[#F5F2FF]/60 rounded-2xl border border-[#E8E0FF] flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#17131D]">Reduced Motion</p>
              <p className="text-[11px] text-[#6E6875]">Disables non-essential background animations and UI transitions.</p>
            </div>
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => setReducedMotion(e.target.checked)}
              className="accent-[#6C4CF1] w-4 h-4 cursor-pointer"
            />
          </div>

          {/* Discreet Notifications */}
          <div className="p-4 bg-[#F5F2FF]/60 rounded-2xl border border-[#E8E0FF] flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#17131D]">Discreet Lock-Screen Previews</p>
              <p className="text-[11px] text-[#6E6875]">Hides explicit health details in lock-screen push notifications.</p>
            </div>
            <input
              type="checkbox"
              checked={discreetNotifications}
              onChange={(e) => setDiscreetNotifications(e.target.checked)}
              className="accent-[#6C4CF1] w-4 h-4 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Data Portability & Deletion */}
      <div className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-6">
        <div className="flex items-center gap-2 text-[#6C4CF1]">
          <Lock className="w-5 h-5" />
          <h3 className="text-lg font-bold font-display text-[#17131D]">Data Portability & Account Rights</h3>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {errorMsg}
          </div>
        )}
        {deletionNotice && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-xl flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> {deletionNotice}
          </div>
        )}

        <div className="space-y-4">
          <div className="p-4 bg-[#F5F2FF]/60 rounded-2xl border border-[#E8E0FF] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#17131D]">Export All My Data (JSON)</p>
              <p className="text-[11px] text-[#6E6875]">Download a complete, machine-readable export of your account data (NDPR / GDPR Art. 20).</p>
            </div>
            <button
              onClick={handleExportData}
              disabled={exporting}
              className="px-5 py-2.5 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white text-xs font-bold rounded-full transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {exporting ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{exportComplete ? "Export Downloaded" : "Request Data Export"}</span>
            </button>
          </div>

          <div className="p-4 bg-red-50 rounded-2xl border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#C53D52]">
                {deletionPending ? "Account Deletion Scheduled" : "Permanently Delete My Account"}
              </p>
              <p className="text-[11px] text-red-800/80">
                Purges all your cycle logs, health vault files, and profile data after a 30-day grace period.
              </p>
            </div>
            {deletionPending ? (
              <button
                onClick={handleCancelDeletion}
                className="px-5 py-2.5 bg-white border border-amber-300 text-amber-700 text-xs font-bold rounded-full transition-colors flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Cancel Deletion</span>
              </button>
            ) : (
              <button
                onClick={handleRequestDeletion}
                className="px-5 py-2.5 bg-[#C53D52] hover:bg-red-700 text-white text-xs font-bold rounded-full transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Account</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="text-center text-[10px] text-[#918A98] flex items-center justify-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Signed in as {userProfile?.auth?.email || userProfile?.displayName || "user"}
      </p>
    </div>
  );
}
