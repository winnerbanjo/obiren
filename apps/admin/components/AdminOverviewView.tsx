"use client";

import { motion } from "framer-motion";
import {
  Users,
  Calendar,
  Baby,
  Stethoscope,
  ShieldAlert,
  Radio,
  CreditCard,
  LifeBuoy,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Server,
  Database,
  Activity,
  Globe,
} from "lucide-react";

interface AdminOverviewViewProps {
  selectedCountry: string;
  onNavigate: (tab: string) => void;
}

export default function AdminOverviewView({
  selectedCountry,
  onNavigate,
}: AdminOverviewViewProps) {
  const globalMetrics = [
    { title: "Total Registered Users", val: "14,280", badge: "+12% this week", icon: Users, color: "text-[#6C4CF1]" },
    { title: "Active Cycle Trackers", val: "9,410", badge: "66% of users", icon: Calendar, color: "text-[#6C4CF1]" },
    { title: "Active Pregnancy Profiles", val: "2,150", badge: "15% of users", icon: Baby, color: "text-[#6C4CF1]" },
    { title: "Verified Doctors", val: "86", badge: "12 Pending Queue", icon: Stethoscope, color: "text-emerald-600" },
    { title: "Emergency Resources", val: "142", badge: "4 Markets Verified", icon: ShieldAlert, color: "text-amber-600" },
    { title: "Unresolved Tickets", val: "4", badge: "Avg Response 12m", icon: LifeBuoy, color: "text-[#C53D52]" },
  ];

  const countryStats = [
    { country: "Nigeria", code: "NG", flag: "🇳🇬", users: "6,420", cycle: "4,120", pregnancy: "940", doctors: "38", revenue: "₦14.2M" },
    { country: "United Kingdom", code: "GB", flag: "🇬🇧", users: "4,150", cycle: "2,810", pregnancy: "620", doctors: "24", revenue: "£38.5K" },
    { country: "United States", code: "US", flag: "🇺🇸", users: "2,410", cycle: "1,610", pregnancy: "380", doctors: "16", revenue: "$42.1K" },
    { country: "Ghana", code: "GH", flag: "🇬🇭", users: "1,300", cycle: "870", pregnancy: "210", doctors: "8", revenue: "₵92.4K" },
  ];

  const filteredCountryStats = countryStats.filter((c) => selectedCountry === "ALL" || c.code === selectedCountry);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#21182F] via-[#2D1F45] to-[#21182F] text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-purple-900/40">
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#9B6BFF] bg-white/10 px-3 py-1 rounded-full border border-white/15">
            Operational Dashboard • {selectedCountry === "ALL" ? "Global System View" : `${selectedCountry} Market`}
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold font-display">Obiren Platform Operations</h2>
          <p className="text-xs text-white/70">Single source of operational control for UK, US, Nigeria & Ghana clients.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate("professionals")}
            className="px-5 py-3 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white text-xs font-bold rounded-full shadow-md transition-all shrink-0"
          >
            Review Doctors Queue (12)
          </button>
        </div>
      </div>

      {/* Global Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {globalMetrics.map((m, idx) => {
          const Icon = m.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.05 }}
              className="bg-white p-4 rounded-2xl border border-[#E7E2EB] shadow-sm space-y-2 flex flex-col justify-between"
            >
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase font-bold text-[#6E6875] truncate">{m.title}</span>
                <Icon className={`w-4 h-4 ${m.color}`} />
              </div>
              <div>
                <p className="text-2xl font-black font-display text-[#17131D]">{m.val}</p>
                <p className="text-[10px] font-bold text-[#6C4CF1]">{m.badge}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Country Market Performance Matrix */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-6">
        <div className="flex justify-between items-center border-b border-[#E7E2EB] pb-4">
          <div>
            <h3 className="text-lg font-bold font-display text-[#17131D]">Country Market Performance Matrix</h3>
            <p className="text-xs text-[#6E6875]">Multi-region deployment breakdown and revenue allocation.</p>
          </div>
          <span className="text-xs font-bold text-[#6C4CF1] bg-[#F5F2FF] px-3 py-1 rounded-full border border-[#E8E0FF]">
            4 Active Markets
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E7E2EB] text-[#6E6875] uppercase text-[10px] font-bold tracking-wider">
                <th className="pb-3 px-3">Market</th>
                <th className="pb-3 px-3">Registered Users</th>
                <th className="pb-3 px-3">Cycle Trackers</th>
                <th className="pb-3 px-3">Pregnancy Profiles</th>
                <th className="pb-3 px-3">Verified Doctors</th>
                <th className="pb-3 px-3">Gross Revenue</th>
                <th className="pb-3 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E2EB]">
              {filteredCountryStats.map((c, i) => (
                <tr key={i} className="hover:bg-[#F5F2FF]/50 transition-colors">
                  <td className="py-3.5 px-3 font-bold text-[#17131D] flex items-center gap-2">
                    <span className="text-base">{c.flag}</span>
                    <span>{c.country} ({c.code})</span>
                  </td>
                  <td className="py-3.5 px-3 font-semibold text-[#17131D]">{c.users}</td>
                  <td className="py-3.5 px-3 text-[#6E6875]">{c.cycle}</td>
                  <td className="py-3.5 px-3 text-[#6E6875]">{c.pregnancy}</td>
                  <td className="py-3.5 px-3 text-[#6C4CF1] font-bold">{c.doctors}</td>
                  <td className="py-3.5 px-3 font-black text-[#17131D]">{c.revenue}</td>
                  <td className="py-3.5 px-3 text-right">
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-[#238A5A] border border-emerald-200">
                      LIVE
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Operational Queues & System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Action Queues */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-4">
            <h3 className="text-lg font-bold font-display text-[#17131D]">Operational Action Queues</h3>
            
            <div className="space-y-3">
              <div className="p-4 bg-[#F5F2FF] rounded-2xl border border-[#E8E0FF] flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#17131D]">12 Doctor Verification Applications Pending</span>
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md">High Priority</span>
                  </div>
                  <p className="text-[11px] text-[#6E6875]">Medical licences submitted from Lagos (NG) and London (UK) requiring credential verification.</p>
                </div>
                <button onClick={() => onNavigate("professionals")} className="px-4 py-2 bg-[#6C4CF1] text-white text-xs font-bold rounded-full shrink-0">
                  Review Queue
                </button>
              </div>

              <div className="p-4 bg-[#F5F2FF] rounded-2xl border border-[#E8E0FF] flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#17131D]">3 Knowledge Articles Awaiting Medical Review</span>
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-900 px-2 py-0.5 rounded-md">Medical Review</span>
                  </div>
                  <p className="text-[11px] text-[#6E6875]">Fibroids & PCOS clinical guidance drafted by Content Team requires gynecologist sign-off.</p>
                </div>
                <button onClick={() => onNavigate("medical_reviews")} className="px-4 py-2 bg-[#6C4CF1] text-white text-xs font-bold rounded-full shrink-0">
                  Review Articles
                </button>
              </div>

              <div className="p-4 bg-[#F5F2FF] rounded-2xl border border-[#E8E0FF] flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#17131D]">1 Data Export Request Approaching Compliance Deadline</span>
                    <span className="text-[10px] font-bold bg-rose-100 text-rose-900 px-2 py-0.5 rounded-md">NDPR / GDPR</span>
                  </div>
                  <p className="text-[11px] text-[#6E6875]">Automated machine-readable JSON data export requested by user #8892.</p>
                </div>
                <button onClick={() => onNavigate("users")} className="px-4 py-2 bg-[#6C4CF1] text-white text-xs font-bold rounded-full shrink-0">
                  Approve Export
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: System Infrastructure Health */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-4">
            <h3 className="text-lg font-bold font-display text-[#17131D]">System Infrastructure Health</h3>
            
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex justify-between items-center">
                <span className="font-bold text-[#17131D] flex items-center gap-2">
                  <Server className="w-4 h-4 text-[#238A5A]" /> API Server Gateways
                </span>
                <span className="font-bold text-[#238A5A]">99.98% Healthy</span>
              </div>

              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex justify-between items-center">
                <span className="font-bold text-[#17131D] flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#238A5A]" /> MongoDB Atlas Cluster
                </span>
                <span className="font-bold text-[#238A5A]">Primary Active</span>
              </div>

              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex justify-between items-center">
                <span className="font-bold text-[#17131D] flex items-center gap-2">
                  <Radio className="w-4 h-4 text-[#238A5A]" /> Web SOS Panic Worker
                </span>
                <span className="font-bold text-[#238A5A]">100% Delivery</span>
              </div>

              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex justify-between items-center">
                <span className="font-bold text-[#17131D] flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#238A5A]" /> Payment Providers (Stripe/Paystack)
                </span>
                <span className="font-bold text-[#238A5A]">Online</span>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
