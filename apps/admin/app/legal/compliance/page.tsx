import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowRight, Activity, ShieldCheck, Stethoscope } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Clinical Safety | Obiren",
  description: "Clear boundaries between tracking and care. We build Obiren so you can understand your health, prepare for appointments and access qualified care when necessary."
};

export default function CompliancePage() {
  return (
    <div className="min-h-screen bg-white text-[#17131D] font-sans overflow-x-hidden selection:bg-[#E8E0FF] selection:text-[#6D4AFF]">
      <Navbar />

      <main className="pt-32 pb-24">
        {/* Hero Section */}
        <section className="relative pt-12 pb-20 overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#F4F1FF] rounded-full blur-[120px] -z-10 translate-x-1/3 -translate-y-1/3" />
          
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="space-y-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#F4F1FF] text-[#6D4AFF] mb-2 shadow-sm">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold font-display tracking-tight text-[#171717] leading-[1.1]">
                Clear boundaries between <br className="hidden sm:inline" />
                <span className="purple-gradient-text">tracking and care</span>
              </h1>
              <p className="text-xl sm:text-2xl text-[#666666] leading-relaxed max-w-3xl mx-auto font-semibold">
                We build Obiren so you can understand your health, prepare for appointments and access qualified care when necessary.
              </p>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="py-20 bg-[#FBFAFD] border-y border-[#E8DFFF]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-8">
              
              <div className="bg-white p-10 rounded-[32px] border border-[#E8DFFF] shadow-lg shadow-[#6D4AFF]/5 space-y-4">
                <div className="flex items-center gap-4 border-b border-[#F4F1FF] pb-4 mb-4">
                  <div className="w-12 h-12 bg-[#F4F1FF] rounded-xl flex items-center justify-center text-[#6D4AFF]">
                    <Activity className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-bold text-[#171717]">Information, not diagnosis</h2>
                </div>
                <p className="text-[#666666] leading-relaxed">
                  Estimates for your cycle or pregnancy stage are based on the historical data you provide and the accepted physiological averages in reproductive health. They are presented for informational and planning purposes only.
                </p>
                <p className="text-[#171717] font-semibold leading-relaxed">
                  Obiren does not diagnose medical conditions. If your symptoms cause concern, use the platform to book a consultation with a qualified professional.
                </p>
              </div>

              <div className="bg-white p-10 rounded-[32px] border border-[#E8DFFF] shadow-lg shadow-[#6D4AFF]/5 space-y-4">
                <div className="flex items-center gap-4 border-b border-[#F4F1FF] pb-4 mb-4">
                  <div className="w-12 h-12 bg-[#F4F1FF] rounded-xl flex items-center justify-center text-[#6D4AFF]">
                    <Stethoscope className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-bold text-[#171717]">Professional care</h2>
                </div>
                <p className="text-[#666666] leading-relaxed">
                  Tele-gynecology consultations are conducted by professionals who have been independently verified for active registration in your location.
                </p>
              </div>

              <div className="bg-white p-10 rounded-[32px] border border-rose-100 shadow-lg shadow-rose-600/5 space-y-4">
                <div className="flex items-center gap-4 border-b border-rose-50 pb-4 mb-4">
                  <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-[#C53D52]">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-bold text-[#171717]">Emergency boundaries</h2>
                </div>
                <p className="text-[#666666] leading-relaxed">
                  Obiren does not dispatch emergency services. Safety alerts rely on device connectivity and the active participation of your Trusted Circle.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-32 text-center relative overflow-hidden">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#171717] font-display leading-tight">
              Ready to take control?
            </h2>
            <div className="flex justify-center">
              <Link 
                href="/?signup=true"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-[#6D4AFF] hover:bg-[#5B3DE0] text-white font-bold rounded-full text-sm shadow-xl shadow-[#6D4AFF]/30 transition-all gap-3 group"
              >
                <span>Create your free account</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
