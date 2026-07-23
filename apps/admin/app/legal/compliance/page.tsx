import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Shield, Lock, FileCheck } from "lucide-react";

export default function CompliancePage() {
  return (
    <div className="min-h-screen bg-white text-[#17131D] font-sans overflow-x-hidden selection:bg-[#E8E0FF] selection:text-[#6C4CF1]">
      <Navbar />

      <main className="pt-32 pb-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-extrabold font-display tracking-tight text-[#17131D] mb-6">
              Trust & Compliance
            </h1>
            <p className="text-lg md:text-xl text-[#6E6875] max-w-2xl mx-auto leading-relaxed">
              Your health data is yours alone. We built Obiren on strict zero-knowledge encryption standards and international regulatory frameworks.
            </p>
          </div>

          <div className="space-y-8">
            <div className="bg-[#F5F2FF] p-8 md:p-10 rounded-3xl border border-[#E8E0FF] flex flex-col md:flex-row gap-8 items-start">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center shrink-0">
                <Shield className="w-8 h-8 text-[#6C4CF1]" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-3">NDPR & GDPR Compliant</h3>
                <p className="text-[#6E6875] leading-relaxed mb-4">
                  We adhere strictly to the Nigeria Data Protection Regulation (NDPR) and the EU General Data Protection Regulation (GDPR). We enforce data minimization, lawful processing, and the right to be forgotten.
                </p>
                <ul className="list-disc pl-5 text-[#6E6875] space-y-2">
                  <li>Data processing localized to approved regions</li>
                  <li>One-click automated data exports</li>
                  <li>Irreversible account and data purging</li>
                </ul>
              </div>
            </div>

            <div className="bg-[#F5F2FF] p-8 md:p-10 rounded-3xl border border-[#E8E0FF] flex flex-col md:flex-row gap-8 items-start">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center shrink-0">
                <Lock className="w-8 h-8 text-[#6C4CF1]" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-3">256-Bit Zero-Knowledge Encryption</h3>
                <p className="text-[#6E6875] leading-relaxed mb-4">
                  For sensitive records inside the Health Vault, we utilize zero-knowledge architecture. This means the decryption keys never leave your device.
                </p>
                <ul className="list-disc pl-5 text-[#6E6875] space-y-2">
                  <li>Argon2id password hashing</li>
                  <li>AES-256-GCM encryption for stored files</li>
                  <li>TLS 1.3 for data in transit</li>
                </ul>
              </div>
            </div>

            <div className="bg-[#F5F2FF] p-8 md:p-10 rounded-3xl border border-[#E8E0FF] flex flex-col md:flex-row gap-8 items-start">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center shrink-0">
                <FileCheck className="w-8 h-8 text-[#6C4CF1]" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-3">HIPAA Alignment</h3>
                <p className="text-[#6E6875] leading-relaxed mb-4">
                  As we expand telehealth features in the US market, our systems are architected to align with HIPAA Security and Privacy Rules, ensuring Protected Health Information (PHI) is safeguarded according to federal standards.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
