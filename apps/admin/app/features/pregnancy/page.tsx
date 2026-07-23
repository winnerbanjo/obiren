import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Baby, Activity, BookOpen, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function PregnancyCompanionPage() {
  return (
    <div className="min-h-screen bg-white text-[#17131D] font-sans overflow-x-hidden selection:bg-[#E8E0FF] selection:text-[#6C4CF1]">
      <Navbar />

      <main className="pt-32 pb-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-extrabold font-display tracking-tight text-[#17131D] mb-6">
              Pregnancy Companion
            </h1>
            <p className="text-lg md:text-xl text-[#6E6875] max-w-2xl mx-auto leading-relaxed">
              Navigate your pregnancy journey with evidence-based guidance, maternal timelines, kick counters, and specialized tracking tools.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <div className="bg-[#F5F2FF] p-8 rounded-3xl border border-[#E8E0FF]">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6">
                <Baby className="w-6 h-6 text-[#6C4CF1]" />
              </div>
              <h3 className="text-xl font-bold mb-3">Maternal Timeline</h3>
              <p className="text-[#6E6875] leading-relaxed">
                Track your baby's development week-by-week with beautiful visual milestones and medically reviewed health tips.
              </p>
            </div>
            
            <div className="bg-[#F5F2FF] p-8 rounded-3xl border border-[#E8E0FF]">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6">
                <Activity className="w-6 h-6 text-[#6C4CF1]" />
              </div>
              <h3 className="text-xl font-bold mb-3">Kick & Contraction Tracking</h3>
              <p className="text-[#6E6875] leading-relaxed">
                Log daily kick counts and accurately time your contractions. Easily export these logs for your doctor or midwife.
              </p>
            </div>
            
            <div className="bg-[#F5F2FF] p-8 rounded-3xl border border-[#E8E0FF]">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6">
                <BookOpen className="w-6 h-6 text-[#6C4CF1]" />
              </div>
              <h3 className="text-xl font-bold mb-3">Clinical Knowledge</h3>
              <p className="text-[#6E6875] leading-relaxed">
                Access a library of medically verified articles covering prenatal nutrition, postpartum depression, and maternal wellness.
              </p>
            </div>
            
            <div className="bg-[#F5F2FF] p-8 rounded-3xl border border-[#E8E0FF]">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6">
                <ShieldCheck className="w-6 h-6 text-[#6C4CF1]" />
              </div>
              <h3 className="text-xl font-bold mb-3">Health Vault Integration</h3>
              <p className="text-[#6E6875] leading-relaxed">
                Securely store your ultrasound scans, blood test results, and prenatal records using 256-bit encryption.
              </p>
            </div>
          </div>

          <div className="text-center">
            <Link 
              href="/?signup=true"
              className="inline-flex items-center justify-center px-8 py-4 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white font-bold rounded-full text-lg shadow-xl shadow-[#6C4CF1]/20 hover:-translate-y-1 transition-all"
            >
              Start Your Journey
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
