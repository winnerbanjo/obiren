import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CheckCircle2, Stethoscope, ShieldCheck, Video, CalendarCheck, ArrowRight } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Consult a Specialist | Obiren",
  description: "Speak privately with verified gynecologists and maternal-health professionals. Expert care, wherever you are."
};

export default function ConsultPage() {
  const features = [
    {
      title: "Verified Professionals",
      description: "Every specialist on our platform is independently verified to ensure they hold active registration in your location.",
      icon: ShieldCheck
    },
    {
      title: "Private & Secure",
      description: "Consultations are end-to-end encrypted. We prioritize your privacy and never record your sessions without explicit consent.",
      icon: Video
    },
    {
      title: "Flexible Scheduling",
      description: "Book appointments that fit your lifestyle, with availability across different time zones to support you when you need it.",
      icon: CalendarCheck
    },
    {
      title: "Connected Care",
      description: "Share your tracking history directly with your specialist for more accurate assessments and personalized care plans.",
      icon: Stethoscope
    }
  ];

  return (
    <div className="min-h-screen bg-white text-[#17131D] font-sans overflow-x-hidden selection:bg-[#E8E0FF] selection:text-[#6D4AFF]">
      <Navbar />

      <main className="pt-32 pb-24">
        {/* Hero Section */}
        <section className="relative pt-12 pb-20 overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#F4F1FF] rounded-full blur-[120px] -z-10 translate-x-1/3 -translate-y-1/3" />
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              
              <div className="space-y-8">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F4F1FF] border border-[#E8DFFF] rounded-full text-xs font-bold text-[#6D4AFF]">
                    <span className="uppercase tracking-wider">Virtual Care</span>
                  </div>
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold font-display tracking-tight text-[#171717] leading-tight">
                    Specialist care when you <br className="hidden lg:inline" />
                    <span className="text-[#6D4AFF]">need it most</span>
                  </h1>
                  <p className="text-lg text-[#666666] leading-relaxed">
                    Skip the waiting room. Speak privately with verified gynecologists and maternal-health professionals from the comfort and privacy of your own home.
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <Link 
                    href="/?signup=true"
                    className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-[#6D4AFF] hover:bg-[#5B3DE0] text-white font-bold rounded-full text-sm shadow-xl shadow-[#6D4AFF]/30 transition-all gap-3 group"
                  >
                    <span>Find a Specialist</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>

              {/* Graphic representation */}
              <div className="w-full aspect-[4/3] sm:aspect-square bg-[#F4F1FF] rounded-[40px] border border-[#E8DFFF] shadow-2xl flex items-center justify-center p-8 relative overflow-hidden">
                <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-lg border border-[#E8DFFF] space-y-6 relative z-10">
                  <div className="flex items-center gap-4 border-b border-[#F4F1FF] pb-4">
                    <div className="w-12 h-12 bg-emerald-100 rounded-full overflow-hidden flex items-center justify-center text-emerald-700 font-bold border-2 border-white shadow-sm shrink-0">
                      DR
                    </div>
                    <div>
                      <p className="font-bold text-[#171717] leading-tight">Dr. Sarah Bello</p>
                      <p className="text-xs text-[#666666]">Consultant Gynecologist</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-[#FBFAFD] p-3 rounded-xl border border-[#E8DFFF]">
                      <span className="text-xs font-semibold text-[#666666]">Next Available</span>
                      <span className="text-xs font-bold text-[#6D4AFF]">Today, 2:30 PM</span>
                    </div>
                    <div className="flex justify-between items-center bg-[#FBFAFD] p-3 rounded-xl border border-[#E8DFFF]">
                      <span className="text-xs font-semibold text-[#666666]">Consultation Type</span>
                      <span className="text-xs font-bold text-[#171717]">Video Call</span>
                    </div>
                  </div>
                  <button className="w-full py-3 bg-[#6D4AFF]/10 text-[#6D4AFF] font-bold text-sm rounded-xl hover:bg-[#6D4AFF]/20 transition-colors">
                    Book Appointment
                  </button>
                </div>
                
                {/* Decorative Elements */}
                <div className="absolute top-10 right-10 w-20 h-20 bg-emerald-400/20 rounded-full blur-2xl" />
                <div className="absolute bottom-10 left-10 w-32 h-32 bg-[#6D4AFF]/10 rounded-full blur-2xl" />
              </div>

            </div>
          </div>
        </section>

        {/* Feature List */}
        <section className="py-20 bg-[#FBFAFD] border-y border-[#E8DFFF]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-6 mb-16">
              <h2 className="text-3xl font-extrabold text-[#171717] font-display tracking-tight">
                How our tele-gynecology works
              </h2>
              <p className="text-lg text-[#666666] leading-relaxed">
                We've built a clinical platform designed to provide expert advice, actionable health plans, and peace of mind.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {features.map((feature, idx) => {
                const Icon = feature.icon;
                return (
                  <div key={idx} className="bg-white p-8 sm:p-10 rounded-[32px] border border-[#E8DFFF] shadow-lg shadow-[#6D4AFF]/5 space-y-4 hover:shadow-xl transition-all group">
                    <div className="w-12 h-12 bg-[#F4F1FF] rounded-xl flex items-center justify-center text-[#6D4AFF] group-hover:scale-110 transition-transform">
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-[#171717]">{feature.title}</h3>
                    <p className="text-[#666666] leading-relaxed text-sm sm:text-base">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* What We Treat */}
        <section className="py-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-12">
            <h2 className="text-3xl font-extrabold text-[#171717] font-display tracking-tight">
              What can we help with?
            </h2>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                "Irregular Periods", 
                "PCOS Management", 
                "Endometriosis & Pelvic Pain", 
                "Fertility Consultations", 
                "Pregnancy Support", 
                "Contraception Advice",
                "Menopause Management",
                "General Reproductive Health"
              ].map((item, idx) => (
                <div key={idx} className="px-5 py-3 bg-[#FBFAFD] border border-[#E8DFFF] rounded-full text-sm font-semibold text-[#171717] shadow-sm">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 bg-[#FBFAFD] border-t border-[#E8DFFF] text-center">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <h2 className="text-3xl font-extrabold text-[#171717] font-display">
              Ready to speak with a specialist?
            </h2>
            <Link 
              href="/?signup=true"
              className="inline-flex items-center justify-center px-8 py-4 bg-[#6D4AFF] hover:bg-[#5B3DE0] text-white font-bold rounded-full text-sm shadow-xl shadow-[#6D4AFF]/30 transition-all gap-3 group"
            >
              <span>Create Free Account</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
