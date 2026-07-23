import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Calendar, Activity, ShieldCheck, HeartPulse } from "lucide-react";
import Link from "next/link";

export default function CycleTrackingPage() {
  return (
    <div className="min-h-screen bg-white text-[#17131D] font-sans overflow-x-hidden selection:bg-[#E8E0FF] selection:text-[#6C4CF1]">
      {/* We pass empty functions to the modals for now, or just rely on Link routing if we change the Navbar */}
      <Navbar />

      <main className="pt-32 pb-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-extrabold font-display tracking-tight text-[#17131D] mb-6">
              Period & Cycle Tracker
            </h1>
            <p className="text-lg md:text-xl text-[#6E6875] max-w-2xl mx-auto leading-relaxed">
              Comprehensive reproductive health tracking with calendar views, symptoms logging, and non-diagnostic prediction calculations designed specifically for African women and women worldwide.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <div className="bg-[#F5F2FF] p-8 rounded-3xl border border-[#E8E0FF]">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6">
                <Calendar className="w-6 h-6 text-[#6C4CF1]" />
              </div>
              <h3 className="text-xl font-bold mb-3">Weighted Predictions</h3>
              <p className="text-[#6E6875] leading-relaxed">
                Our algorithm uses your historical data to provide weighted cycle length predictions with clear confidence ratings.
              </p>
            </div>
            
            <div className="bg-[#F5F2FF] p-8 rounded-3xl border border-[#E8E0FF]">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6">
                <Activity className="w-6 h-6 text-[#6C4CF1]" />
              </div>
              <h3 className="text-xl font-bold mb-3">Symptom Logging</h3>
              <p className="text-[#6E6875] leading-relaxed">
                Track cycle day, period dates, bleeding intensity, and pain scale. Log 12+ symptom options and 7+ mood trackers with private notes.
              </p>
            </div>
            
            <div className="bg-[#F5F2FF] p-8 rounded-3xl border border-[#E8E0FF]">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6">
                <ShieldCheck className="w-6 h-6 text-[#6C4CF1]" />
              </div>
              <h3 className="text-xl font-bold mb-3">100% Encrypted</h3>
              <p className="text-[#6E6875] leading-relaxed">
                Your data is stored using zero-knowledge encryption. We will never sell your reproductive records to third parties.
              </p>
            </div>
            
            <div className="bg-[#F5F2FF] p-8 rounded-3xl border border-[#E8E0FF]">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6">
                <HeartPulse className="w-6 h-6 text-[#6C4CF1]" />
              </div>
              <h3 className="text-xl font-bold mb-3">PCOS & Fibroid Focused</h3>
              <p className="text-[#6E6875] leading-relaxed">
                Built with a deep understanding of conditions like PCOS and Fibroids, which disproportionately affect women of African descent.
              </p>
            </div>
          </div>

          <div className="text-center">
            <Link 
              href="/?signup=true"
              className="inline-flex items-center justify-center px-8 py-4 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white font-bold rounded-full text-lg shadow-xl shadow-[#6C4CF1]/20 hover:-translate-y-1 transition-all"
            >
              Start Tracking Now
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
