"use client";

import { motion } from "framer-motion";
import { Building2, Shield, HeartPulse, Heart, Award } from "lucide-react";

export default function SocialProof() {
  const partners = [
    { name: "NHS Women's Health Network", type: "Healthcare Provider", icon: HeartPulse },
    { name: "Global Women Safety Org", type: "Women's Organization", icon: Shield },
    { name: "St. Jude Women's Hospital", type: "Hospital Partner", icon: Building2 },
    { name: "African Maternal Care Initiative", type: "Community Partner", icon: Heart },
    { name: "Apex Gynecological Alliance", type: "Medical Specialist", icon: Award },
  ];

  return (
    <section className="py-12 bg-[#F4F1FF]/50 border-y border-[#E8DFFF]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-2 mb-8">
          <p className="text-xs uppercase font-bold tracking-widest text-[#6D4AFF]">
            Trust & Partnership
          </p>
          <h3 className="text-sm sm:text-base font-semibold text-[#171717]">
            Built with insights from leading maternal specialists and advocacy organizations across UK, US, Nigeria & Ghana
          </h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 items-center">
          {partners.map((p, idx) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                className="p-4 bg-white rounded-2xl border border-[#E8DFFF] shadow-sm text-center space-y-2 flex flex-col items-center justify-center hover:border-[#6D4AFF] transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-[#F4F1FF] text-[#6D4AFF] flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#171717] leading-tight">{p.name}</p>
                  <p className="text-[10px] text-[#666666]">{p.type}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
