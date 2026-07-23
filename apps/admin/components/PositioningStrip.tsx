"use client";

import { Activity } from "lucide-react";

export default function PositioningStrip() {
  return (
    <section className="py-20 bg-white border-b border-[#E8DFFF]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#F4F1FF] text-[#6D4AFF] mb-2">
          <Activity className="w-6 h-6" />
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-[#171717] font-display tracking-tight">
          More than a period tracker
        </h2>
        <p className="text-lg sm:text-xl text-[#6D4AFF] font-semibold max-w-2xl mx-auto">
          Obiren connects everyday health tracking with access to professional care.
        </p>
        <p className="text-base sm:text-lg text-[#666666] max-w-3xl mx-auto leading-relaxed">
          Track what you notice. Understand patterns over time. Speak to an appropriate specialist when you need guidance. Keep important records together and activate your personal safety network during an emergency.
        </p>
      </div>
    </section>
  );
}
