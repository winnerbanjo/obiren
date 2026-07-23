"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ShieldCheck, Heart, Zap, Globe } from "lucide-react";

export default function WhyObiren() {
  const diffPoints = [
    {
      title: "Built for African & Global Women",
      desc: "Local clinical research, culturally aware health guidance, and country-specific emergency contacts tailored for Nigeria 🇳🇬, Ghana 🇬🇭, the UK 🇬🇧, and the US 🇺🇸.",
    },
    {
      title: "Focused on Fibroids & PCOS",
      desc: "Fibroids affect up to 70% of African women by age 50. Obiren provides dedicated tracking, clinical guidance, and specialist access.",
    },
    {
      title: "Emergency Safety Included",
      desc: "Not just a period logger — Obiren integrates silent panic buttons, live GPS dispatch, and a verified emergency crisis directory.",
    },
    {
      title: "Zero Data Monetization",
      desc: "Your reproductive logs belong to you alone. Encrypted under 256-bit zero-knowledge architecture and protected by NDPR/GDPR regulations.",
    },
  ];

  return (
    <section id="why-obiren" className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Text & Values */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-6 space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white text-[#6D4AFF] rounded-full text-xs font-bold uppercase tracking-wider border border-[#E8DFFF]">
              <Heart className="w-3.5 h-3.5 fill-[#6D4AFF]" /> Reimagining Care
            </div>
            
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#171717] font-display tracking-tight leading-tight">
              Women&apos;s health <span className="purple-gradient-text">deserves better.</span>
            </h2>

            <p className="text-base text-[#666666] leading-relaxed">
              For too long, women have had to use fragmented tools — one app for period logging, another for pregnancy, with zero safety integration or privacy guarantees. Obiren unites everything into one trustworthy, empowering system.
            </p>

            <div className="space-y-4 pt-2">
              {diffPoints.map((pt, idx) => (
                <div key={idx} className="flex items-start gap-3 p-4 bg-[#F4F1FF]/50 rounded-2xl border border-[#E8DFFF]">
                  <CheckCircle2 className="w-5 h-5 text-[#38B26C] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-[#171717]">{pt.title}</h3>
                    <p className="text-xs text-[#666666] leading-relaxed">{pt.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right Visual Comparison Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-6 flex justify-center"
          >
            <div className="w-full max-w-md bg-[#2B2142] text-white rounded-[36px] p-8 shadow-2xl space-y-6 border border-purple-900/50">
              <div className="space-y-2 text-center border-b border-white/10 pb-4">
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#9B6BFF] bg-white/10 px-3 py-1 rounded-full">
                  The Obiren Advantage
                </span>
                <h3 className="text-2xl font-extrabold font-display text-white">All-In-One Protection</h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-white/10 rounded-2xl flex justify-between items-center">
                  <span className="font-semibold">Cycle & Symptom Tracking</span>
                  <span className="font-bold text-emerald-400">Included</span>
                </div>
                <div className="p-3 bg-white/10 rounded-2xl flex justify-between items-center">
                  <span className="font-semibold">Maternal Kick & Contraction Tools</span>
                  <span className="font-bold text-emerald-400">Included</span>
                </div>
                <div className="p-3 bg-white/10 rounded-2xl flex justify-between items-center">
                  <span className="font-semibold">Silent Web SOS Panic Dispatch</span>
                  <span className="font-bold text-emerald-400">Included</span>
                </div>
                <div className="p-3 bg-white/10 rounded-2xl flex justify-between items-center">
                  <span className="font-semibold">Encrypted Health Vault</span>
                  <span className="font-bold text-emerald-400">Included</span>
                </div>
                <div className="p-3 bg-white/10 rounded-2xl flex justify-between items-center">
                  <span className="font-semibold">Zero Data Selling Guarantee</span>
                  <span className="font-bold text-emerald-400">Enforced</span>
                </div>
              </div>
            </div>
          </motion.div>

        </div>

      </div>
    </section>
  );
}
