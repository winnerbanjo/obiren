"use client";

import { motion } from "framer-motion";
import { UserPlus, Sliders, Activity, ShieldCheck, ArrowRight } from "lucide-react";

interface HowItWorksProps {
  onOpenWaitlist: () => void;
}

export default function HowItWorks({ onOpenWaitlist }: HowItWorksProps) {
  const steps = [
    {
      number: "01",
      title: "Create your account",
      description: "Sign up in under 60 seconds. Choose your country (UK, US, Nigeria, Ghana) for localized health standards and services.",
      icon: UserPlus,
      color: "bg-[#F4F1FF] text-[#6D4AFF]",
    },
    {
      number: "02",
      title: "Personalize your health profile",
      description: "Log your cycle history, pregnancy status, or wellness goals. Your data is encrypted immediately upon creation.",
      icon: Sliders,
      color: "bg-[#F4F1FF] text-[#6D4AFF]",
    },
    {
      number: "03",
      title: "Track your journey & access healthcare",
      description: "Receive AI cycle forecasts, pregnancy milestone guidance, or book 1-on-1 consultations with verified gynecologists.",
      icon: Activity,
      color: "bg-[#F4F1FF] text-[#6D4AFF]",
    },
    {
      number: "04",
      title: "Stay protected with Trusted Circle",
      description: "Add close family and friends to your circle, set up Silent SOS triggers, and gain peace of mind wherever you go.",
      icon: ShieldCheck,
      color: "bg-[#2B2142] text-white",
    },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center space-y-4 max-w-2xl mx-auto mb-16">
          <p className="text-xs uppercase font-bold tracking-widest text-[#6D4AFF]">
            Simple Onboarding
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#171717] font-display tracking-tight">
            Getting started is <span className="purple-gradient-text">simple.</span>
          </h2>
          <p className="text-base text-[#666666]">
            Designed with simplicity and clarity at every step, so you can focus on your well-being.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="relative bg-white rounded-3xl p-6 border border-[#E8DFFF] shadow-lg shadow-[#6D4AFF]/5 hover:shadow-xl hover:border-[#6D4AFF]/40 transition-all flex flex-col justify-between group"
              >
                <div className="space-y-4">
                  {/* Step Badge & Icon */}
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-black font-display text-[#6D4AFF]/30 group-hover:text-[#6D4AFF] transition-colors">
                      {step.number}
                    </span>
                    <div className={`w-12 h-12 rounded-2xl ${step.color} flex items-center justify-center shadow-sm`}>
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-[#171717] font-display">
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
                      style={{ width: `${(idx + 1) * 25}%` }}
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
            onClick={onOpenWaitlist}
            className="px-8 py-4 bg-[#6D4AFF] hover:bg-[#5B3BE3] text-white font-semibold text-sm rounded-full shadow-lg shadow-[#6D4AFF]/30 transition-all inline-flex items-center gap-2 hover:scale-[1.02]"
          >
            <span>Reserve Your Early Spot</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </section>
  );
}
