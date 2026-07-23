"use client";

import { motion } from "framer-motion";
import { Link2, HeartPulse, Globe, ShieldAlert, LockKeyhole } from "lucide-react";

export default function WhyObiren() {
  const points = [
    {
      icon: Link2,
      title: "One continuous record",
      description: "Bring your tracking history, appointments and documents into one organised experience.",
    },
    {
      icon: HeartPulse,
      title: "Care built around women",
      description: "The platform is designed specifically around reproductive, gynecological and maternal-health journeys.",
    },
    {
      icon: Globe,
      title: "Local context, global standards",
      description: "Obiren is being designed for women in Nigeria, Ghana, the United Kingdom and the United States, with country-specific providers, resources and emergency information.",
    },
    {
      icon: ShieldAlert,
      title: "Clear clinical boundaries",
      description: "Obiren provides tracking, education and access to professionals. It does not present automated predictions as diagnoses.",
    },
    {
      icon: LockKeyhole,
      title: "Privacy without vague promises",
      description: "We explain what is collected, why it is needed, where it is stored and how you can control it.",
    }
  ];

  return (
    <section className="py-24 bg-gradient-to-b from-white to-[#FBFAFD] relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 w-96 h-96 bg-[#F4F1FF] rounded-full blur-[100px] -z-10" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#FFF0F2] rounded-full blur-[120px] -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          
          {/* Left Column: Context */}
          <div className="lg:col-span-5 space-y-8 sticky top-32">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-[#E8DFFF] rounded-full text-xs font-bold text-[#6D4AFF] shadow-sm">
                <span className="uppercase tracking-wider">A different model for women’s health</span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-[#171717] font-display tracking-tight leading-tight">
                Women deserve more than disconnected tools
              </h2>
            </div>
            
            <div className="space-y-6 text-base sm:text-lg text-[#666666] leading-relaxed">
              <p>
                A period app may record dates but cannot connect you with a specialist.
              </p>
              <p>
                A telemedicine platform may provide a consultation but know nothing about the patterns you have been tracking.
              </p>
              <p>
                A safety application may send an alert but remain completely disconnected from your health journey.
              </p>
              <p className="font-semibold text-[#171717] bg-[#F4F1FF] p-4 rounded-xl border border-[#E8DFFF]">
                Obiren brings these experiences together while keeping clear boundaries between health information, clinical care and emergency support.
              </p>
            </div>
          </div>

          {/* Right Column: Values */}
          <div className="lg:col-span-7">
            <div className="grid grid-cols-1 gap-6">
              {points.map((point, idx) => {
                const Icon = point.icon;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.5, delay: idx * 0.1 }}
                    className="flex gap-6 p-6 sm:p-8 bg-white rounded-3xl border border-[#E8DFFF] shadow-lg shadow-[#6D4AFF]/5 hover:shadow-xl transition-all"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-[#F4F1FF] text-[#6D4AFF] flex items-center justify-center shrink-0">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-[#171717]">{point.title}</h3>
                      <p className="text-sm text-[#666666] leading-relaxed">
                        {point.description}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
