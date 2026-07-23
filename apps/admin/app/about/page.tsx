import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowRight, Globe2, HeartPulse } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "About Obiren | The Standard of Care Must Change",
  description: "Obiren was built because fragmented health tracking, delayed specialist care and ignored safety concerns have become too normal. Join us as we build the next generation of women's healthcare."
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white text-[#17131D] font-sans overflow-x-hidden selection:bg-[#E8E0FF] selection:text-[#6D4AFF]">
      <Navbar />

      <main className="pt-32 pb-24">
        {/* Hero Section */}
        <section className="relative pt-12 pb-20 overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#F4F1FF] rounded-full blur-[120px] -z-10 translate-x-1/3 -translate-y-1/3" />
          
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="space-y-8">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold font-display tracking-tight text-[#171717] leading-[1.1]">
                The standard of care <br className="hidden sm:inline" />
                <span className="purple-gradient-text">must change</span>
              </h1>
              <p className="text-xl sm:text-2xl text-[#666666] leading-relaxed max-w-3xl mx-auto">
                Obiren was built because fragmented health tracking, delayed specialist care and ignored safety concerns have become too normal.
              </p>
            </div>
          </div>
        </section>

        {/* Mission & Leadership Section */}
        <section className="py-20 bg-[#FBFAFD] border-y border-[#E8DFFF]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              
              {/* Mission */}
              <div className="bg-white p-10 rounded-[32px] border border-[#E8DFFF] shadow-lg shadow-[#6D4AFF]/5 space-y-6 group hover:border-[#6D4AFF]/30 transition-all">
                <div className="w-14 h-14 bg-[#F4F1FF] rounded-2xl flex items-center justify-center text-[#6D4AFF]">
                  <Globe2 className="w-7 h-7" />
                </div>
                <h2 className="text-2xl font-bold text-[#171717]">Our mission</h2>
                <p className="text-base text-[#666666] leading-relaxed">
                  To build a connected health and safety ecosystem that respects the reality of women’s lives, starting in Africa and expanding globally.
                </p>
              </div>

              {/* Leadership */}
              <div className="bg-white p-10 rounded-[32px] border border-[#E8DFFF] shadow-lg shadow-[#6D4AFF]/5 space-y-6 group hover:border-[#6D4AFF]/30 transition-all">
                <div className="w-14 h-14 bg-[#F4F1FF] rounded-2xl flex items-center justify-center text-[#6D4AFF]">
                  <HeartPulse className="w-7 h-7" />
                </div>
                <h2 className="text-2xl font-bold text-[#171717]">Leadership and Advisory</h2>
                <p className="text-base text-[#666666] leading-relaxed">
                  We are advised by consultant gynecologists, clinical researchers and women’s health advocates who ensure that our product decisions remain medically sound and culturally relevant.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-32 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-white to-[#F4F1FF]/50 -z-10" />
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#171717] font-display leading-tight">
              Join us as we build the next generation of women’s healthcare.
            </h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                href="/?signup=true"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-[#6D4AFF] hover:bg-[#5B3DE0] text-white font-bold rounded-full text-sm shadow-xl shadow-[#6D4AFF]/30 transition-all gap-3 group"
              >
                <span>Create Free Account</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link 
                href="/professionals"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-white hover:bg-[#F5F2FF] text-[#171717] font-bold rounded-full text-sm border border-[#E8DFFF] transition-all gap-3"
              >
                <span>For Healthcare Professionals</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
