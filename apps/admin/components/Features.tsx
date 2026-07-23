"use client";

import { motion } from "framer-motion";
import {
  Video,
  CalendarDays,
  Baby,
  BookOpen,
  FolderLock,
  ShieldAlert
} from "lucide-react";

export default function Features() {
  const ecosystemFeatures = [
    {
      icon: <Video className="w-6 h-6" />,
      title: "Virtual Gynecology",
      description: "Consult qualified women’s-health professionals through secure virtual appointments.",
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100"
    },
    {
      icon: <CalendarDays className="w-6 h-6" />,
      title: "Cycle and Symptom Tracking",
      description: "Record periods, symptoms, mood, pain, medication and personal notes while building a clearer picture of your cycle.",
      color: "text-[#6D4AFF]",
      bg: "bg-[#F4F1FF]",
      border: "border-[#E8DFFF]"
    },
    {
      icon: <Baby className="w-6 h-6" />,
      title: "Pregnancy Companion",
      description: "Follow your pregnancy week by week, record symptoms and prepare questions for your healthcare team.",
      color: "text-[#38B26C]",
      bg: "bg-emerald-50",
      border: "border-emerald-100"
    },
    {
      icon: <BookOpen className="w-6 h-6" />,
      title: "Women’s Health Library",
      description: "Read clear, culturally relevant health information reviewed by qualified professionals.",
      color: "text-orange-600",
      bg: "bg-orange-50",
      border: "border-orange-100"
    },
    {
      icon: <FolderLock className="w-6 h-6" />,
      title: "Private Health Vault",
      description: "Keep selected reports, prescriptions, scan results and important documents organised in one place.",
      color: "text-teal-600",
      bg: "bg-teal-50",
      border: "border-teal-100"
    },
    {
      icon: <ShieldAlert className="w-6 h-6" />,
      title: "Safety Centre",
      description: "Create a Trusted Circle and quickly alert the people you rely on during a personal emergency.",
      color: "text-[#C53D52]",
      bg: "bg-rose-50",
      border: "border-rose-100"
    }
  ];

  return (
    <section className="py-24 bg-white relative overflow-hidden" id="ecosystem">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        <div className="text-center max-w-3xl mx-auto space-y-6 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F4F1FF] border border-[#E8DFFF] rounded-full text-xs font-bold text-[#6D4AFF]">
            <span className="uppercase tracking-wider">The Obiren ecosystem</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-[#171717] font-display tracking-tight leading-tight">
            One connected home for your health and safety
          </h2>
          <p className="text-lg text-[#666666] leading-relaxed">
            Obiren is designed around the full reality of women’s lives—not a single symptom, cycle or stage.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ecosystemFeatures.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`p-8 rounded-[32px] border ${feature.border} bg-white shadow-lg shadow-black/5 flex flex-col items-start hover:shadow-xl transition-shadow`}
            >
              <div className={`w-14 h-14 rounded-2xl ${feature.bg} ${feature.color} flex items-center justify-center mb-6`}>
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-[#171717] mb-3">{feature.title}</h3>
              <p className="text-sm text-[#666666] leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
