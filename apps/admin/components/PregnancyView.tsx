"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Baby,
  Heart,
  Clock,
  CheckCircle2,
  Calendar,
  Plus,
  Play,
  Pause,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Sun,
  Activity,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface PregnancyViewProps {
  userProfile: any;
}

export default function PregnancyView({ userProfile }: PregnancyViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"timeline" | "kick" | "contraction" | "checklist">("timeline");
  const [showClinicalDetails, setShowClinicalDetails] = useState(false);

  // Kick Counter State
  const [kickCount, setKickCount] = useState(12);

  // Contraction Timer State
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [contractions, setContractions] = useState<Array<{ duration: number; time: string }>>([
    { duration: 45, time: "02:15 PM" },
    { duration: 50, time: "02:28 PM" },
  ]);

  const toggleTimer = () => {
    if (timerRunning) {
      setTimerRunning(false);
      setContractions((prev) => [
        { duration: timerSeconds, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
        ...prev,
      ]);
      setTimerSeconds(0);
    } else {
      setTimerRunning(true);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-8 max-w-6xl mx-auto pb-6">
      
      {/* 1. MOBILE-OPTIMIZED HEADER & SEGMENT CONTROL */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-[#E7E2EB] shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-2xl font-bold font-display text-[#17131D]">Pregnancy Companion</h2>
            <p className="text-[11px] sm:text-xs text-[#6E6875]">Maternal tracking & tools.</p>
          </div>
          <span className="text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            W22 Active
          </span>
        </div>

        {/* Native Mobile Segmented Control */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-[#F5F2FF] rounded-xl text-[11px] sm:text-xs font-bold">
          {[
            { id: "timeline", label: "Timeline" },
            { id: "kick", label: "Kicks" },
            { id: "contraction", label: "Timer" },
            { id: "checklist", label: "Bag" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`py-2 rounded-lg transition-all text-center truncate ${
                activeSubTab === tab.id
                  ? "bg-[#6C4CF1] text-white shadow-sm"
                  : "text-[#6E6875] hover:text-[#6C4CF1]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. EXTREMELY CLEAN & UNCLUSTERED PREGNANCY HERO CARD */}
      <div className="bg-gradient-to-br from-[#21182F] via-[#2D1F45] to-[#21182F] text-white rounded-2xl sm:rounded-[36px] p-5 sm:p-10 shadow-xl space-y-5 border border-purple-900/40 relative overflow-hidden">
        
        {/* Subtle Ambient Light Glow */}
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-[#6C4CF1]/20 rounded-full blur-2xl pointer-events-none" />

        {/* Main Status & Due Date Pill */}
        <div className="flex items-center justify-between text-[11px] sm:text-xs relative z-10">
          <span className="font-bold uppercase tracking-wider text-[#9B6BFF] bg-white/10 px-3 py-1 rounded-full border border-white/15">
            Trimester 2 • Week 22
          </span>
          <span className="text-white/80 font-medium">
            Due Dec 1 (<strong className="text-white">126d left</strong>)
          </span>
        </div>

        {/* Baby Size Visual Highlight */}
        <div className="space-y-1 relative z-10">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-2xl sm:text-4xl font-extrabold font-display leading-tight">
              Baby is a <span className="text-[#9B6BFF]">Papaya 🥭</span>
            </h3>
            <span className="text-xs text-white/70 font-medium">
              (~430g • 27.8 cm)
            </span>
          </div>
          
          <p className="text-xs text-white/80 leading-relaxed pt-1 hidden sm:block">
            Baby&apos;s hearing is now well-developed. They can recognize your voice, heartbeat, and surrounding sounds clearly.
          </p>
        </div>

        {/* Progress Bar (Compact & Clean) */}
        <div className="space-y-1.5 pt-1 relative z-10">
          <div className="flex justify-between text-[10px] sm:text-xs font-bold text-white/80">
            <span>W1</span>
            <span className="text-[#9B6BFF]">Week 22 (55% Complete)</span>
            <span>W40</span>
          </div>

          <div className="w-full bg-white/15 h-2.5 rounded-full p-0.5 overflow-hidden border border-white/10">
            <div className="bg-gradient-to-r from-[#6C4CF1] via-[#9B6BFF] to-emerald-400 h-full w-[55%] rounded-full shadow-sm" />
          </div>
        </div>

        {/* Mobile Micro 2-Column Grid (Saves Screen Height) */}
        <div className="grid grid-cols-2 gap-2.5 pt-2 relative z-10">
          <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/15 space-y-0.5">
            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-[#9B6BFF] block">Today&apos;s Kicks</span>
            <p className="text-sm sm:text-lg font-black text-white">{kickCount} Logged</p>
          </div>

          <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/15 space-y-0.5">
            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-[#9B6BFF] block">Next Visit</span>
            <p className="text-xs sm:text-sm font-bold text-white truncate">Aug 14 (Dr. Bello)</p>
          </div>
        </div>

        {/* Collapsible Clinical Guidance Accordion for Mobile */}
        <div className="pt-1 sm:hidden relative z-10">
          <button
            onClick={() => setShowClinicalDetails(!showClinicalDetails)}
            className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[11px] font-bold text-[#9B6BFF] flex items-center justify-center gap-1.5 transition-colors border border-white/10"
          >
            <span>{showClinicalDetails ? "Hide Development Notes" : "View Baby Hearing & Development Notes"}</span>
            {showClinicalDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showClinicalDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="pt-2 text-xs text-white/80 leading-relaxed border-t border-white/10 mt-2 space-y-1"
            >
              <p>Baby&apos;s hearing is now well-developed. They can recognize your voice, heartbeat, and surrounding sounds clearly.</p>
              <p className="text-[10px] text-[#9B6BFF]">Tip: Soft talking and soothing music are recommended.</p>
            </motion.div>
          )}
        </div>

      </div>

      {/* 3. DYNAMIC SUB-TAB VIEWS (CLEAN & SPACIOUS) */}
      {activeSubTab === "timeline" && (
        <div className="bg-white p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-[#E7E2EB] shadow-sm space-y-4">
          <h3 className="text-base sm:text-lg font-bold font-display text-[#17131D]">Weekly Development Timeline</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="p-4 bg-[#F5F2FF] rounded-xl sm:rounded-2xl border border-[#E8E0FF] space-y-1.5">
              <span className="text-[11px] font-bold text-[#6C4CF1] uppercase tracking-wider block">Mother&apos;s Body Changes</span>
              <p className="text-xs text-[#6E6875] leading-relaxed">
                You may experience mild backaches as your center of gravity shifts. Mild swelling in feet is common.
              </p>
            </div>

            <div className="p-4 bg-[#F5F2FF] rounded-xl sm:rounded-2xl border border-[#E8E0FF] space-y-1.5">
              <span className="text-[11px] font-bold text-[#6C4CF1] uppercase tracking-wider block">Prenatal Nutrition Guide</span>
              <p className="text-xs text-[#6E6875] leading-relaxed">
                Ensure adequate iron and calcium intake. Include dark leafy greens, beans, and fortified dairy or plant milk.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "kick" && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-[#E7E2EB] shadow-sm text-center space-y-5 max-w-md mx-auto">
          <h3 className="text-lg sm:text-xl font-bold font-display text-[#17131D]">Fetal Movement Kick Counter</h3>
          <p className="text-xs text-[#6E6875]">Tap button when you feel baby kick or roll.</p>

          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-[#F5F2FF] text-[#6C4CF1] border-4 border-[#E8E0FF] flex flex-col items-center justify-center mx-auto shadow-inner">
            <span className="text-3xl sm:text-4xl font-black">{kickCount}</span>
            <span className="text-[10px] uppercase font-bold text-[#6E6875]">Kicks</span>
          </div>

          <div className="flex justify-center gap-3">
            <button
              onClick={() => setKickCount((c) => c + 1)}
              className="px-6 py-3 bg-[#6C4CF1] text-white font-bold text-xs sm:text-sm rounded-full shadow-md hover:bg-[#5B3DE0] transition-all"
            >
              + Log Kick
            </button>
            <button
              onClick={() => setKickCount(0)}
              className="p-3 bg-gray-100 text-[#6E6875] rounded-full hover:bg-gray-200 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {activeSubTab === "contraction" && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-[#E7E2EB] shadow-sm text-center space-y-5 max-w-md mx-auto">
          <h3 className="text-lg sm:text-xl font-bold font-display text-[#17131D]">Contraction Timer</h3>
          <p className="text-xs text-[#6E6875]">Track the duration and frequency of contractions.</p>

          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-[#21182F] text-white border-4 border-[#6C4CF1] flex flex-col items-center justify-center mx-auto shadow-xl">
            <span className="text-2xl sm:text-3xl font-black">{timerSeconds}s</span>
            <span className="text-[10px] uppercase text-white/70">Duration</span>
          </div>

          <button
            onClick={toggleTimer}
            className={`w-full py-3.5 text-white font-bold text-xs sm:text-sm rounded-full shadow-md flex items-center justify-center gap-2 ${
              timerRunning ? "bg-red-600 hover:bg-red-700" : "bg-[#6C4CF1] hover:bg-[#5B3DE0]"
            }`}
          >
            {timerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{timerRunning ? "Stop Contraction" : "Start Contraction"}</span>
          </button>

          {contractions.length > 0 && (
            <div className="text-left space-y-2 pt-3 border-t border-[#E7E2EB]">
              <p className="text-xs font-bold text-[#17131D]">Logged Contractions:</p>
              {contractions.map((c, i) => (
                <div key={i} className="flex justify-between text-xs p-2.5 bg-[#F5F2FF] rounded-xl border border-[#E8E0FF]">
                  <span>Duration: {c.duration}s</span>
                  <span className="text-[#6E6875] font-semibold">{c.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSubTab === "checklist" && (
        <div className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-[#E7E2EB] shadow-sm space-y-4">
          <h3 className="text-base sm:text-lg font-bold font-display text-[#17131D]">Hospital Bag Checklist</h3>
          <div className="space-y-2">
            {[
              "ID Card & Medical Records",
              "Comfortable Nursing Robe & Slippers",
              "Infant Going-Home Outfits & Swaddles",
              "Essential Toiletries & Lip Balm",
              "Phone Charger with Extra Long Cable",
            ].map((item, i) => (
              <label key={i} className="flex items-center gap-3 p-3 bg-[#F5F2FF]/60 rounded-xl border border-[#E8E0FF] cursor-pointer hover:bg-[#F5F2FF] transition-colors">
                <input type="checkbox" className="accent-[#6C4CF1] w-4 h-4 shrink-0" />
                <span className="text-xs font-bold text-[#17131D]">{item}</span>
              </label>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
