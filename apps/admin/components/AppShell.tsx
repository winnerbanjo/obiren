"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  LayoutDashboard,
  Calendar,
  Baby,
  BookOpen,
  ShieldAlert,
  Stethoscope,
  FolderLock,
  Bell,
  Settings,
  User as UserIcon,
  LogOut,
  Menu,
  X,
  Lock,
} from "lucide-react";

interface AppShellProps {
  userProfile: any;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export default function AppShell({
  userProfile,
  activeTab,
  onTabChange,
  onLogout,
  children,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const desktopNavItems = [
    { id: "dashboard", label: "Overview", icon: LayoutDashboard },
    { id: "cycle", label: "Cycle", icon: Calendar },
    { id: "pregnancy", label: "Pregnancy", icon: Baby },
    { id: "learn", label: "Learn", icon: BookOpen },
    { id: "safety", label: "Safety", icon: ShieldAlert },
    { id: "professionals", label: "Professionals", icon: Stethoscope },
    { id: "vault", label: "Health Vault", icon: FolderLock },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const mobileNavItems = [
    { id: "dashboard", label: "Home", icon: LayoutDashboard },
    { id: "cycle", label: "Cycle", icon: Calendar },
    { id: "learn", label: "Learn", icon: BookOpen },
    { id: "safety", label: "Safety", icon: ShieldAlert },
    { id: "settings", label: "Profile", icon: UserIcon },
  ];

  return (
    <div className="min-h-screen bg-[#FBFAFD] text-[#17131D] flex flex-col md:flex-row font-sans selection:bg-[#E8E0FF] selection:text-[#6C4CF1] overflow-x-hidden">
      
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden md:flex flex-col justify-between w-64 bg-white border-r border-[#E7E2EB] p-6 shrink-0 h-screen sticky top-0">
        <div className="space-y-8">
          {/* Brand Header */}
          <button
            onClick={() => onTabChange("dashboard")}
            className="flex items-center gap-3 text-left w-full group"
          >
            <div className="w-10 h-10 rounded-2xl bg-[#6C4CF1] flex items-center justify-center text-white shadow-md shadow-[#6C4CF1]/20 group-hover:scale-105 transition-transform">
              <Heart className="w-5 h-5 fill-white/20" />
            </div>
            <div>
              <span className="text-xl font-bold font-display text-[#17131D]">Obiren</span>
              <span className="block text-[10px] uppercase font-bold tracking-widest text-[#6E6875]">
                {userProfile?.countryCode || "NG"} Market
              </span>
            </div>
          </button>

          {/* Nav Items */}
          <nav className="space-y-1">
            {desktopNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-3 ${
                    isActive
                      ? "bg-[#6C4CF1] text-white shadow-md shadow-[#6C4CF1]/20"
                      : "text-[#6E6875] hover:bg-[#F5F2FF] hover:text-[#6C4CF1]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Info & Privacy Indicator */}
        <div className="space-y-4 pt-4 border-t border-[#E7E2EB]">
          <div className="p-3 bg-[#F5F2FF] rounded-2xl flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-[#6C4CF1] shrink-0" />
            <div className="text-[10px]">
              <p className="font-bold text-[#17131D]">256-Bit Encrypted</p>
              <p className="text-[#6E6875]">NDPR & GDPR Privacy Active</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#6C4CF1] text-white font-bold flex items-center justify-center text-xs shrink-0">
                {userProfile?.firstName?.[0] || "E"}
              </div>
              <div className="truncate text-xs">
                <p className="font-bold text-[#17131D] truncate">{userProfile?.firstName || "Ella"}</p>
                <p className="text-[10px] text-[#6E6875]">Member</p>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="p-2 text-[#6E6875] hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-24 md:pb-0">
        
        {/* Application Header Bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E7E2EB] px-3 sm:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Mobile Hamburger Drawer Trigger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-[#17131D] hover:bg-[#F5F2FF] rounded-xl active:bg-[#E8E0FF] transition-colors shrink-0"
              aria-label="Toggle navigation drawer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <button
              onClick={() => onTabChange("dashboard")}
              className="flex items-center gap-2 text-left min-w-0"
            >
              <div className="w-8 h-8 rounded-xl bg-[#6C4CF1] flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
                <Heart className="w-4 h-4 fill-white/20" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xs sm:text-lg font-bold font-display text-[#17131D] capitalize truncate">
                  {activeTab} Overview
                </h1>
                <p className="text-[10px] text-[#6E6875] hidden sm:block">
                  Private Women&apos;s Health & Safety Platform
                </p>
              </div>
            </button>
          </div>

          {/* Quick Actions & Notifications */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-[#238A5A] rounded-full text-[10px] sm:text-xs font-bold border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-[#238A5A] animate-pulse shrink-0" />
              <span className="hidden xs:inline">256-Bit Encrypted</span>
            </div>

            <button
              onClick={() => onTabChange("settings")}
              className="p-2 text-[#6E6875] hover:bg-[#F5F2FF] rounded-full transition-colors relative"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#6C4CF1] rounded-full" />
            </button>
          </div>
        </header>

        {/* Mobile Full Navigation Menu Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-b border-[#E7E2EB] px-4 py-4 space-y-3 z-20 shadow-xl overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-[#E7E2EB] pb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6875]">
                  Select Module
                </span>
                <span className="text-[10px] font-bold text-[#6C4CF1] bg-[#F5F2FF] px-2 py-0.5 rounded-md">
                  {userProfile?.countryCode || "NG"} Market
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {desktopNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onTabChange(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`p-3 rounded-2xl text-xs font-bold text-left flex items-center gap-2.5 transition-all ${
                        isActive
                          ? "bg-[#6C4CF1] text-white shadow-md shadow-[#6C4CF1]/20"
                          : "bg-[#F5F2FF] text-[#17131D] hover:bg-[#E8E0FF]"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-[#E7E2EB] flex justify-between items-center text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-[#6C4CF1] text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {userProfile?.firstName?.[0] || "E"}
                  </div>
                  <span className="font-bold text-[#17131D] truncate">
                    {userProfile?.firstName || "Ella"}
                  </span>
                </div>

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogout();
                  }}
                  className="px-3.5 py-1.5 bg-red-50 text-red-600 text-xs font-bold rounded-xl hover:bg-red-100 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Render Active View Child */}
        <main className="flex-1 p-3.5 sm:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Fixed Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-[#E7E2EB] px-2 py-2.5 flex justify-around items-center shadow-lg">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all ${
                isActive ? "text-[#6C4CF1] font-bold scale-105" : "text-[#6E6875]"
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-[10px] leading-none">{item.label}</span>
            </button>
          );
        })}
      </nav>

    </div>
  );
}
