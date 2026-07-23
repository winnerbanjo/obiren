"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Baby,
  Stethoscope,
  ShieldAlert,
  FolderLock,
  BookOpen,
  Plus,
  ArrowRight,
  Heart,
  Activity,
  Sun,
  Lock,
  TrendingUp,
} from "lucide-react";
import { calculateCyclePrediction } from "@obiren/health-engine";

interface DashboardViewProps {
  userProfile: any;
  onNavigate: (tab: string) => void;
  onOpenDailyLog: () => void;
}

export default function DashboardView({
  userProfile,
  onNavigate,
  onOpenDailyLog,
}: DashboardViewProps) {
  const [activeCheckIn, setActiveCheckIn] = useState<string | null>(null);

  const prediction = calculateCyclePrediction({
    userId: userProfile?.email || "user_1",
    confirmedCycles: [
      { periodStartDate: "2026-07-01", periodEndDate: "2026-07-06", cycleLengthDays: 28 },
      { periodStartDate: "2026-06-03", periodEndDate: "2026-06-08", cycleLengthDays: 28 },
    ],
    statedAverageCycleLength: userProfile?.cycleLengthDays || 28,
  });

  const quickPills = [
    { label: "Pain Free", type: "pain", val: 0 },
    { label: "Mild Cramps", type: "pain", val: 2 },
    { label: "High Energy", type: "mood", val: 5 },
    { label: "Calm Mood", type: "mood", val: 4 },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 max-w-6xl mx-auto">
      
      {/* 1. HERO HERO CARD - Responsive glass gradient */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-gradient-to-br from-[#21182F] via-[#2F2148] to-[#21182F] text-white rounded-3xl sm:rounded-[36px] p-6 sm:p-10 shadow-2xl relative overflow-hidden border border-purple-900/40"
      >
        {/* Ambient lighting backdrop */}
        <div className="absolute top-0 right-0 w-72 sm:w-96 h-72 sm:h-96 bg-[#6C4CF1]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center relative z-10">
          
          {/* Left Column: Greeting & Summary */}
          <div className="lg:col-span-7 space-y-4 sm:space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#E8E0FF] border border-white/15">
              <Sun className="w-3.5 h-3.5 text-amber-300" />
              <span>Good Afternoon, {userProfile?.firstName || "Ella"}</span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold font-display leading-tight tracking-tight">
                {userProfile?.isPregnant ? "Week 22 of Pregnancy" : "Day 14 of your Cycle"}
              </h2>
              <p className="text-xs sm:text-base text-white/80 leading-relaxed font-normal max-w-xl mx-auto lg:mx-0">
                {userProfile?.isPregnant
                  ? "Baby is the size of a Papaya 🥭 (~430g). Hearing is well developed and movement is steady."
                  : "Estimated ovulation day. High chance of fertility today. Next period predicted Aug 12."}
              </p>
            </div>

            {/* Micro Interaction Quick Symptom Pills */}
            <div className="pt-2">
              <p className="text-[10px] sm:text-xs font-bold text-[#E8E0FF] uppercase tracking-wider mb-2">
                Quick Daily Check-in
              </p>
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
                {quickPills.map((pill) => (
                  <button
                    key={pill.label}
                    onClick={() => setActiveCheckIn(pill.label)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                      activeCheckIn === pill.label
                        ? "bg-[#6C4CF1] text-white border-white/40 shadow-md scale-105"
                        : "bg-white/10 text-white/80 border-white/15 hover:bg-white/20"
                    }`}
                  >
                    {activeCheckIn === pill.label ? "✓ " : ""}{pill.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="pt-3 flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start">
              <button
                onClick={onOpenDailyLog}
                className="w-full sm:w-auto px-6 py-3.5 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white text-xs font-bold rounded-full shadow-lg shadow-[#6C4CF1]/30 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Log Daily Symptoms & Mood</span>
              </button>

              <button
                onClick={() => onNavigate(userProfile?.isPregnant ? "pregnancy" : "cycle")}
                className="w-full sm:w-auto px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-full transition-all flex items-center justify-center gap-2 border border-white/15"
              >
                <span>View Full Forecast</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Column: Animated SVG Cycle Ring */}
          <div className="lg:col-span-5 flex justify-center py-2 sm:py-0">
            <div className="relative w-40 h-40 sm:w-52 sm:h-52 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="stroke-white/10 fill-none"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="stroke-[#6C4CF1] fill-none"
                  strokeWidth="8"
                  strokeDasharray="264"
                  strokeDashoffset="120"
                  strokeLinecap="round"
                />
              </svg>

              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-2xl sm:text-4xl font-black font-display text-white">
                  {userProfile?.isPregnant ? "W22" : "D14"}
                </span>
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#E8E0FF]">
                  {userProfile?.isPregnant ? "Trimester 2" : "Ovulation Day"}
                </span>
              </div>
            </div>
          </div>

        </div>
      </motion.div>

      {/* 2. CORE MODULES GRID - Responsive 1 to 3 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        
        {/* Cycle Card */}
        <div
          onClick={() => onNavigate("cycle")}
          className="bg-white p-5 sm:p-6 rounded-3xl border border-[#E7E2EB] shadow-sm hover:shadow-md transition-all cursor-pointer space-y-4 group"
        >
          <div className="flex justify-between items-center">
            <div className="w-10 h-10 rounded-2xl bg-[#F5F2FF] text-[#6C4CF1] flex items-center justify-center group-hover:bg-[#6C4CF1] group-hover:text-white transition-colors">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              High Confidence
            </span>
          </div>

          <div>
            <h3 className="text-base font-bold font-display text-[#17131D]">Period & Cycle Tracker</h3>
            <p className="text-xs text-[#6E6875] mt-1">
              Next period estimated: Aug 12 – Aug 15. Weighted algorithm active.
            </p>
          </div>

          <div className="pt-2 border-t border-[#E7E2EB] flex justify-between items-center text-xs font-bold text-[#6C4CF1]">
            <span>Open Cycle Tracker</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Pregnancy Card */}
        <div
          onClick={() => onNavigate("pregnancy")}
          className="bg-white p-5 sm:p-6 rounded-3xl border border-[#E7E2EB] shadow-sm hover:shadow-md transition-all cursor-pointer space-y-4 group"
        >
          <div className="flex justify-between items-center">
            <div className="w-10 h-10 rounded-2xl bg-[#F5F2FF] text-[#6C4CF1] flex items-center justify-center group-hover:bg-[#6C4CF1] group-hover:text-white transition-colors">
              <Baby className="w-5 h-5" />
            </div>
            <span className="text-[10px] uppercase font-bold text-[#6C4CF1] bg-[#F5F2FF] px-2.5 py-1 rounded-full border border-[#E8E0FF]">
              126 Days to Due Date
            </span>
          </div>

          <div>
            <h3 className="text-base font-bold font-display text-[#17131D]">Pregnancy Companion</h3>
            <p className="text-xs text-[#6E6875] mt-1">
              Kick Counter & Contraction Timer ready. Hospital bag checklist active.
            </p>
          </div>

          <div className="pt-2 border-t border-[#E7E2EB] flex justify-between items-center text-xs font-bold text-[#6C4CF1]">
            <span>Open Pregnancy Companion</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Safety & Web SOS Card */}
        <div
          onClick={() => onNavigate("safety")}
          className="bg-white p-5 sm:p-6 rounded-3xl border border-[#E7E2EB] shadow-sm hover:shadow-md transition-all cursor-pointer space-y-4 group"
        >
          <div className="flex justify-between items-center">
            <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-colors">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <span className="text-[10px] uppercase font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
              4 Guardians Active
            </span>
          </div>

          <div>
            <h3 className="text-base font-bold font-display text-[#17131D]">Safety Centre & Web SOS</h3>
            <p className="text-xs text-[#6E6875] mt-1">
              Silent panic button ready. Verified emergency numbers for {userProfile?.countryCode || "NG"}.
            </p>
          </div>

          <div className="pt-2 border-t border-[#E7E2EB] flex justify-between items-center text-xs font-bold text-red-600">
            <span>Open Safety Centre</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

      </div>

    </div>
  );
}
