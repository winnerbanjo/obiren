"use client";

import { motion } from "framer-motion";
import {
  ShieldCheck,
  Heart,
  ArrowRight,
  ShieldAlert,
  Video,
  CalendarDays,
  Globe
} from "lucide-react";
import Link from "next/link";

interface HeroProps {
  onOpenWaitlist?: () => void;
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
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#F4F1FF] border border-[#E8DFFF] rounded-full text-xs font-semibold text-[#6D4AFF]">
              <ShieldCheck className="w-4 h-4 text-[#38B26C]" />
              <span>Nigeria’s integrated telegynecology and women’s-health platform</span>
            </div>

            {/* Main Headline */}
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-[#171717] font-display tracking-tight leading-[1.08]">
                Your gynecologist.<br />
                Your health journey.<br />
                <span className="purple-gradient-text">One private platform.</span>
              </h1>
              <p className="text-base sm:text-xl text-[#666666] max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
                Speak privately with qualified women’s-health professionals, track your cycle, follow your pregnancy and access personal safety tools through one connected experience.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <button
                onClick={() => onOpenWaitlist ? onOpenWaitlist() : window.location.href = "/"}
                className="w-full sm:w-auto px-8 py-4 bg-[#6D4AFF] hover:bg-[#5B3DE0] text-white font-bold text-sm rounded-full shadow-xl shadow-[#6D4AFF]/30 transition-all flex items-center justify-center gap-3 group"
              >
                <span>Create Your Free Account</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              
              <Link
                href="/features/consult"
                className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-[#F5F2FF] text-[#171717] font-bold text-sm rounded-full border border-[#E8DFFF] transition-all flex items-center justify-center gap-3"
              >
                <span>Find a Specialist</span>
              </Link>
            </div>

            {/* Trust Line */}
            <div className="pt-2">
              <p className="text-xs text-[#666666] flex items-center justify-center lg:justify-start gap-2">
                <Globe className="w-4 h-4 text-[#6D4AFF] shrink-0" />
                <span>
                  Launching first in Nigeria, with Ghana, the United Kingdom and the United States to follow.
                </span>
              </p>
            </div>
          </motion.div>

          {/* Right Column - Product Preview Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-5 flex justify-center"
          >
            <div className="w-full max-w-md bg-white rounded-[32px] p-6 shadow-2xl border border-[#E8DFFF] space-y-4 relative">
              <div className="flex justify-between items-center border-b border-[#F4F1FF] pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#6D4AFF] text-white flex items-center justify-center font-bold text-xs">
                    <Heart className="w-4 h-4 fill-white/20" />
                  </div>
                  <span className="font-bold text-sm text-[#171717]">Your Obiren Health Overview</span>
                </div>
              </div>

              {/* Cycle Card */}
              <div className="p-4 bg-[#F4F1FF] rounded-2xl border border-[#E8DFFF] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[#6D4AFF] flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> Cycle forecast</span>
                  <span className="text-[#666666] font-semibold bg-white px-2 py-0.5 rounded-md border border-[#E8DFFF]">Day 14</span>
                </div>
                <p className="text-xs font-bold text-[#171717]">Your next period may begin between August 12 and August 15.</p>
                <p className="text-[10px] text-[#666666] font-semibold">Prediction confidence: High</p>
                <p className="text-[9px] text-[#888888] leading-tight">Predictions are estimates based on the information you record and should not be used as contraception or as a medical diagnosis.</p>
              </div>

              {/* Consultation Card */}
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-2">
                <div className="flex justify-between items-start text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-blue-700 flex items-center gap-1.5"><Video className="w-3.5 h-3.5" /> Upcoming consultation</span>
                    <p className="font-bold text-[#171717] text-sm pt-1">Dr. Ada Nwosu</p>
                    <p className="text-[10px] text-[#666666]">Consultant Obstetrician and Gynecologist</p>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <p className="text-xs font-bold text-[#171717]">Thursday, 10:30 AM</p>
                  <p className="text-[10px] text-blue-700 font-semibold bg-white px-2 py-1 rounded-md border border-blue-200">Private video consultation</p>
                </div>
              </div>

              {/* Safety Card */}
              <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 space-y-2">
                <div className="flex justify-between text-xs text-[#C53D52]">
                  <span className="font-bold flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5" /> Safety status</span>
                  <span className="font-bold bg-white px-2 py-0.5 rounded-md border border-rose-200">Trusted Circle ready</span>
                </div>
                <p className="text-xs font-bold text-[#171717]">4 trusted contacts added</p>
                <p className="text-[10px] text-[#666666]">Emergency alert settings active</p>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
