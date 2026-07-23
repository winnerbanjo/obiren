import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CheckCircle2, Baby, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Pregnancy Support | Obiren",
  description: "Pregnancy information that stays connected to your care. Follow your pregnancy journey with practical weekly information and access to qualified professionals."
};

export default function PregnancyPage() {
  const tools = [
    "Gestational week and day",
    "Estimated due-date tracking",
    "Appointment reminders",
    "Symptom journaling",
    "Medication and supplement records",
    "Questions for your next appointment",
    "Kick-count support",
    "Contraction timing",
    "Important-document storage",
    "Postpartum planning"
  ];

  return (
    <div className="min-h-screen bg-white text-[#17131D] font-sans overflow-x-hidden selection:bg-[#E8E0FF] selection:text-[#38B26C]">
      <Navbar />

      <main className="pt-32 pb-24">
        {/* Hero Section */}
        <section className="relative pt-12 pb-20 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-50 rounded-full blur-[100px] -z-10" />
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              
              <div className="space-y-8">
                <div className="space-y-6">
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold font-display tracking-tight text-[#171717] leading-tight">
                    Pregnancy information that <span className="text-[#38B26C]">stays connected</span> to your care
                  </h1>
                  <p className="text-lg text-[#666666] leading-relaxed font-semibold">
                    Follow your pregnancy journey with practical weekly information, symptom records, appointment preparation and access to qualified maternal-health professionals.
                  </p>
                </div>
              </div>

              {/* Graphic representation */}
              <div className="w-full aspect-square bg-emerald-50 rounded-[40px] border border-emerald-100 shadow-2xl flex items-center justify-center p-8 relative overflow-hidden">
                <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-lg border border-emerald-100 space-y-4">
                  <div className="flex items-center gap-3 border-b border-emerald-50 pb-4">
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-[#38B26C]">
                      <Baby className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-[#171717]">Pregnancy Journey</p>
                      <p className="text-xs text-[#666666]">Week 24 • Day 3</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-100 rounded-full w-3/4" />
                    <div className="h-4 bg-gray-100 rounded-full w-1/2" />
                    <div className="h-12 bg-gray-50 rounded-xl" />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Feature List */}
        <section className="py-20 bg-[#FBFAFD] border-y border-[#E8DFFF]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              
              <div className="space-y-8 lg:order-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#38B26C] rounded-2xl flex items-center justify-center text-white shadow-lg">
                    <Baby className="w-6 h-6" />
                  </div>
                  <h2 className="text-3xl font-bold text-[#171717]">Pregnancy tools</h2>
                </div>
                
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                  {tools.map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-[#38B26C] shrink-0" />
                      <span className="text-sm font-medium text-[#444444]">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Disclaimer block */}
              <div className="lg:order-1 bg-white p-8 sm:p-10 rounded-[32px] border border-[#E8DFFF] shadow-lg shadow-[#38B26C]/5 space-y-6 flex flex-col justify-center">
                <h3 className="text-xl font-bold text-[#171717]">Safety-aware guidance</h3>
                <p className="text-[#666666] leading-relaxed text-sm">
                  When symptoms could require urgent medical assessment, Obiren will direct you toward appropriate emergency or in-person care rather than attempting to provide a diagnosis.
                </p>
                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 flex gap-4">
                  <AlertCircle className="w-6 h-6 text-[#C53D52] shrink-0" />
                  <p className="text-xs text-[#C53D52] font-semibold leading-relaxed">
                    Always consult your healthcare provider if you experience severe pain, bleeding, or reduced fetal movement.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 text-center">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <h2 className="text-3xl font-extrabold text-[#171717] font-display">
              Support at every step
            </h2>
            <Link 
              href="/?signup=true"
              className="inline-flex items-center justify-center px-8 py-4 bg-[#6D4AFF] hover:bg-[#5B3DE0] text-white font-bold rounded-full text-sm shadow-xl shadow-[#6D4AFF]/30 transition-all gap-3 group"
            >
              <span>Create your free account to access connected pregnancy support.</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
