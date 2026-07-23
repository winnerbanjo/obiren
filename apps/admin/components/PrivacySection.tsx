"use client";

import { motion } from "framer-motion";
import { Lock, Fingerprint, KeyRound, ShieldCheck, EyeOff, FileCheck } from "lucide-react";

export default function PrivacySection() {
  const privacyPillars = [
    {
      icon: Lock,
      title: "Zero Data Selling Guaranteed",
      desc: "Your personal health entries, daily symptom logs, and pregnancy records will NEVER be sold to third-party ad networks, insurance underwriters, or data brokers.",
    },
    {
      icon: KeyRound,
      title: "256-Bit End-to-End Encryption",
      desc: "Private notes and uploaded health vault documents are encrypted using zero-knowledge architecture. Only you hold the decryption keys.",
    },
    {
      icon: ShieldCheck,
      title: "NDPR & GDPR Compliance",
      desc: "Strict compliance with Nigeria Data Protection Regulation (NDPR) and UK/EU GDPR. Request automated machine-readable data export (JSON) or full account purge anytime.",
    },
  ];

  return (
    <section id="privacy" className="py-24 bg-[#FBFAFD] relative border-t border-[#E8DFFF]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#F4F1FF] text-[#6D4AFF] rounded-full text-xs font-bold uppercase tracking-wider">
            <Lock className="w-3.5 h-3.5" /> Privacy First Principles
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#171717] font-display tracking-tight leading-tight">
            Your health data is <span className="purple-gradient-text">yours alone.</span>
          </h2>

          <p className="text-base sm:text-lg text-[#666666] leading-relaxed">
            We built Obiren on strict zero-knowledge encryption standards. You have complete ownership and control over your reproductive records.
          </p>
        </div>

        {/* 3 Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {privacyPillars.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
                className="bg-white p-8 rounded-3xl border border-[#E8DFFF] shadow-sm space-y-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#F4F1FF] text-[#6D4AFF] flex items-center justify-center shadow-inner">
                  <Icon className="w-6 h-6" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold font-display text-[#171717]">
                    {pillar.title}
                  </h3>
                  <p className="text-xs text-[#666666] leading-relaxed">
                    {pillar.desc}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Privacy Banner Note */}
        <div className="mt-12 p-4 bg-white rounded-2xl border border-[#E8DFFF] max-w-2xl mx-auto text-center text-xs text-[#666666] flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#6D4AFF] shrink-0" />
          <span>We will NEVER monetize, trade, or share your personal health insights with third-party advertisers.</span>
        </div>

      </div>
    </section>
  );
}
