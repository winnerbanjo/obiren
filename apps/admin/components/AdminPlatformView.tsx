"use client";

import { useState, useEffect } from "react";
import {
  Globe,
  Flag,
  FileText,
  Settings,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Percent,
} from "lucide-react";

interface AdminPlatformViewProps {
  selectedCountry: string;
  activeTabId?: string;
}

export default function AdminPlatformView({ selectedCountry, activeTabId }: AdminPlatformViewProps) {
  let defaultTab: "flags" | "countries" | "audit" | "settings" = "flags";
  if (activeTabId === "countries") defaultTab = "countries";
  else if (activeTabId === "audit_logs") defaultTab = "audit";
  else if (activeTabId === "system_settings") defaultTab = "settings";
  
  const [activeTab, setActiveTab] = useState<"flags" | "countries" | "audit" | "settings">(defaultTab);

  useEffect(() => {
    if (activeTabId === "countries") setActiveTab("countries");
    else if (activeTabId === "audit_logs") setActiveTab("audit");
    else if (activeTabId === "feature_flags") setActiveTab("flags");
    else if (activeTabId === "system_settings") setActiveTab("settings");
  }, [activeTabId]);

  // Feature Flags State
  const [featureFlags, setFeatureFlags] = useState([
    { id: "cycle_tracking", name: "Period & Cycle Tracker", enabled: true, rollout: 100, markets: ["NG", "GB", "US", "GH"] },
    { id: "pregnancy_mode", name: "Pregnancy Companion Tools", enabled: true, rollout: 100, markets: ["NG", "GB", "US", "GH"] },
    { id: "sos_panic", name: "Silent Web SOS Panic Dispatch", enabled: true, rollout: 100, markets: ["NG", "GB", "US", "GH"] },
    { id: "telegynecology", name: "Doctor Telehealth Video Consultations", enabled: true, rollout: 50, markets: ["NG", "GB"] },
    { id: "health_vault", name: "256-Bit Encrypted Health Vault", enabled: true, rollout: 100, markets: ["NG", "GB", "US", "GH"] },
  ]);

  // Audit Logs State
  const auditLogs = [
    { id: "log-8891", actor: "Director Vance (Super Admin)", action: "UNMASK_SENSITIVE_DATA", module: "Users", details: "Unmasked records for user u-101. Reason: Support Ticket #9910", ip: "102.89.23.14", time: "Today at 02:46 PM" },
    { id: "log-8890", actor: "Dr. Amina Bello (Medical Reviewer)", action: "APPROVE_MEDICAL_ARTICLE", module: "CMS", details: "Approved article 'Understanding Fibroids' for NG market", ip: "197.210.8.99", time: "Today at 01:20 PM" },
    { id: "log-8889", actor: "Director Vance (Super Admin)", action: "UPDATE_FEATURE_FLAG", module: "Platform", details: "Set 'telegynecology' rollout percentage to 50%", ip: "102.89.23.14", time: "Yesterday at 05:10 PM" },
  ];

  // Settings State
  const settings = [
    { key: "Session Timeout", value: "30 Minutes", type: "Security" },
    { key: "Max File Upload Size", value: "10 MB", type: "Storage" },
    { key: "2FA Requirement", value: "Enforced for all Admins", type: "Security" },
  ];

  const toggleFlag = (id: string) => {
    setFeatureFlags((prev) =>
      prev.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f))
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E7E2EB] pb-4">
        <button
          onClick={() => setActiveTab("flags")}
          className={`px-4 py-2 text-xs font-bold rounded-full transition-colors flex items-center gap-1.5 ${
            activeTab === "flags" ? "bg-[#17131D] text-white shadow-md" : "text-[#6E6875] hover:bg-[#F5F2FF]"
          }`}
        >
          <Flag className="w-3.5 h-3.5" />
          Feature Flags
        </button>
        <button
          onClick={() => setActiveTab("countries")}
          className={`px-4 py-2 text-xs font-bold rounded-full transition-colors flex items-center gap-1.5 ${
            activeTab === "countries" ? "bg-[#17131D] text-white shadow-md" : "text-[#6E6875] hover:bg-[#F5F2FF]"
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          Country Markets
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          className={`px-4 py-2 text-xs font-bold rounded-full transition-colors flex items-center gap-1.5 ${
            activeTab === "audit" ? "bg-[#17131D] text-white shadow-md" : "text-[#6E6875] hover:bg-[#F5F2FF]"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Audit Logs
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`px-4 py-2 text-xs font-bold rounded-full transition-colors flex items-center gap-1.5 ${
            activeTab === "settings" ? "bg-[#17131D] text-white shadow-md" : "text-[#6E6875] hover:bg-[#F5F2FF]"
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          System Settings
        </button>
      </div>

      {activeTab === "flags" && (
        <>
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm">
            <div>
              <h2 className="text-2xl font-bold font-display text-[#17131D]">Platform Controls & Security Audit Logs</h2>
              <p className="text-xs text-[#6E6875]">Configure feature flags, country market rules, and inspect immutable audit trail logs.</p>
            </div>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-6">
            <div className="flex justify-between items-center border-b border-[#E7E2EB] pb-4">
              <div>
                <h3 className="text-lg font-bold font-display text-[#17131D]">Feature Flags & Rollout Engine</h3>
                <p className="text-xs text-[#6E6875]">Control platform capabilities without redeploying application code.</p>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Emergency Kill-Switch Ready
              </span>
            </div>

            <div className="space-y-4">
              {featureFlags.map((flag) => (
                <div key={flag.id} className="p-4 bg-[#F5F2FF] rounded-2xl border border-[#E8E0FF] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#17131D] text-sm">{flag.name}</span>
                      <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-[#E8E0FF] text-[#6C4CF1]">
                        {flag.id}
                      </span>
                    </div>
                    <p className="text-xs text-[#6E6875]">Rollout: <strong>{flag.rollout}% Users</strong> • Markets: <strong>{flag.markets.join(", ")}</strong></p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleFlag(flag.id)}
                      className={`px-4 py-2 text-xs font-bold rounded-full transition-all ${
                        flag.enabled
                          ? "bg-[#6C4CF1] text-white shadow-md shadow-[#6C4CF1]/20"
                          : "bg-red-600 text-white"
                      }`}
                    >
                      {flag.enabled ? "Active (Enabled)" : "KILL-SWITCH (Disabled)"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === "countries" && (
        <div className="bg-white rounded-3xl border border-[#E7E2EB] shadow-sm overflow-hidden p-6 space-y-6">
          <div>
            <h2 className="text-2xl font-bold font-display text-[#17131D]">Country Markets Configuration</h2>
            <p className="text-xs text-[#6E6875]">Manage supported regions and localization settings.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {["Nigeria 🇳🇬", "United Kingdom 🇬🇧", "United States 🇺🇸", "Ghana 🇬🇭"].map((country, i) => (
              <div key={i} className="p-4 bg-white rounded-2xl border border-[#E8E0FF] flex justify-between items-center">
                <span className="font-bold text-[#17131D] text-sm">{country}</span>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-[#238A5A] border border-emerald-200">ACTIVE</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "audit" && (
        <div className="bg-white rounded-3xl border border-[#E7E2EB] shadow-sm p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-[#E7E2EB] pb-3">
            <div>
              <h3 className="text-lg font-bold font-display text-[#17131D]">Immutable System Audit Trail</h3>
              <p className="text-xs text-[#6E6875]">Read-only log stream of all administrative actions for compliance verification.</p>
            </div>
            <Lock className="w-5 h-5 text-[#6C4CF1]" />
          </div>

          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-4 bg-[#F5F2FF] rounded-2xl border border-[#E8E0FF] space-y-1.5 text-xs font-mono">
                <div className="flex justify-between items-center text-[#17131D]">
                  <span className="font-bold text-[#6C4CF1]">{log.action} ({log.module})</span>
                  <span className="text-[#6E6875] text-[11px]">{log.time}</span>
                </div>
                <p className="text-[#17131D]">{log.details}</p>
                <div className="flex justify-between items-center text-[10px] text-[#6E6875] pt-1">
                  <span>Actor: {log.actor}</span>
                  <span>IP: {log.ip}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "settings" && (
        <div className="bg-white rounded-3xl border border-[#E7E2EB] shadow-sm overflow-hidden p-6 space-y-6">
          <div>
            <h2 className="text-2xl font-bold font-display text-[#17131D]">Global System Settings</h2>
            <p className="text-xs text-[#6E6875]">Configure platform-wide rules and operational parameters.</p>
          </div>
          
          <div className="space-y-4">
            {settings.map((s, i) => (
              <div key={i} className="p-4 bg-[#F5F2FF]/60 rounded-2xl border border-[#E8E0FF] flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-[#17131D] text-sm">{s.key}</h4>
                  <p className="text-xs text-[#6E6875] mt-0.5">{s.type} Configuration</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono font-bold text-[#6D4AFF] bg-white px-3 py-1.5 rounded-lg border border-[#E8E0FF]">{s.value}</span>
                  <button className="px-3 py-1.5 text-xs font-bold text-[#17131D] bg-[#E8E0FF] rounded-lg hover:bg-[#D8CCFF]">Modify</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
