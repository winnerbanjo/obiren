"use client";

import { motion } from "framer-motion";
import { UserCheck, ShieldCheck, Stethoscope, Lock } from "lucide-react";

export default function SocialProof() {
  const trustCards = [
    {
      icon: UserCheck,
      title: "Qualified Professionals",
      description: "Consultations will be conducted by verified healthcare professionals registered in your jurisdiction.",
    },
    {
      icon: Stethoscope,
      title: "Clinical Board",
      description: "Obiren’s features and health information are reviewed by an independent clinical advisory board.",
    },
    {
      icon: ShieldCheck,
      title: "Safety Partnerships",
      description: "We are establishing clear protocols with regional emergency services and women’s safety organisations.",
    },
    {
      icon: Lock,
      title: "Data Security",
      description: "We build to the standards required by international health data regulations, including HIPAA and GDPR.",
    }
  ];

  return (
    <section className="py-24 bg-white border-t border-[#E8DFFF] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto space-y-6 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F4F1FF] border border-[#E8DFFF] rounded-full text-xs font-bold text-[#6D4AFF]">
            <span className="uppercase tracking-wider">Clinical foundation</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-[#171717] font-display tracking-tight leading-tight">
            Trust must be earned
          </h2>
          <p className="text-lg text-[#666666] leading-relaxed bg-[#FBFAFD] p-6 rounded-2xl border border-[#E8DFFF]">
            We are currently building partnerships with leading maternal specialists, healthcare networks, advocacy organisations and clinical data institutions across Nigeria, Ghana, the UK and the US.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {trustCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="p-8 rounded-[32px] border border-[#E8DFFF] bg-white shadow-lg shadow-[#6D4AFF]/5 flex items-start gap-6 hover:shadow-xl hover:border-[#6D4AFF]/40 transition-all group"
              >
                <div className="w-14 h-14 rounded-2xl bg-[#F4F1FF] text-[#6D4AFF] flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Icon className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-[#171717]">{card.title}</h3>
                  <p className="text-sm text-[#666666] leading-relaxed">
                    {card.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
