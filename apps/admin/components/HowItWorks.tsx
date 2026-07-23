"use client";

import { motion } from "framer-motion";
import { UserCircle, Activity, Stethoscope, Link as LinkIcon, ShieldCheck, ArrowRight } from "lucide-react";

interface HowItWorksProps {
  onOpenWaitlist?: () => void;
}

export default function HowItWorks({ onOpenWaitlist }: HowItWorksProps) {
  const steps = [
    {
      number: "01",
      title: "Create your private health profile",
      description: "Tell Obiren what stage of life you are in and select the tools you want to use. You control what information you provide.",
      icon: UserCircle,
      color: "bg-[#F4F1FF] text-[#6D4AFF]",
    },
    {
      number: "02",
      title: "Track what matters to you",
      description: "Record cycles, symptoms, pregnancy updates, medications, appointments and personal observations.",
      icon: Activity,
      color: "bg-[#F4F1FF] text-[#6D4AFF]",
    },
    {
      number: "03",
      title: "Speak with the right professional",
      description: "Find an appropriate specialist, choose an available time and attend your consultation virtually where clinically appropriate.",
      icon: Stethoscope,
      color: "bg-[#F4F1FF] text-[#6D4AFF]",
    },
    {
      number: "04",
      title: "Keep your journey connected",
      description: "Save consultation notes, organise documents, follow agreed next steps and return for follow-up support when needed.",
      icon: LinkIcon,
      color: "bg-[#F4F1FF] text-[#6D4AFF]",
    },
    {
      number: "05",
      title: "Activate personal safety tools",
      description: "Add trusted contacts and configure the information you want Obiren to share if you trigger an emergency alert.",
      icon: ShieldCheck,
      color: "bg-rose-50 text-rose-600",
    },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center space-y-4 max-w-2xl mx-auto mb-16">
          <p className="text-xs uppercase font-bold tracking-widest text-[#6D4AFF]">
            How Obiren Works
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#171717] font-display tracking-tight">
            Care starts with <span className="purple-gradient-text">understanding.</span>
          </h2>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="relative bg-white rounded-3xl p-6 border border-[#E8DFFF] shadow-lg shadow-[#6D4AFF]/5 hover:shadow-xl hover:border-[#6D4AFF]/40 transition-all flex flex-col group"
              >
                <div className="space-y-4 flex-grow">
                  {/* Step Badge & Icon */}
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-black font-display text-[#6D4AFF]/20 group-hover:text-[#6D4AFF] transition-colors">
                      {step.number}
                    </span>
                    <div className={`w-12 h-12 rounded-2xl ${step.color} flex items-center justify-center shadow-sm`}>
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-[#171717] leading-tight">
                      {step.title}
                    </h3>
                    <p className="text-xs text-[#666666] leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>

                <div className="pt-6">
                  <div className="w-full h-1 bg-[#F4F1FF] rounded-full overflow-hidden">
                    <div
                      className="bg-[#6D4AFF] h-full transition-all duration-500"
                      style={{ width: `${(idx + 1) * 20}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* CTA Banner */}
        <div className="mt-16 text-center">
          <button
            onClick={() => onOpenWaitlist ? onOpenWaitlist() : window.location.href = "/"}
            className="px-8 py-4 bg-[#6D4AFF] hover:bg-[#5B3DE0] text-white font-semibold text-sm rounded-full shadow-lg shadow-[#6D4AFF]/30 transition-all inline-flex items-center gap-2 hover:scale-[1.02]"
          >
            <span>Start Your Health Profile</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </section>
  );
}
