import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CheckCircle2, ShieldAlert, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Personal Safety & SOS | Obiren",
  description: "Help the people you trust find and support you. Obiren lets you create a Trusted Circle of people who should be contacted if you activate a personal safety alert."
};

export default function SafetyPage() {
  const tools = [
    {
      title: "Trusted Circle",
      description: "Add up to five trusted contacts and decide what information each person may receive.",
    },
    {
      title: "Hold-to-activate SOS",
      description: "Press and hold the SOS control to reduce accidental activation and begin an emergency alert.",
    },
    {
      title: "Location sharing",
      description: "Where you have granted permission and location is available, Obiren can include your latest coordinates in alerts sent to your Trusted Circle.",
    },
    {
      title: "Emergency directory",
      description: "Find relevant emergency services, hospitals, crisis-support organisations and women’s assistance resources by country and location.",
    }
  ];

  return (
    <div className="min-h-screen bg-white text-[#17131D] font-sans overflow-x-hidden selection:bg-[#E8E0FF] selection:text-[#C53D52]">
      <Navbar />

      <main className="pt-32 pb-24">
        {/* Hero Section */}
        <section className="relative pt-12 pb-20 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-rose-50 rounded-full blur-[100px] -z-10" />
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              
              <div className="space-y-8">
                <div className="space-y-6">
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold font-display tracking-tight text-[#171717] leading-tight">
                    Help the people you trust <span className="text-[#C53D52]">find and support you</span>
                  </h1>
                  <p className="text-lg text-[#666666] leading-relaxed">
                    Health and personal safety are often treated as unrelated problems. Women do not always experience them separately.
                  </p>
                  <p className="text-lg font-semibold text-[#171717]">
                    Obiren lets you create a Trusted Circle of people who should be contacted if you activate a personal safety alert.
                  </p>
                </div>
              </div>

              {/* Graphic representation */}
              <div className="w-full aspect-square bg-rose-50 rounded-[40px] border border-rose-100 shadow-2xl flex items-center justify-center p-8 relative overflow-hidden">
                <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-lg border border-rose-100 space-y-4">
                  <div className="flex items-center gap-3 border-b border-rose-50 pb-4">
                    <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center text-[#C53D52]">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-[#171717]">Safety Status</p>
                      <p className="text-xs text-[#666666]">Trusted Circle Ready</p>
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
              
              <div className="space-y-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#C53D52] rounded-2xl flex items-center justify-center text-white shadow-lg">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <h2 className="text-3xl font-bold text-[#171717]">Safety features</h2>
                </div>
                
                <ul className="grid grid-cols-1 gap-y-6">
                  {tools.map((item, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <CheckCircle2 className="w-6 h-6 text-[#C53D52] shrink-0 mt-0.5" />
                      <div>
                        <span className="text-base font-bold text-[#171717] block mb-1">{item.title}</span>
                        <span className="text-sm text-[#666666] leading-relaxed block">{item.description}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Disclaimer block */}
              <div className="bg-white p-8 sm:p-10 rounded-[32px] border border-[#E8DFFF] shadow-lg shadow-[#C53D52]/5 space-y-6 flex flex-col justify-center">
                <h3 className="text-xl font-bold text-[#171717]">Honest safety statement</h3>
                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 flex gap-4">
                  <AlertCircle className="w-6 h-6 text-[#C53D52] shrink-0" />
                  <p className="text-sm text-[#C53D52] font-semibold leading-relaxed">
                    Obiren does not guarantee police, ambulance or emergency-service dispatch. Alerts are sent to the contacts and channels shown before activation. Delivery depends on connectivity, device permissions and third-party communication providers.
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
              Ready to configure your circle?
            </h2>
            <Link 
              href="/?signup=true"
              className="inline-flex items-center justify-center px-8 py-4 bg-[#6D4AFF] hover:bg-[#5B3DE0] text-white font-bold rounded-full text-sm shadow-xl shadow-[#6D4AFF]/30 transition-all gap-3 group"
            >
              <span>Create your free account to configure your Trusted Circle.</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
