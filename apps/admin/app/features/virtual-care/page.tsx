import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Video, CalendarCheck, FileText, Smartphone, ArrowRight, ShieldCheck, HeartPulse } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "How Virtual Care Works | Obiren",
  description: "Learn how Obiren connects you with qualified gynecologists and maternal-health professionals through secure, private virtual consultations."
};

export default function VirtualCarePage() {
  const steps = [
    {
      icon: Smartphone,
      title: "1. Create Your Profile",
      description: "Sign up and securely log your health history, current symptoms, and any specific concerns. Your data is encrypted and completely private.",
    },
    {
      icon: CalendarCheck,
      title: "2. Book an Appointment",
      description: "Browse our directory of verified specialists. Choose a time that fits your schedule, whether you need immediate advice or a routine check-up.",
    },
    {
      icon: Video,
      title: "3. Connect Securely",
      description: "Join your consultation via a secure, high-definition video link directly within the Obiren platform. No third-party apps required.",
    },
    {
      icon: FileText,
      title: "4. Receive Your Care Plan",
      description: "After your session, access your specialist's notes, prescriptions, and actionable care plan directly in your Private Health Vault.",
    }
  ];

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
                <Video className="w-8 h-8" />
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold font-display tracking-tight text-[#171717] leading-tight">
                Expert care, delivered <br className="hidden sm:inline" />
                <span className="purple-gradient-text">wherever you are</span>
              </h1>
              <p className="text-lg sm:text-xl text-[#666666] leading-relaxed max-w-3xl mx-auto font-semibold">
                Obiren makes it simple to consult with verified gynecologists and maternal-health professionals from the privacy of your own home.
              </p>
            </div>
          </div>
        </section>

        {/* Step-by-Step Guide */}
        <section className="py-20 bg-[#FBFAFD] border-y border-[#E8DFFF]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl font-extrabold text-[#171717] font-display tracking-tight">
                How Virtual Care Works
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {steps.map((step, idx) => {
                const Icon = step.icon;
                return (
                  <div key={idx} className="bg-white p-8 rounded-[32px] border border-[#E8DFFF] shadow-md shadow-[#6D4AFF]/5 hover:shadow-xl transition-all group relative">
                    {/* Connecting line for desktop */}
                    {idx < steps.length - 1 && (
                      <div className="hidden lg:block absolute top-14 left-[calc(50%+3rem)] w-[calc(100%-2rem)] h-[2px] bg-gradient-to-r from-[#E8DFFF] to-transparent z-0" />
                    )}
                    
                    <div className="relative z-10">
                      <div className="w-14 h-14 bg-[#F4F1FF] rounded-2xl flex items-center justify-center text-[#6D4AFF] mb-6 group-hover:scale-110 group-hover:bg-[#6D4AFF] group-hover:text-white transition-all">
                        <Icon className="w-7 h-7" />
                      </div>
                      <h3 className="text-xl font-bold text-[#171717] mb-3">{step.title}</h3>
                      <p className="text-[#666666] leading-relaxed text-sm">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* The Obiren Difference */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-8">
                <h2 className="text-3xl sm:text-4xl font-extrabold text-[#171717] font-display tracking-tight">
                  Why choose Obiren for virtual care?
                </h2>
                
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <HeartPulse className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-[#171717]">Integrated Tracking</h4>
                      <p className="text-[#666666] text-sm mt-1 leading-relaxed">Unlike standalone telehealth apps, your specialist can review your logged cycle patterns, pregnancy symptoms, and medical history before the call begins.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#F4F1FF] text-[#6D4AFF] flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-[#171717]">Vetted Professionals</h4>
                      <p className="text-[#666666] text-sm mt-1 leading-relaxed">We enforce strict verification. Every doctor on our platform has their medical license and registration actively verified in their respective country.</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="w-full aspect-square bg-[#FBFAFD] rounded-[40px] border border-[#E8DFFF] shadow-lg flex items-center justify-center p-8 relative">
                <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-xl border border-[#E8DFFF]">
                  <div className="aspect-video bg-gray-900 relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                        <Video className="w-8 h-8 text-white" />
                      </div>
                    </div>
                    {/* Small self-view PIP */}
                    <div className="absolute bottom-4 right-4 w-24 aspect-video bg-gray-800 rounded-lg border-2 border-white/20" />
                  </div>
                  <div className="p-5 flex justify-between items-center bg-white">
                    <div>
                      <p className="font-bold text-[#171717]">Consultation in progress</p>
                      <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Secure Connection
                      </p>
                    </div>
                    <button className="px-4 py-2 bg-rose-50 text-rose-600 rounded-lg text-sm font-bold">End</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 bg-[#FBFAFD] border-t border-[#E8DFFF] text-center">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <h2 className="text-3xl font-extrabold text-[#171717] font-display">
              Ready to experience better care?
            </h2>
            <Link 
              href="/?signup=true"
              className="inline-flex items-center justify-center px-8 py-4 bg-[#6D4AFF] hover:bg-[#5B3DE0] text-white font-bold rounded-full text-sm shadow-xl shadow-[#6D4AFF]/30 transition-all gap-3 group"
            >
              <span>Create your free account</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
