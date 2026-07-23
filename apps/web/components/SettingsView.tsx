"use client";

import { useState } from "react";
import {
  Settings,
  Eye,
  Sliders,
  ShieldCheck,
  Download,
  Trash2,
  Lock,
  CheckCircle2,
  Sun,
  Moon,
  Volume2,
} from "lucide-react";

interface SettingsViewProps {
  userProfile: any;
}

export default function SettingsView({ userProfile }: SettingsViewProps) {
  const [textSize, setTextSize] = useState<"normal" | "large" | "xlarge">("normal");
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [discreetNotifications, setDiscreetNotifications] = useState(true);

  const [exporting, setExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  const handleExportData = () => {
    setExporting(true);
    setTimeout(() => {
      setExporting(false);
      setExportComplete(true);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(userProfile, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `obiren_full_user_data_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    }, 1500);
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

        <div className="space-y-4">
          <div className="p-4 bg-[#F5F2FF]/60 rounded-2xl border border-[#E8E0FF] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#17131D]">Export All My Data (JSON)</p>
              <p className="text-[11px] text-[#6E6875]">Download a complete, machine-readable export of your cycle logs and profile.</p>
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
              <p className="text-xs font-bold text-[#C53D52]">Permanently Delete My Account</p>
              <p className="text-[11px] text-red-800/80">Purges all your cycle logs, health vault files, and profile data from Obiren databases.</p>
            </div>
            <button
              onClick={() => {
                if (confirm("Are you sure you want to permanently delete your Obiren account? This action cannot be undone.")) {
                  alert("Account deletion request logged under NDPR rules. Purge scheduled within 30 days.");
                }
              }}
              className="px-5 py-2.5 bg-[#C53D52] hover:bg-red-700 text-white text-xs font-bold rounded-full transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Account</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
