import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Radio, Users, MapPin, PhoneCall } from "lucide-react";
import Link from "next/link";

export default function SafetySosPage() {
  return (
    <div className="min-h-screen bg-white text-[#17131D] font-sans overflow-x-hidden selection:bg-[#E8E0FF] selection:text-[#6C4CF1]">
      <Navbar />

      <main className="pt-32 pb-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-extrabold font-display tracking-tight text-[#17131D] mb-6">
              Silent Safety SOS
            </h1>
            <p className="text-lg md:text-xl text-[#6E6875] max-w-2xl mx-auto leading-relaxed">
              Your safety is our priority. Obiren integrates a silent panic button, live GPS tracking, and a verified emergency directory to keep you protected in any situation.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <div className="bg-[#FFF0F2] p-8 rounded-3xl border border-[#FFE0E4]">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6">
                <Radio className="w-6 h-6 text-[#E11D48]" />
              </div>
              <h3 className="text-xl font-bold mb-3">3-Second Activation</h3>
              <p className="text-[#6E6875] leading-relaxed">
                Hold the silent panic button for 3 seconds to instantly dispatch emergency notifications without alerting anyone around you.
              </p>
            </div>
            
            <div className="bg-[#FFF0F2] p-8 rounded-3xl border border-[#FFE0E4]">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6">
                <MapPin className="w-6 h-6 text-[#E11D48]" />
              </div>
              <h3 className="text-xl font-bold mb-3">Live GPS Dispatch</h3>
              <p className="text-[#6E6875] leading-relaxed">
                Automatically captures your exact geospatial coordinates (Lat/Lng) and broadcasts them to your Trusted Circle guardians.
              </p>
            </div>
            
            <div className="bg-[#F5F2FF] p-8 rounded-3xl border border-[#E8E0FF]">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6">
                <Users className="w-6 h-6 text-[#6C4CF1]" />
              </div>
              <h3 className="text-xl font-bold mb-3">Trusted Circle</h3>
              <p className="text-[#6E6875] leading-relaxed">
                Designate up to 5 family members or close friends who will receive live encrypted location pings and multi-channel SMS alerts.
              </p>
            </div>
            
            <div className="bg-[#F5F2FF] p-8 rounded-3xl border border-[#E8E0FF]">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6">
                <PhoneCall className="w-6 h-6 text-[#6C4CF1]" />
              </div>
              <h3 className="text-xl font-bold mb-3">Emergency Directory</h3>
              <p className="text-[#6E6875] leading-relaxed">
                Access an offline-capable directory of verified hospitals, police command centers, and women's crisis shelters across our launch markets.
              </p>
            </div>
          </div>

          <div className="text-center">
            <Link 
              href="/?signup=true"
              className="inline-flex items-center justify-center px-8 py-4 bg-[#17131D] hover:bg-[#2A2333] text-white font-bold rounded-full text-lg shadow-xl shadow-black/10 hover:-translate-y-1 transition-all"
            >
              Set Up Your Trusted Circle
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
