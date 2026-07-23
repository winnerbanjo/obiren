"use client";

import { motion } from "framer-motion";
import { Video, MessageSquare, CalendarCheck, FileText, HeartPulse, CheckCircle2, ShieldCheck } from "lucide-react";

interface HealthcareSectionProps {
  onOpenWaitlist: () => void;
}

export default function HealthcareSection({ onOpenWaitlist }: HealthcareSectionProps) {
  const healthcareFeatures = [
    {
      title: "Video Consultations",
      desc: "HD private video sessions with board-certified gynecologists and maternal care experts.",
      icon: Video,
      badge: "HD Telehealth",
    },
    {
      title: "Secure Messaging",
      desc: "Direct encrypted chat with your care team for quick questions and prescription renewals.",
      icon: MessageSquare,
      badge: "Encrypted Chat",
    },
    {
      title: "Appointment Booking",
      desc: "Schedule in-person hospital visits or virtual consultations based on your calendar.",
      icon: CalendarCheck,
      badge: "Instant Confirmation",
    },
    {
      title: "Digital Prescriptions",
      desc: "Receive e-prescriptions directly sent to your preferred pharmacy or doorstep delivery partner.",
      icon: FileText,
      badge: "Direct Delivery",
    },
    {
      title: "Follow-up Care",
      desc: "Continuous post-consultation tracking, lab test reviews, and personalized advice.",
      icon: HeartPulse,
      badge: "Holistic Care",
    },
  ];

  return (
    <section id="healthcare" className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#F4F1FF] text-[#6D4AFF] rounded-full text-xs font-bold uppercase tracking-wider border border-[#E8DFFF]">
            <ShieldCheck className="w-4 h-4 text-[#38B26C]" /> Licensed & Verified Specialists
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#171717] font-display tracking-tight">
            Healthcare you can <span className="purple-gradient-text">trust.</span>
          </h2>
          <p className="text-base sm:text-lg text-[#666666] leading-relaxed">
            Connect with verified gynecologists and women&apos;s health professionals whenever you need expert advice—no long wait times, no judgment.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {healthcareFeatures.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="p-8 bg-white rounded-3xl border border-[#E8DFFF] shadow-lg shadow-[#6D4AFF]/5 hover:shadow-xl hover:border-[#6D4AFF]/40 transition-all space-y-4 group"
              >
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-[#F4F1FF] text-[#6D4AFF] group-hover:bg-[#6D4AFF] group-hover:text-white transition-colors flex items-center justify-center">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold text-[#6D4AFF] bg-[#F4F1FF] px-2.5 py-1 rounded-full">
                    {item.badge}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-[#171717] font-display">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[#666666] leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <div className="pt-2 flex items-center gap-2 text-xs font-semibold text-[#38B26C]">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Licensed Practitioners Only</span>
                </div>
              </motion.div>
            );
          })}

          {/* Doctor Guarantee Card */}
          <div className="p-8 bg-gradient-to-br from-[#6D4AFF] to-[#9B6BFF] text-white rounded-3xl shadow-xl flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <span className="text-xs uppercase font-bold tracking-widest text-white/80 bg-white/20 px-3 py-1 rounded-full">
                Medical Quality Guarantee
              </span>
              <h3 className="text-2xl font-bold font-display">
                100% Vetted Medical Board
              </h3>
              <p className="text-xs text-white/90 leading-relaxed">
                Every gynecologist, midwife, and specialist on Obiren is thoroughly background-checked, credential-verified, and licensed by local medical boards in the UK, US, Nigeria, or Ghana.
              </p>
            </div>

            <button
              onClick={onOpenWaitlist}
              className="w-full py-3 bg-white text-[#6D4AFF] hover:bg-[#F4F1FF] font-bold text-xs rounded-xl shadow-md transition-colors"
            >
              Get Early Doctor Booking Access
            </button>
          </div>
        </div>

      </div>
    </section>
  );
}
