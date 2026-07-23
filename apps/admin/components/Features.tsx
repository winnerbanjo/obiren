"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Baby,
  Stethoscope,
  ShieldAlert,
  FolderLock,
  BookOpen,
  Users,
  Activity,
  Bell,
  Heart,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Radio,
  FileText,
  Clock,
  ArrowRight,
  Eye,
} from "lucide-react";

interface FeaturesProps {
  onOpenWaitlist: () => void;
}

export default function Features({ onOpenWaitlist }: FeaturesProps) {
  const [activeTab, setActiveTab] = useState("cycle");

  const modules = [
    {
      id: "cycle",
      title: "Period & Cycle Tracker",
      category: "Health Core",
      icon: Calendar,
      summary:
        "Comprehensive reproductive health tracking with calendar views, symptoms logging, and non-diagnostic prediction calculations.",
      highlights: [
        "Track cycle day, period dates, bleeding intensity, and pain scale",
        "12+ symptom options & 7+ mood trackers with private notes",
        "Weighted cycle length predictions with clear confidence ratings",
        "Fertility window estimations with strict medical disclaimers",
      ],
      badge: "Weighted Algorithm",
    },
    {
      id: "pregnancy",
      title: "Pregnancy Companion",
      category: "Maternal Care",
      icon: Baby,
      summary:
        "Week-by-week maternal timeline, fetal development milestones, and essential labor preparation tools.",
      highlights: [
        "Week 1 to 40 pregnancy timeline with baby size visual milestones",
        "Built-in fetal movement Kick Counter tool with history log",
        "Contraction Timer with duration & interval logging",
        "Hospital bag checklist and maternal nutrition guidelines",
      ],
      badge: "Week 1–40 Timeline",
    },
    {
      id: "safety",
      title: "Safety Centre & Web SOS",
      category: "Emergency & Rights",
      icon: ShieldAlert,
      summary:
        "Silent panic activation, live GPS location dispatch to trusted contacts, and verified local crisis directory.",
      highlights: [
        "Trusted Circle manager for up to 5 designated emergency contacts",
        "Web SOS flow with 3-second countdown & safety PIN cancellation",
        "Multi-channel alert dispatch (SMS, Push, WhatsApp & Email)",
        "Geospatial emergency directory for UK, US, Nigeria & Ghana",
      ],
      badge: "Silent Panic Dispatch",
    },
    {
      id: "knowledge",
      title: "Knowledge & Health Literacy",
      category: "Education",
      icon: BookOpen,
      summary:
        "Medically reviewed articles covering Fibroids, PCOS, Endometriosis, Postpartum Care, and Mental Wellness.",
      highlights: [
        "Articles authored & reviewed by qualified gynecologists and obstetricians",
        "Dedicated focus on Fibroids & PCOS affecting African women",
        "Filterable categories, estimated read times & clear source citations",
        "Strict medical disclaimers (does not replace clinical consultation)",
      ],
      badge: "Medically Reviewed",
    },
    {
      id: "vault",
      title: "Encrypted Health Vault",
      category: "Privacy & Data",
      icon: FolderLock,
      summary:
        "Zero-knowledge encrypted cloud repository for prescriptions, ultrasound scans, lab tests, and medical records.",
      highlights: [
        "Categorized upload for PDF, PNG, and JPEG health documents",
        "Signed URL access architecture (files encrypted with user keys)",
        "Temporary 24-hour doctor sharing links with automated expiry",
        "Full NDPR & GDPR compliant data export (JSON/ZIP) and deletion",
      ],
      badge: "256-Bit Encrypted",
    },
  ];

  const activeModuleData = modules.find((m) => m.id === activeTab) || modules[0];
  const ActiveIcon = activeModuleData.icon;

  return (
    <section id="features" className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#F4F1FF] text-[#6D4AFF] rounded-full text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" /> Full Product Specifications
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#171717] font-display tracking-tight leading-tight">
            Comprehensive care. <span className="purple-gradient-text">Unapologetically strong.</span>
          </h2>

          <p className="text-base sm:text-lg text-[#666666] leading-relaxed">
            Obiren combines all 10 core product modules into one empowering ecosystem so you never have to compromise on your health, safety, or privacy.
          </p>
        </div>

        {/* Interactive Module Tabs */}
        <div className="flex items-center justify-center gap-2 overflow-x-auto pb-4 no-scrollbar max-w-4xl mx-auto mb-8">
          {modules.map((m) => {
            const Icon = m.icon;
            const isActive = activeTab === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setActiveTab(m.id)}
                className={`px-5 py-3 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
                  isActive
                    ? "bg-[#6D4AFF] text-white shadow-lg shadow-[#6D4AFF]/20 scale-105"
                    : "bg-[#F4F1FF] text-[#666666] hover:bg-[#E8DFFF] hover:text-[#6D4AFF]"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{m.title}</span>
              </button>
            );
          })}
        </div>

        {/* Feature Display Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="bg-[#2B2142] text-white rounded-[32px] p-8 sm:p-12 shadow-2xl border border-purple-900/40 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-5xl mx-auto"
          >
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#9B6BFF] bg-white/10 px-3.5 py-1 rounded-full">
                  {activeModuleData.category}
                </span>
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/30">
                  {activeModuleData.badge}
                </span>
              </div>

              <div className="space-y-3">
                <h3 className="text-2xl sm:text-4xl font-extrabold font-display leading-snug">
                  {activeModuleData.title}
                </h3>
                <p className="text-sm sm:text-base text-white/80 leading-relaxed font-normal">
                  {activeModuleData.summary}
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {activeModuleData.highlights.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-xs text-white/90">
                    <CheckCircle2 className="w-4 h-4 text-[#9B6BFF] shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <button
                  onClick={onOpenWaitlist}
                  className="px-6 py-3 bg-[#6D4AFF] hover:bg-[#5B3DE0] text-white text-xs font-bold rounded-full transition-all flex items-center gap-2 shadow-md"
                >
                  <span>Request Early Access</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Right Graphical Box */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="w-full max-w-sm p-6 bg-white/10 backdrop-blur-xl rounded-3xl border border-white/15 space-y-4 shadow-inner">
                <div className="w-12 h-12 rounded-2xl bg-[#6D4AFF] text-white flex items-center justify-center shadow-md">
                  <ActiveIcon className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-bold font-display text-white">{activeModuleData.title}</h4>
                <p className="text-xs text-white/70 leading-relaxed">
                  Built to international clinical compliance standards (WCAG 2.2 AA, GDPR, NDPR).
                </p>
                <div className="pt-2 border-t border-white/10 flex justify-between items-center text-[10px] uppercase font-bold tracking-widest text-[#9B6BFF]">
                  <span>Status: Production-Ready</span>
                  <span>100% Encrypted</span>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

      </div>
    </section>
  );
}
