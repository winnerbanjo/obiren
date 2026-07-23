"use client";

import { ArrowRight } from "lucide-react";

interface EarlyAccessCTAProps {
  onOpenWaitlist?: () => void;
}

export default function EarlyAccessCTA({ onOpenWaitlist }: EarlyAccessCTAProps) {
  return (
    <section className="py-24 bg-white relative overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="bg-[#6D4AFF] rounded-[40px] p-10 sm:p-16 text-center text-white shadow-2xl relative overflow-hidden">
          {/* Decorative background blur */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#9B6BFF]/40 blur-[80px] rounded-full -translate-x-1/2 translate-y-1/2" />
          
          <div className="relative z-10 space-y-8">
            
            <h2 className="text-4xl sm:text-5xl font-extrabold font-display tracking-tight leading-tight">
              Join the early-access programme
            </h2>
            
            <p className="text-lg sm:text-xl text-white/90 max-w-2xl mx-auto leading-relaxed">
              Obiren is launching soon. Create your free account today to secure priority access to specialist consultations and early-member benefits.
            </p>
            
            <div className="pt-4 flex justify-center">
              <button
                onClick={() => onOpenWaitlist ? onOpenWaitlist() : window.location.href = "/"}
                className="px-8 py-4 bg-white text-[#6D4AFF] font-bold text-sm rounded-full shadow-xl hover:bg-[#F4F1FF] hover:scale-105 transition-all flex items-center gap-3 group"
              >
                <span>Create Free Account</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
