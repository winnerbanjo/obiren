import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CheckCircle2, LockKeyhole, ArrowRight } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Privacy & Security | Obiren",
  description: "Privacy without vague promises. Your health history should not be treated as a product."
};

export default function PrivacyPage() {
  const principles = [
    "No health data sold to third-party brokers.",
    "Explicit consent required before sharing information with a clinician.",
    "Granular controls for Trusted Circle alerts.",
    "Secure infrastructure aligned with international standards."
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
                <LockKeyhole className="w-8 h-8" />
              </div>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold font-display tracking-tight text-[#171717] leading-[1.1]">
                Privacy without <br className="hidden sm:inline" />
                <span className="purple-gradient-text">vague promises</span>
              </h1>
              <p className="text-xl sm:text-2xl text-[#666666] leading-relaxed max-w-3xl mx-auto font-semibold">
                Your health history should not be treated as a product.
              </p>
              <p className="text-lg text-[#666666] leading-relaxed max-w-2xl mx-auto">
                We explain what we collect, why we need it, and how you can control it.
              </p>
            </div>
          </div>
        </section>

        {/* Principles Section */}
        <section className="py-20 bg-[#FBFAFD] border-y border-[#E8DFFF]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white p-10 rounded-[32px] border border-[#E8DFFF] shadow-lg shadow-[#6D4AFF]/5 space-y-8">
              <h2 className="text-2xl font-bold text-[#171717]">Privacy principles</h2>
              <ul className="space-y-6">
                {principles.map((item, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <CheckCircle2 className="w-6 h-6 text-[#38B26C] shrink-0 mt-0.5" />
                    <span className="text-lg font-medium text-[#444444] leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-32 text-center relative overflow-hidden">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#171717] font-display leading-tight">
              Ready for a secure health experience?
            </h2>
            <div className="flex justify-center">
              <Link 
                href="/?signup=true"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-[#6D4AFF] hover:bg-[#5B3DE0] text-white font-bold rounded-full text-sm shadow-xl shadow-[#6D4AFF]/30 transition-all gap-3 group"
              >
                <span>Create your free account to experience private, connected care.</span>
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
