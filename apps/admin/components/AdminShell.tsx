"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  LayoutDashboard,
  Users,
  LifeBuoy,
  Bell,
  Calendar,
  Baby,
  Stethoscope,
  Clock,
  Video,
  ShieldAlert,
  Radio,
  UserCheck,
  BookOpen,
  FileCheck,
  CreditCard,
  RotateCcw,
  BarChart3,
  Globe,
  Flag,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  Lock,
  ChevronDown,
} from "lucide-react";

interface AdminShellProps {
  adminProfile: any;
  activeTab: string;
  onTabChange: (tab: string) => void;
  selectedCountry: string;
  onCountryChange: (country: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export default function AdminShell({
  adminProfile,
  activeTab,
  onTabChange,
  selectedCountry,
  onCountryChange,
  onLogout,
  children,
}: AdminShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const navGroups = [
    {
      group: "Operations",
      items: [
        { id: "overview", label: "Overview", icon: LayoutDashboard },
        { id: "users", label: "Users Management", icon: Users },
        { id: "support", label: "Support Tickets", icon: LifeBuoy },
        { id: "notifications", label: "Notifications", icon: Bell },
      ],
    },
    {
      group: "Health & Clinical",
      items: [
        { id: "health_tracking", label: "Health Config", icon: Calendar },
        { id: "pregnancy", label: "Pregnancy CMS", icon: Baby },
        { id: "professionals", label: "Doctors Verification", icon: Stethoscope },
        { id: "appointments", label: "Appointments", icon: Clock },
      ],
    },
    {
      group: "Safety & Emergency",
      items: [
        { id: "emergency_resources", label: "Emergency Resources", icon: ShieldAlert },
        { id: "safety_incidents", label: "Safety SOS Incidents", icon: Radio },
        { id: "trusted_circle", label: "Trusted Circle", icon: UserCheck },
      ],
    },
    {
      group: "Content & Medical",
      items: [
        { id: "knowledge", label: "Knowledge CMS", icon: BookOpen },
        { id: "medical_reviews", label: "Medical Reviews", icon: FileCheck },
      ],
    },
    {
      group: "Business & Finance",
      items: [
        { id: "payments", label: "Payments & Revenue", icon: CreditCard },
        { id: "refunds", label: "Refund Approvals", icon: RotateCcw },
      ],
    },
    {
      group: "Platform & Compliance",
      items: [
        { id: "countries", label: "Country Markets", icon: Globe },
        { id: "feature_flags", label: "Feature Flags", icon: Flag },
        { id: "audit_logs", label: "Audit Logs", icon: FileText },
        { id: "settings", label: "System Settings", icon: Settings },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#FBFAFD] text-[#17131D] flex flex-col md:flex-row font-sans selection:bg-[#E8E0FF] selection:text-[#6C4CF1]">
      
      {/* Desktop Grouped Navigation Sidebar */}
      <aside className="hidden md:flex flex-col justify-between w-64 bg-white border-r border-[#E7E2EB] p-5 shrink-0 h-screen sticky top-0 overflow-y-auto no-scrollbar">
        <div className="space-y-6">
          {/* Brand Header */}
          <button
            onClick={() => onTabChange("overview")}
            className="flex items-center gap-3 text-left w-full group"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#6C4CF1] to-[#9B6BFF] flex items-center justify-center text-white shadow-md shadow-[#6C4CF1]/20 group-hover:scale-105 transition-transform">
              <Heart className="w-5 h-5 fill-white/20" />
            </div>
            <div>
              <span className="text-lg font-bold font-display text-[#17131D]">Obiren Admin</span>
              <span className="block text-[10px] uppercase font-bold tracking-widest text-[#6C4CF1]">
                Control Centre v1.0
              </span>
            </div>
          </button>

          {/* Role Pill */}
          <div className="p-3 bg-[#F5F2FF] rounded-2xl border border-[#E8E0FF] text-xs">
            <span className="text-[10px] uppercase font-bold text-[#6E6875] block">Active Role</span>
            <span className="font-extrabold text-[#6C4CF1] truncate block">{adminProfile?.roleTitle || "Super Administrator"}</span>
          </div>

          {/* Grouped Nav Links */}
          <nav className="space-y-5">
            {navGroups.map((grp) => (
              <div key={grp.group} className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#6E6875] px-2">
                  {grp.group}
                </p>
                {grp.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onTabChange(item.id)}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 ${
                        isActive
                          ? "bg-[#6C4CF1] text-white shadow-md shadow-[#6C4CF1]/20"
                          : "text-[#6E6875] hover:bg-[#F5F2FF] hover:text-[#6C4CF1]"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Security & Logout Footer */}
        <div className="pt-4 border-t border-[#E7E2EB] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-[#6C4CF1] text-white font-bold text-xs flex items-center justify-center shrink-0">
                {adminProfile?.name?.[0] || "A"}
              </div>
              <div className="truncate text-xs">
                <p className="font-bold text-[#17131D] truncate">{adminProfile?.name || "Admin"}</p>
                <p className="text-[10px] text-[#6E6875]">2FA Active</p>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="p-1.5 text-[#6E6875] hover:text-red-600 rounded-lg hover:bg-red-50"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Operational Header Bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E7E2EB] px-4 sm:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-[#17131D] hover:bg-[#F5F2FF] rounded-xl"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div>
              <h1 className="text-base sm:text-xl font-bold font-display text-[#17131D] capitalize">
                {activeTab.replace("_", " ")} Command
              </h1>
              <p className="text-[11px] text-[#6E6875] hidden sm:block">
                Single Source of Operational Control across UK, US, Nigeria & Ghana
              </p>
            </div>
          </div>

          {/* Right Header Filters & Search */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Country Selector */}
            <div className="flex items-center gap-1.5 bg-[#F5F2FF] border border-[#E8E0FF] px-3 py-1.5 rounded-full text-xs font-bold text-[#17131D]">
              <Globe className="w-3.5 h-3.5 text-[#6C4CF1]" />
              <select
                value={selectedCountry}
                onChange={(e) => onCountryChange(e.target.value)}
                className="bg-transparent text-xs font-bold text-[#17131D] focus:outline-none cursor-pointer"
              >
                <option value="ALL">🌐 All Markets</option>
                <option value="GB">🇬🇧 United Kingdom</option>
                <option value="US">🇺🇸 United States</option>
                <option value="NG">🇳🇬 Nigeria</option>
                <option value="GH">🇬🇭 Ghana</option>
              </select>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-[#238A5A] rounded-full text-xs font-bold border border-emerald-200">
              <Lock className="w-3 h-3 text-[#238A5A]" />
              <span>Session Encrypted</span>
            </div>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-b border-[#E7E2EB] px-4 py-4 space-y-4 z-20 shadow-xl overflow-y-auto max-h-[80vh]"
            >
              {navGroups.map((grp) => (
                <div key={grp.group} className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6E6875]">
                    {grp.group}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {grp.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            onTabChange(item.id);
                            setMobileMenuOpen(false);
                          }}
                          className={`p-2.5 rounded-xl text-xs font-bold text-left flex items-center gap-2 ${
                            isActive ? "bg-[#6C4CF1] text-white" : "bg-[#F5F2FF] text-[#17131D]"
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Render View Child */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

    </div>
  );
}
