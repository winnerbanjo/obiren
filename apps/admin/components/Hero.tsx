"use client";

import { motion } from "framer-motion";
import {
  ShieldCheck,
  Heart,
  ArrowRight,
  Lock,
  Globe,
  Bell,
  CheckCircle2,
  Calendar,
  Baby,
  ShieldAlert,
} from "lucide-react";

interface HeroProps {
  onOpenWaitlist: () => void;
}

export default function Hero({ onOpenWaitlist }: HeroProps) {
  return (
    <section className="relative pt-28 pb-20 overflow-hidden bg-gradient-to-b from-[#F4F1FF]/60 via-white to-white">
      {/* Ambient Lighting Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-tr from-[#E8DFFF]/40 to-[#6D4AFF]/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column - Copy & Conversion Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-7 text-center lg:text-left space-y-8"
          >
            {/* Trust Pill */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#F4F1FF] border border-[#E8DFFF] rounded-full text-xs font-semibold text-[#6D4AFF]">
              <ShieldCheck className="w-4 h-4 text-[#38B26C]" />
              <span>Launching in UK 🇬🇧, US 🇺🇸, Nigeria 🇳🇬, Ghana 🇬🇭</span>
            </div>

            {/* Main Headline */}
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-[#171717] font-display tracking-tight leading-[1.08]">
                Health. Safety. <br className="hidden sm:inline" />
                <span className="purple-gradient-text">Peace of Mind.</span>
              </h1>
              <p className="text-base sm:text-xl text-[#666666] max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
                Obiren (<span className="italic text-[#6D4AFF]">Woman</span>) is the all-in-one platform built to track your reproductive health, navigate pregnancy, consult specialists, and activate silent emergency SOS.
              </p>
            </div>

            {/* Quick Conversion CTA */}
            <div className="space-y-4 max-w-md mx-auto lg:mx-0">
              <button
                onClick={onOpenWaitlist}
                className="w-full sm:w-auto px-8 py-4 bg-[#6D4AFF] hover:bg-[#5B3DE0] text-white font-bold text-sm rounded-full shadow-xl shadow-[#6D4AFF]/30 transition-all flex items-center justify-center gap-3 group"
              >
                <span>Join the Early Access Waitlist</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <div className="pt-2">
                <p className="text-xs text-[#666666] flex items-center justify-center lg:justify-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#6D4AFF] shrink-0 mt-0.5" />
                  <span>
                    Be among the first women to experience Obiren. Early members receive priority access, exclusive updates, and early-launch benefits.
                  </span>
                </p>
              </div>
            </div>
          </motion.div>

          {/* Right Column - Product Preview Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-5 flex justify-center"
          >
            <div className="w-full max-w-md bg-white rounded-[32px] p-6 shadow-2xl border border-[#E8DFFF] space-y-6 relative">
              <div className="flex justify-between items-center border-b border-[#F4F1FF] pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#6D4AFF] text-white flex items-center justify-center font-bold text-xs">
                    <Heart className="w-4 h-4 fill-white/20" />
                  </div>
                  <span className="font-bold text-sm text-[#171717]">Obiren Ecosystem</span>
                </div>
                <span className="text-[10px] uppercase font-bold text-[#38B26C] bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  Privacy Active
                </span>
              </div>

              {/* Cycle Card */}
              <div className="p-4 bg-[#F4F1FF] rounded-2xl border border-[#E8DFFF] space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-[#6D4AFF]">Cycle Forecast</span>
                  <span className="text-[#666666]">Day 14</span>
                </div>
                <p className="text-xs font-bold text-[#171717]">Next period estimated: Aug 12 – Aug 15</p>
                <p className="text-[10px] text-[#666666]">Weighted algorithm calculation confidence: HIGH</p>
              </div>

              {/* Safety Card */}
              <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 space-y-2">
                <div className="flex justify-between text-xs text-[#C53D52]">
                  <span className="font-bold flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5" /> Silent SOS Ready</span>
                  <span className="font-bold">4 Guardians</span>
                </div>
                <p className="text-xs font-bold text-[#171717]">Live GPS alert dispatch enabled</p>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
