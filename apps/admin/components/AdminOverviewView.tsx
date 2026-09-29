"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users,
  Baby,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Activity,
} from "lucide-react";
import { adminApi, ApiError } from "@obiren/api-client";

interface AdminOverviewViewProps {
  selectedCountry: string;
  onNavigate: (tab: string) => void;
}

export default function AdminOverviewView({
  selectedCountry,
}: AdminOverviewViewProps) {
  const [metrics, setMetrics] = useState<{
    totalUsers: number;
    activePregnancies: number;
    verifiedEmergencyResources: number;
    countryBreakdown: Record<string, { users: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await adminApi.metrics();
      setMetrics(data);
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError && err.status === 403
          ? "Your role does not grant access to platform metrics."
          : err instanceof ApiError
            ? err.message
            : "Could not load platform metrics.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const countryRows = metrics
    ? Object.entries(metrics.countryBreakdown || {}).map(([code, v]) => ({
        code,
        users: v.users,
      }))
    : [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#21182F] via-[#2D1F45] to-[#21182F] text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-purple-900/40">
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#9B6BFF] bg-white/10 px-3 py-1 rounded-full border border-white/15">
            Operational Dashboard • {selectedCountry === "ALL" ? "Global System View" : `${selectedCountry} Market`}
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold font-display">Obiren Platform Operations</h2>
          <p className="text-xs text-white/70">Live metrics from the Obiren production database.</p>
        </div>

        <button
          onClick={load}
          className="px-5 py-3 bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold rounded-full transition-all inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Data
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-2xl flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white p-12 rounded-3xl border border-[#E7E2EB] text-center text-sm text-[#6E6875]">
          Loading live platform metrics...
        </div>
      ) : metrics ? (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-[#6C4CF1]">
                <Users className="w-5 h-5" />
                <p className="text-[10px] uppercase font-bold text-[#6E6875]">Total Registered Users</p>
              </div>
              <p className="text-3xl font-black font-display text-[#17131D]">{metrics.totalUsers.toLocaleString()}</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-[#6C4CF1]">
                <Baby className="w-5 h-5" />
                <p className="text-[10px] uppercase font-bold text-[#6E6875]">Active Pregnancy Profiles</p>
              </div>
              <p className="text-3xl font-black font-display text-[#17131D]">{metrics.activePregnancies.toLocaleString()}</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-[#6C4CF1]">
                <ShieldAlert className="w-5 h-5" />
                <p className="text-[10px] uppercase font-bold text-[#6E6875]">Verified Emergency Resources</p>
              </div>
              <p className="text-3xl font-black font-display text-[#17131D]">{metrics.verifiedEmergencyResources.toLocaleString()}</p>
            </div>
          </div>

          {/* Country Breakdown */}
          <div className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#6C4CF1]" />
              <h3 className="text-lg font-bold font-display text-[#17131D]">Users by Country</h3>
            </div>

            {countryRows.length === 0 ? (
              <p className="text-xs text-[#6E6875]">No user data available yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase font-bold text-[#6E6875] border-b border-[#E7E2EB]">
                      <th className="py-2 pr-4">Country</th>
                      <th className="py-2 pr-4">Registered Users</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countryRows.map((row) => (
                      <tr key={row.code} className="border-b border-[#F5F2FF] last:border-0">
                        <td className="py-2.5 pr-4 font-bold text-[#17131D]">{row.code}</td>
                        <td className="py-2.5 pr-4 font-bold text-[#6C4CF1]">{row.users.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
