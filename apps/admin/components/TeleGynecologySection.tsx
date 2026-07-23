"use client";

import { Video, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function TeleGynecologySection() {
  const supportTopics = [
    "Menstrual irregularities",
    "Painful or heavy periods",
    "Fibroid-related concerns",
    "PCOS support",
    "Endometriosis-related symptoms",
    "Fertility and preconception questions",
    "Contraceptive counselling",
    "Vaginal and reproductive-health concerns",
    "Pregnancy and postpartum guidance",
    "Menopause and hormonal-health concerns",
    "Follow-up discussions after tests or treatment",
  ];

  return (
    <section className="py-24 bg-[#FBFAFD]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          
          {/* Left Column: Copy */}
          <div className="space-y-8">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-[#E8DFFF] rounded-full text-xs font-bold text-[#6D4AFF] shadow-sm">
                <Video className="w-3.5 h-3.5" />
                <span className="uppercase tracking-wider">Virtual women’s healthcare</span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-[#171717] font-display tracking-tight leading-tight">
                Specialist support, without beginning with a hospital queue
              </h2>
              <div className="space-y-4 text-base sm:text-lg text-[#666666] leading-relaxed">
                <p>
                  Women often postpone care because of distance, cost, work, childcare, long waiting times or the discomfort of discussing intimate concerns in an unfamiliar setting.
                </p>
                <p className="font-semibold text-[#171717]">
                  Obiren gives you a more private and convenient starting point.
                </p>
                <p>
                  Book virtual consultations with verified gynecologists and other qualified women’s-health professionals from your phone or computer.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
              <Link
                href="/features/consult"
                className="w-full sm:w-auto px-8 py-4 bg-[#6D4AFF] hover:bg-[#5B3DE0] text-white font-bold text-sm rounded-full shadow-xl shadow-[#6D4AFF]/30 transition-all flex items-center justify-center gap-3 group"
              >
                <span>Find a Specialist</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/features/virtual-care"
                className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-[#F5F2FF] text-[#171717] font-bold text-sm rounded-full border border-[#E8DFFF] transition-all flex items-center justify-center gap-3"
              >
                <span>How Virtual Care Works</span>
              </Link>
            </div>
          </div>

          {/* Right Column: Support List & Disclaimer */}
          <div className="space-y-8">
            <div className="bg-white p-8 sm:p-10 rounded-[32px] border border-[#E8DFFF] shadow-xl shadow-[#6D4AFF]/5">
              <h3 className="text-xl font-bold text-[#171717] mb-6">You can seek support for</h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                {supportTopics.map((topic, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#38B26C] shrink-0 mt-0.5" />
                    <span className="text-sm text-[#444444] font-medium leading-tight">{topic}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Boundary Notice */}
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 flex gap-4">
              <AlertCircle className="w-6 h-6 text-[#C53D52] shrink-0" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#C53D52] uppercase tracking-wider">Important care boundary</h4>
                <p className="text-xs sm:text-sm text-[#171717] leading-relaxed">
                  An online consultation cannot replace every physical examination, scan, laboratory test or emergency assessment. Your clinician will explain when in-person care is necessary.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
