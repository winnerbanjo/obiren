"use client";

import { motion } from "framer-motion";
import {
  Zap,
  Globe,
  Smartphone,
  Stethoscope,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

interface FutureRoadmapProps {
  onOpenWaitlist: () => void;
}

export default function FutureRoadmap({ onOpenWaitlist }: FutureRoadmapProps) {
  const roadmapItems = [
    {
      title: "Telehealth & Telegynecology Consultation Engine",
      timeline: "Phase 2 • Q4 2026",
      desc: "Direct 1-on-1 video consultations with verified gynecologists, obstetricians, and maternal therapists across UK, US, Nigeria, and Ghana.",
      icon: Stethoscope,
      category: "Clinical Care",
    },
    {
      title: "Wearable Device Data Synchronization",
      timeline: "Phase 2 • Q1 2027",
      desc: "Automated Apple Watch, Fitbit, and Garmin sync for continuous basal body temperature, resting heart rate, and sleep duration logging.",
      icon: Smartphone,
      category: "Integrations",
    },
    {
      title: "Native iOS & Android Mobile Apps",
      timeline: "Phase 2 • Q1 2027",
      desc: "Dedicated native Swift and Kotlin applications built on the unified backend API, offline Mongoose cache, and background notification worker.",
      icon: Globe,
      category: "Mobile Native",
    },
  ];

  return (
    <section className="py-24 bg-[#FBFAFD] relative border-t border-[#E8DFFF]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#F4F1FF] text-[#6D4AFF] rounded-full text-xs font-bold uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5" /> Product Evolution
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#171717] font-display tracking-tight leading-tight">
            Anticipated <span className="purple-gradient-text">Feature Roadmap</span>
          </h2>

          <p className="text-base sm:text-lg text-[#666666] leading-relaxed">
            Obiren is built on an extensible monorepo architecture. Here is what is coming next to serve women across all launch markets.
          </p>
        </div>

        {/* Roadmap Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {roadmapItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
                className="bg-[#2B2142] text-white p-8 rounded-3xl shadow-xl border border-purple-900/40 space-y-6 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-[#9B6BFF] bg-white/10 px-3 py-1 rounded-full">
                      {item.category}
                    </span>
                    <span className="text-xs font-semibold text-emerald-400">
                      {item.timeline}
                    </span>
                  </div>

                  <div className="w-12 h-12 rounded-2xl bg-[#6D4AFF] text-white flex items-center justify-center shadow-md">
                    <Icon className="w-6 h-6" />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xl font-bold font-display text-white">
                      {item.title}
                    </h3>
                    <p className="text-xs text-white/70 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-1.5 text-[11px] font-bold text-[#9B6BFF]">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Planned Phase 2 Release</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Action Banner */}
        <div className="p-8 sm:p-12 bg-white rounded-3xl border border-[#E8DFFF] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6 max-w-4xl mx-auto">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-xl font-bold font-display text-[#171717]">Want early access to telegynecology beta testing?</h3>
            <p className="text-xs text-[#666666]">Join the waitlist to receive invitations to private beta testing rounds.</p>
          </div>

          <button
            onClick={onOpenWaitlist}
            className="px-6 py-3 bg-[#6D4AFF] hover:bg-[#5B3DE0] text-white font-bold text-xs rounded-full shadow-md transition-all shrink-0 flex items-center gap-2"
          >
            <span>Join Beta Waitlist</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </section>
  );
}
