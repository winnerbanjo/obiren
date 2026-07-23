"use client";

import { ArrowRight, HeartPulse } from "lucide-react";
import Link from "next/link";

interface FinalCTAProps {
  onOpenWaitlist?: () => void;
}

export default function FinalCTA({ onOpenWaitlist }: FinalCTAProps) {
  return (
    <section className="py-24 bg-white relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#F4F1FF] text-[#6D4AFF]">
          <HeartPulse className="w-8 h-8" />
        </div>
        
        <h2 className="text-4xl sm:text-6xl font-extrabold text-[#171717] font-display tracking-tight leading-tight">
          Your health deserves <br className="hidden sm:inline" />
          <span className="purple-gradient-text">more than guesswork</span>
        </h2>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <button
            onClick={() => onOpenWaitlist ? onOpenWaitlist() : window.location.href = "/"}
            className="w-full sm:w-auto px-8 py-4 bg-[#6D4AFF] hover:bg-[#5B3DE0] text-white font-bold text-sm rounded-full shadow-xl shadow-[#6D4AFF]/30 transition-all flex items-center justify-center gap-3 group"
          >
            <span>Create Free Account</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          
          <Link
            href="/features/consult"
            className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-[#F5F2FF] text-[#171717] font-bold text-sm rounded-full border border-[#E8DFFF] transition-all flex items-center justify-center gap-3"
          >
            <span>Consult a Specialist</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
