"use client";

import { useState } from "react";
import {
  Users,
  Search,
  Filter,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  UserX,
  UserCheck,
  Mail,
  Download,
  Trash2,
  X,
  FileText,
  AlertTriangle,
} from "lucide-react";

interface AdminUsersViewProps {
  selectedCountry: string;
}

export default function AdminUsersView({ selectedCountry }: AdminUsersViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  // Unmask sensitive health data step-up protection
  const [sensitiveUnmasked, setSensitiveUnmasked] = useState(false);
  const [unmaskReason, setUnmaskReason] = useState("");

  const [users, setUsers] = useState([
    {
      id: "u-101",
      name: "Ella Vance",
      email: "ella@obiren.com",
      country: "NG",
      flag: "🇳🇬",
      status: "ACTIVE",
      verification: "VERIFIED",
      trackingMode: "PREGNANCY",
      pregnancyWeek: 22,
      joinedDate: "2026-06-12",
      lastActive: "Today at 02:45 PM",
      sensitiveLog: "Last period July 1, 2026. Fetal movement kick counter active (12 kicks today). Ultrasound scan uploaded.",
    },
    {
      id: "u-102",
      name: "Amara Okafor",
      email: "amara@example.com",
      country: "NG",
      flag: "🇳🇬",
      status: "ACTIVE",
      verification: "VERIFIED",
      trackingMode: "CYCLE_TRACKING",
      pregnancyWeek: null,
      joinedDate: "2026-05-18",
      lastActive: "Yesterday",
      sensitiveLog: "Cycle length: 28 days. Mild pain logged on Day 2. PCOS educational guidance bookmarked.",
    },
    {
      id: "u-[#103]",
      name: "Chloe Smith",
      email: "chloe@example.co.uk",
      country: "GB",
      flag: "🇬🇧",
      status: "ACTIVE",
      verification: "VERIFIED",
      trackingMode: "CYCLE_TRACKING",
      pregnancyWeek: null,
      joinedDate: "2026-07-02",
      lastActive: "3 hours ago",
      sensitiveLog: "Cycle length: 30 days. Basal body temperature tracking active.",
    },
    {
      id: "u-104",
      name: "Grace Asante",
      email: "grace@example.com.gh",
      country: "GH",
      flag: "🇬🇭",
      status: "UNDER_REVIEW",
      verification: "PENDING",
      trackingMode: "PREGNANCY",
      pregnancyWeek: 14,
      joinedDate: "2026-07-14",
      lastActive: "Today at 09:12 AM",
      sensitiveLog: "Trimester 2 setup completed. Data export JSON requested.",
    },
    {
      id: "u-105",
      name: "Sarah Miller",
      email: "sarah@example.com",
      country: "US",
      flag: "🇺🇸",
      status: "SUSPENDED",
      verification: "VERIFIED",
      trackingMode: "CYCLE_TRACKING",
      pregnancyWeek: null,
      joinedDate: "2026-04-01",
      lastActive: "12 days ago",
      sensitiveLog: "Account suspended due to policy violation in public comments.",
    },
  ]);

  const filteredUsers = users.filter((u) => {
    const matchesCountry = selectedCountry === "ALL" || u.country === selectedCountry;
    const matchesStatus = statusFilter === "ALL" || u.status === statusFilter;
    const matchesQuery =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCountry && matchesStatus && matchesQuery;
  });

  const toggleUserStatus = (id: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? { ...u, status: u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" }
          : u
      )
    );
  };

  const handleUnmaskSensitiveData = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unmaskReason) return;
    setSensitiveUnmasked(true);
    alert(`Audit Log Created: Admin unmasked sensitive health data for user ${selectedUser.id}. Reason: "${unmaskReason}"`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm">
        <div>
          <h2 className="text-2xl font-bold font-display text-[#17131D]">User Account Management</h2>
          <p className="text-xs text-[#6E6875]">Manage registered accounts, verification status, and NDPR/GDPR compliance requests.</p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#6E6875]" />
            <input
              type="text"
              placeholder="Search user by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] rounded-full text-xs font-medium focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] rounded-full text-xs font-bold text-[#17131D] focus:outline-none"
          >
            <option value="ALL">All Account Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-3xl border border-[#E7E2EB] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#F5F2FF]/60 border-b border-[#E7E2EB] text-[#6E6875] uppercase text-[10px] font-bold tracking-wider">
                <th className="py-4 px-4">User</th>
                <th className="py-4 px-4">Market</th>
                <th className="py-4 px-4">Tracking Goal</th>
                <th className="py-4 px-4">Account Status</th>
                <th className="py-4 px-4">Joined Date</th>
                <th className="py-4 px-4">Last Active</th>
                <th className="py-4 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E2EB]">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-[#F5F2FF]/30 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-[#17131D]">{u.name}</div>
                    <div className="text-[11px] text-[#6E6875]">{u.email}</div>
                  </td>

                  <td className="py-3.5 px-4 font-bold text-[#17131D]">
                    <span className="text-base mr-1">{u.flag}</span>
                    <span>{u.country}</span>
                  </td>

                  <td className="py-3.5 px-4 font-semibold text-[#6C4CF1]">
                    {u.trackingMode === "PREGNANCY" ? `Pregnancy (W${u.pregnancyWeek})` : "Cycle Tracker"}
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                        u.status === "ACTIVE"
                          ? "bg-emerald-50 text-[#238A5A] border border-emerald-200"
                          : u.status === "UNDER_REVIEW"
                          ? "bg-amber-50 text-[#B87512] border border-amber-200"
                          : "bg-red-50 text-[#C53D52] border border-red-200"
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-[#6E6875]">{u.joinedDate}</td>
                  <td className="py-3.5 px-4 text-[#6E6875]">{u.lastActive}</td>

                  <td className="py-3.5 px-4 text-right space-x-2">
                    <button
                      onClick={() => {
                        setSelectedUser(u);
                        setSensitiveUnmasked(false);
                        setUnmaskReason("");
                      }}
                      className="px-3 py-1.5 bg-[#F5F2FF] text-[#6C4CF1] hover:bg-[#6C4CF1] hover:text-white font-bold text-[11px] rounded-lg transition-colors"
                    >
                      Inspect Account
                    </button>
                    <button
                      onClick={() => toggleUserStatus(u.id)}
                      className={`px-3 py-1.5 font-bold text-[11px] rounded-lg transition-colors ${
                        u.status === "ACTIVE"
                          ? "bg-red-50 text-red-600 hover:bg-red-600 hover:text-white"
                          : "bg-emerald-50 text-[#238A5A] hover:bg-[#238A5A] hover:text-white"
                      }`}
                    >
                      {u.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Inspection Modal Drawer */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-xl space-y-6 shadow-2xl border border-[#E7E2EB]">
            <div className="flex justify-between items-center border-b border-[#E7E2EB] pb-3">
              <div>
                <h3 className="text-xl font-bold font-display text-[#17131D]">{selectedUser.name}</h3>
                <p className="text-xs text-[#6E6875]">{selectedUser.email} • {selectedUser.flag} {selectedUser.country} Market</p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="p-2 text-[#6E6875] hover:bg-[#F5F2FF] rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-[#F5F2FF] rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-[#6E6875] block">Account Status</span>
                  <span className="font-bold text-[#17131D]">{selectedUser.status}</span>
                </div>
                <div className="p-3 bg-[#F5F2FF] rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-[#6E6875] block">Tracking Mode</span>
                  <span className="font-bold text-[#6C4CF1]">{selectedUser.trackingMode}</span>
                </div>
              </div>

              {/* Sensitive Health Data Protection Block */}
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#6C4CF1]">
                  <Lock className="w-4 h-4" />
                  <span>Protected Sensitive Health Records (PRD 8.2 Compliance)</span>
                </div>

                {!sensitiveUnmasked ? (
                  <form onSubmit={handleUnmaskSensitiveData} className="space-y-2">
                    <p className="text-xs text-[#6E6875]">
                      Sensitive symptom logs and medical records are masked by default. To view sensitive records for support investigation, state an administrative reason:
                    </p>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Investigating Support Ticket #9910 regarding prediction discrepancy..."
                      value={unmaskReason}
                      onChange={(e) => setUnmaskReason(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-xs"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#6C4CF1] text-white font-bold text-xs rounded-xl shadow-md"
                    >
                      Unmask Records & Log Audit Event
                    </button>
                  </form>
                ) : (
                  <div className="p-3 bg-white rounded-xl border border-purple-200 text-xs font-mono space-y-1">
                    <span className="text-[10px] font-bold uppercase text-[#238A5A]">Audit Record #9920 Active</span>
                    <p className="text-[#17131D]">{selectedUser.sensitiveLog}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-[#E7E2EB] flex justify-end">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-6 py-2.5 bg-[#17131D] text-white text-xs font-bold rounded-full"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
