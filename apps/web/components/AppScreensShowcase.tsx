"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Calendar,
  Baby,
  Stethoscope,
  Siren,
  FolderLock,
  Users,
  Bell,
  Activity,
  Heart,
  ChevronRight,
  ShieldAlert,
  Search,
  Plus,
} from "lucide-react";

export default function AppScreensShowcase() {
  const [activeScreen, setActiveScreen] = useState<
    "dashboard" | "cycle" | "pregnancy" | "doctor" | "emergency" | "vault" | "circle"
  >("dashboard");

  const screens = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, tag: "Main Overview" },
    { id: "cycle", label: "Cycle Tracking", icon: Calendar, tag: "Ovulation & Period" },
    { id: "pregnancy", label: "Pregnancy Companion", icon: Baby, tag: "Milestones & Guidance" },
    { id: "doctor", label: "Doctor Booking", icon: Stethoscope, tag: "Telehealth & Appointments" },
    { id: "emergency", label: "Emergency", icon: Siren, tag: "24/7 Silent SOS" },
    { id: "vault", label: "Health Vault", icon: FolderLock, tag: "Encrypted Records" },
    { id: "circle", label: "Trusted Circle", icon: Users, tag: "Live Safety Sharing" },
  ];

  return (
    <section className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto mb-12">
          <p className="text-xs uppercase font-bold tracking-widest text-[#6D4AFF]">
            Product Experience
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#171717] font-display tracking-tight">
            Designed to feel <span className="purple-gradient-text">effortless.</span>
          </h2>
          <p className="text-base sm:text-lg text-[#666666] leading-relaxed">
            Clean typography, intuitive navigation, and reassuring color choices make Obiren a joy to use every single day.
          </p>
        </div>

        {/* Tab Buttons for 7 screens */}
        <div className="flex items-center justify-start md:justify-center gap-2 overflow-x-auto pb-4 mb-10 no-scrollbar">
          {screens.map((s) => {
            const Icon = s.icon;
            const isActive = activeScreen === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveScreen(s.id as any)}
                className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                  isActive
                    ? "bg-[#6D4AFF] text-white shadow-lg shadow-[#6D4AFF]/30 scale-105"
                    : "bg-[#F4F1FF] text-[#666666] hover:bg-[#E8DFFF] hover:text-[#6D4AFF]"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Simulator Showcase Frame */}
        <div className="max-w-4xl mx-auto bg-[#F4F1FF]/60 rounded-3xl p-6 sm:p-12 border border-[#E8DFFF] shadow-xl flex flex-col lg:flex-row items-center gap-10">
          
          {/* 3D iPhone Display */}
          <div className="w-[300px] h-[580px] bg-[#171717] rounded-[48px] p-3 shadow-2xl shadow-[#6D4AFF]/25 border-4 border-[#2B2142] ring-1 ring-white/20 relative shrink-0">
            {/* Notch */}
            <div className="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-30 flex items-center justify-end px-3">
              <div className="w-2.5 h-2.5 bg-blue-900/60 rounded-full" />
            </div>

            {/* Screen Content Container */}
            <div className="w-full h-full bg-[#FFFFFF] rounded-[38px] overflow-hidden flex flex-col justify-between pt-10 pb-4 px-4 relative border border-white">
              {/* Dynamic Content Switching */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeScreen}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-3.5 flex-1 overflow-y-auto pt-1 no-scrollbar text-left"
                >
                  {/* Top Bar */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-[#666666] font-medium uppercase tracking-wider">Obiren Health</p>
                      <h4 className="text-base font-extrabold text-[#171717] capitalize">{activeScreen} Screen</h4>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#F4F1FF] text-[#6D4AFF] flex items-center justify-center">
                      <Bell className="w-4 h-4" />
                    </div>
                  </div>

                  {/* 1. Dashboard View */}
                  {activeScreen === "dashboard" && (
                    <div className="space-y-3">
                      <div className="p-3 bg-gradient-to-r from-[#6D4AFF] to-[#9B6BFF] text-white rounded-2xl space-y-1">
                        <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded-full font-bold">Good Health</span>
                        <p className="text-sm font-bold">Cycle Status: Regular</p>
                        <p className="text-[10px] text-white/80">Next period in 12 days • High energy level</p>
                      </div>

                      <div className="p-3 bg-[#F4F1FF] rounded-2xl space-y-1.5 border border-[#E8DFFF]">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-[#171717]">Daily Checklist</span>
                          <span className="text-[#6D4AFF] text-[10px] font-bold">2 of 3 Done</span>
                        </div>
                        <div className="space-y-1 text-[11px] text-[#666666]">
                          <p className="flex items-center gap-1.5"><span className="text-[#38B26C]">✓</span> Log Hydration (2.5L)</p>
                          <p className="flex items-center gap-1.5"><span className="text-[#38B26C]">✓</span> Take Prenatal Vitamin</p>
                          <p className="flex items-center gap-1.5"><span className="text-[#666666]">○</span> Evening 10-Min Meditation</p>
                        </div>
                      </div>

                      <div className="p-3 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-red-700 font-bold">
                          <ShieldAlert className="w-4 h-4 text-red-500" />
                          <span>Silent SOS Mode</span>
                        </div>
                        <span className="text-[9px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">Ready</span>
                      </div>
                    </div>
                  )}

                  {/* 2. Cycle View */}
                  {activeScreen === "cycle" && (
                    <div className="space-y-3">
                      <div className="p-3.5 bg-white border border-[#E8DFFF] rounded-2xl text-center space-y-2">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#6D4AFF] to-[#9B6BFF] text-white flex flex-col items-center justify-center mx-auto shadow-md">
                          <span className="text-xs font-black">DAY</span>
                          <span className="text-xl font-black">14</span>
                        </div>
                        <p className="text-xs font-bold text-[#171717]">Ovulation Phase</p>
                        <p className="text-[10px] text-[#666666]">Chance of pregnancy is highest today</p>
                      </div>

                      <div className="p-3 bg-[#F4F1FF] rounded-2xl text-xs space-y-1">
                        <p className="font-bold text-[#6D4AFF]">Symptoms Logged:</p>
                        <div className="flex flex-wrap gap-1">
                          <span className="bg-white px-2 py-0.5 rounded-md text-[10px]">Mild Cramps</span>
                          <span className="bg-white px-2 py-0.5 rounded-md text-[10px]">High Energy</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. Pregnancy View */}
                  {activeScreen === "pregnancy" && (
                    <div className="space-y-3">
                      <div className="p-3 bg-[#2B2142] text-white rounded-2xl space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold">Week 22 • Trimester 2</span>
                          <span className="text-[#9B6BFF] text-[10px] font-semibold">126 Days Left</span>
                        </div>
                        <p className="text-xs text-white/90">Baby is as big as a Papaya 🥭 (~430g)</p>
                        <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-[#9B6BFF] h-full w-[55%]" />
                        </div>
                      </div>

                      <div className="p-3 bg-[#F4F1FF] rounded-2xl text-xs space-y-1.5 border border-[#E8DFFF]">
                        <p className="font-bold text-[#171717]">Weekly Tip</p>
                        <p className="text-[10px] text-[#666666]">Baby can now hear outside sounds clearly! Try playing gentle music.</p>
                      </div>
                    </div>
                  )}

                  {/* 4. Doctor View */}
                  {activeScreen === "doctor" && (
                    <div className="space-y-2.5">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#999999]" />
                        <input
                          disabled
                          placeholder="Search gynecologists near you..."
                          className="w-full pl-8 pr-3 py-1.5 bg-[#F4F1FF] text-[10px] rounded-xl border border-[#E8DFFF]"
                        />
                      </div>

                      <div className="p-2.5 bg-white border border-[#E8DFFF] rounded-xl flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-[#6D4AFF] text-white font-bold flex items-center justify-center text-[10px]">
                          DR
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-[#171717]">Dr. Sarah Jenkins</p>
                          <p className="text-[9px] text-[#666666]">Obstetrician • 12 yrs exp</p>
                        </div>
                        <span className="px-2 py-1 bg-[#6D4AFF] text-white text-[9px] font-bold rounded-lg">Book</span>
                      </div>
                    </div>
                  )}

                  {/* 5. Emergency View */}
                  {activeScreen === "emergency" && (
                    <div className="space-y-3 text-center">
                      <div className="p-4 bg-red-500 text-white rounded-2xl space-y-2 shadow-lg shadow-red-500/30">
                        <ShieldAlert className="w-8 h-8 mx-auto animate-pulse" />
                        <p className="text-sm font-black">EMERGENCY ASSISTANCE</p>
                        <p className="text-[10px] text-white/90">Hold SOS button for 3 sec or double-tap power button</p>
                      </div>
                      <div className="p-2.5 bg-[#F4F1FF] rounded-xl text-left text-xs space-y-1 border border-[#E8DFFF]">
                        <p className="font-bold text-[#171717]">Nearest Hospital:</p>
                        <p className="text-[10px] text-[#666666]">Grace Women&apos;s Hospital (0.6 km)</p>
                      </div>
                    </div>
                  )}

                  {/* 6. Health Vault View */}
                  {activeScreen === "vault" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#171717]">Stored Records (4)</span>
                        <Plus className="w-4 h-4 text-[#6D4AFF]" />
                      </div>
                      <div className="p-2.5 bg-white border border-[#E8DFFF] rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-[#171717]">Blood Test Results</p>
                          <p className="text-[9px] text-[#666666]">Encrypted PDF • July 2026</p>
                        </div>
                        <span className="text-[10px] text-[#6D4AFF] font-bold">View</span>
                      </div>
                      <div className="p-2.5 bg-white border border-[#E8DFFF] rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-[#171717]">Gynecology Prescription</p>
                          <p className="text-[9px] text-[#666666]">Digital Sign • Verified</p>
                        </div>
                        <span className="text-[10px] text-[#6D4AFF] font-bold">View</span>
                      </div>
                    </div>
                  )}

                  {/* 7. Trusted Circle View */}
                  {activeScreen === "circle" && (
                    <div className="space-y-3">
                      <div className="p-3 bg-[#38B26C]/10 border border-[#38B26C]/30 rounded-2xl text-xs space-y-1">
                        <p className="font-bold text-[#38B26C]">Safety Trail Active</p>
                        <p className="text-[10px] text-[#666666]">Sharing live location with 3 guardians</p>
                      </div>
                      <div className="space-y-2">
                        {["Mom (Primary Contact)", "Sister (Secondary)", "Dr. Amina"].map((name, i) => (
                          <div key={i} className="p-2 bg-white border border-[#E8DFFF] rounded-xl flex items-center justify-between text-xs">
                            <span className="font-semibold text-[#171717]">{name}</span>
                            <span className="w-2 h-2 rounded-full bg-[#38B26C]" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Phone Bottom Nav Bar */}
              <div className="pt-2 border-t border-gray-100 flex justify-around items-center text-[9px] text-[#666666]">
                <div className="flex flex-col items-center text-[#6D4AFF]"><Heart className="w-4 h-4" />Home</div>
                <div className="flex flex-col items-center"><Calendar className="w-4 h-4" />Cycle</div>
                <div className="flex flex-col items-center"><Siren className="w-4 h-4 text-red-500" />SOS</div>
                <div className="flex flex-col items-center"><FolderLock className="w-4 h-4" />Vault</div>
              </div>
            </div>
          </div>

          {/* Right Explanation Box */}
          <div className="flex-1 space-y-6 text-left">
            <div className="space-y-2">
              <span className="text-xs uppercase font-bold tracking-wider text-[#6D4AFF]">
                Feature Highlight
              </span>
              <h3 className="text-2xl sm:text-3xl font-bold text-[#171717] font-display">
                {screens.find((s) => s.id === activeScreen)?.label}
              </h3>
              <p className="text-sm sm:text-base text-[#666666] leading-relaxed">
                {activeScreen === "dashboard" && "Your personalized command center. Get immediate updates on cycle phase, daily health checklists, and quick access to emergency assistance."}
                {activeScreen === "cycle" && "Accurate ovulation and fertility forecasting backed by smart AI pattern recognition tailored to your unique biological rhythm."}
                {activeScreen === "pregnancy" && "Week-by-week baby development milestone tracking, prenatal care schedules, and symptom logs designed for expecting mothers."}
                {activeScreen === "doctor" && "Instant booking with licensed gynecologists and obstetricians across the UK, US, Nigeria, and Ghana without phone queues."}
                {activeScreen === "emergency" && "Silent SOS double-tap activation that silently dispatches your precise location to emergency services and your trusted circle."}
                {activeScreen === "vault" && "Keep all your medical records, prescriptions, ultrasound scans, and lab reports encrypted with zero risk of loss."}
                {activeScreen === "circle" && "Select up to 5 trusted friends and family members who receive real-time location pings whenever you request a safety trail."}
              </p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-[#E8DFFF] space-y-2">
              <p className="text-xs font-bold text-[#171717] flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-[#6D4AFF]" />
                <span>Localized for UK, US, Nigeria, and Ghana</span>
              </p>
              <p className="text-xs text-[#666666]">
                Obiren automatically adapts to local healthcare policies, currency formats, emergency hotlines, and medical regulatory standards.
              </p>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
