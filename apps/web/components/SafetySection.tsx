"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  Users,
  MapPin,
  PhoneCall,
  Radio,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Hospital,
  Building2,
  Lock,
  Search,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

interface SafetySectionProps {
  onOpenWaitlist: () => void;
}

export default function SafetySection({ onOpenWaitlist }: SafetySectionProps) {
  const [activeTab, setActiveTab] = useState<"circle" | "sos" | "directory">("sos");

  const safetyFeatures = [
    {
      id: "circle",
      title: "Trusted Circle Guardians",
      badge: "Up to 5 Contacts",
      icon: Users,
      desc: "Designate family members or close friends who receive live encrypted location pings and multi-channel SMS alerts during emergencies.",
    },
    {
      id: "sos",
      title: "Silent Web SOS Panic Button",
      badge: "3-Sec Hold Activation",
      icon: ShieldAlert,
      desc: "Hold button for 3 seconds to capture high-accuracy GPS coordinates and dispatch emergency notifications to your Trusted Circle.",
    },
    {
      id: "directory",
      title: "Geospatial Emergency Directory",
      badge: "Offline Resource Cache",
      icon: MapPin,
      desc: "Access verified emergency numbers for hospitals, police command, and women's crisis shelters across UK, US, Nigeria, and Ghana.",
    },
  ];

  return (
    <section id="safety" className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Section Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#F4F1FF] text-[#6D4AFF] rounded-full text-xs font-bold uppercase tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5 text-[#C53D52]" /> Safety & Protection Infrastructure
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#171717] font-display tracking-tight leading-tight">
            Safety that speaks <span className="purple-gradient-text">when you cannot.</span>
          </h2>

          <p className="text-base sm:text-lg text-[#666666] leading-relaxed">
            Obiren combines silent panic activation, live GPS tracking, and verified emergency directory resources to keep you protected in any situation.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {safetyFeatures.map((feat) => {
            const Icon = feat.icon;
            const isSelected = activeTab === feat.id;
            return (
              <motion.div
                key={feat.id}
                onClick={() => setActiveTab(feat.id as any)}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className={`p-8 rounded-3xl border transition-all cursor-pointer space-y-4 ${
                  isSelected
                    ? "bg-[#2B2142] text-white border-purple-900 shadow-xl"
                    : "bg-[#FBFAFD] text-[#171717] border-[#E8DFFF] hover:border-[#6D4AFF]"
                }`}
              >
                <div className="flex justify-between items-center text-xs">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isSelected ? "bg-[#6D4AFF] text-white" : "bg-[#F4F1FF] text-[#6D4AFF]"}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`font-bold px-2.5 py-0.5 rounded-full text-[10px] uppercase ${isSelected ? "bg-white/10 text-emerald-400" : "bg-[#F4F1FF] text-[#6D4AFF]"}`}>
                    {feat.badge}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-bold font-display">{feat.title}</h3>
                  <p className={`text-xs leading-relaxed ${isSelected ? "text-white/80" : "text-[#666666]"}`}>
                    {feat.desc}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Dynamic Display Demo Box */}
        <div className="bg-[#2B2142] text-white rounded-[32px] p-8 sm:p-12 shadow-2xl max-w-4xl mx-auto border border-purple-900/40">
          <AnimatePresence mode="wait">
            {activeTab === "circle" && (
              <motion.div
                key="circle"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center border-b border-white/10 pb-4">
                  <h4 className="text-lg font-bold font-display text-white">Trusted Circle Manager</h4>
                  <span className="text-xs text-emerald-400 font-bold">3 of 5 Contacts Active</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { name: "Khadijah Okafor", relation: "Mother", phone: "+234 803 123 4567" },
                    { name: "Chloe Vance", relation: "Sister", phone: "+44 7700 900077" },
                    { name: "Dr. Amina Bello", relation: "Doctor", phone: "+234 802 999 8877" },
                  ].map((c, i) => (
                    <div key={i} className="p-4 bg-white/10 rounded-2xl border border-white/10 space-y-1 text-xs">
                      <span className="font-bold text-white block">{c.name}</span>
                      <span className="text-[#9B6BFF] font-semibold">{c.relation}</span>
                      <p className="text-white/60 text-[10px] pt-1">{c.phone}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === "sos" && (
              <motion.div
                key="sos"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="text-center space-y-6 max-w-md mx-auto py-4"
              >
                <Radio className="w-12 h-12 text-[#C53D52] mx-auto animate-pulse" />
                <div className="space-y-2">
                  <h4 className="text-xl font-bold font-display text-white">Silent Emergency Panic Activation</h4>
                  <p className="text-xs text-white/70">
                    Captures 6.5244° N, 3.3792° E coordinates & sends high-priority SMS alerts to 3 Trusted Circle guardians.
                  </p>
                </div>
                <div className="p-3 bg-red-950/60 rounded-2xl border border-red-500/30 text-xs font-mono text-red-200">
                  Audit Log: Incident #9921 Active • Location Broadcast Enabled
                </div>
              </motion.div>
            )}

            {activeTab === "directory" && (
              <motion.div
                key="directory"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="flex justify-between items-center border-b border-white/10 pb-3">
                  <h4 className="text-base font-bold font-display text-white">Geospatial Emergency Directory (Verified)</h4>
                  <span className="text-xs text-white/70">Available Offline</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-white/10 rounded-2xl flex justify-between items-center">
                    <span>Grace Hospital Emergency Dept (Victoria Island)</span>
                    <span className="font-bold text-emerald-400">112 / 199</span>
                  </div>
                  <div className="p-3 bg-white/10 rounded-2xl flex justify-between items-center">
                    <span>Central Police Command Centre</span>
                    <span className="font-bold text-emerald-400">0800-999-999</span>
                  </div>
                  <div className="p-3 bg-white/10 rounded-2xl flex justify-between items-center">
                    <span>Women Crisis Shelter & Help Line</span>
                    <span className="font-bold text-emerald-400">0800-333-333</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Safety CTA */}
        <div className="text-center">
          <button
            onClick={onOpenWaitlist}
            className="px-8 py-3.5 bg-gradient-to-r from-[#6D4AFF] to-[#9B6BFF] hover:opacity-95 text-white font-semibold text-sm rounded-full shadow-lg shadow-[#6D4AFF]/40 transition-all inline-flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Protect Yourself & Your Loved Ones</span>
          </button>
        </div>

      </div>
    </section>
  );
}
