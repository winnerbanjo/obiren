import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white text-[#17131D] font-sans overflow-x-hidden selection:bg-[#E8E0FF] selection:text-[#6C4CF1]">
      <Navbar />

      <main className="pt-32 pb-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold font-display tracking-tight text-[#17131D] mb-4">
            Privacy Policy
          </h1>
          <p className="text-sm text-[#6E6875] font-bold mb-10 border-b border-[#E7E2EB] pb-6">
            Effective Date: August 1, 2026
          </p>
          
          <div className="prose prose-lg prose-indigo mx-auto text-[#6E6875]">
            <h2 className="text-2xl font-bold text-[#17131D] mt-8 mb-4">1. Zero Data Selling Guarantee</h2>
            <p className="mb-6">
              Your personal health entries, daily symptom logs, and pregnancy records belong to you. <strong>We will NEVER sell your data</strong> to third-party ad networks, insurance underwriters, or data brokers. Obiren's business model is built on providing value to you, not monetizing your reproductive records.
            </p>

            <h2 className="text-2xl font-bold text-[#17131D] mt-8 mb-4">2. Data We Collect</h2>
            <p className="mb-6">
              To provide you with our services, we collect:
              <ul className="list-disc pl-6 mt-2 space-y-2">
                <li>Account Information (Name, Email, Secure Password Hash)</li>
                <li>Health Metrics (Cycle dates, symptoms, pregnancy logs)</li>
                <li>Safety Information (Trusted Contacts, live GPS only when SOS is activated)</li>
              </ul>
            </p>

            <h2 className="text-2xl font-bold text-[#17131D] mt-8 mb-4">3. 256-Bit End-to-End Encryption</h2>
            <p className="mb-6">
              Private notes and uploaded health vault documents are encrypted using zero-knowledge architecture. Only you hold the decryption keys. Obiren engineers and database administrators cannot read your encrypted health vault files.
            </p>

            <h2 className="text-2xl font-bold text-[#17131D] mt-8 mb-4">4. NDPR & GDPR Compliance</h2>
            <p className="mb-6">
              We operate in strict compliance with the Nigeria Data Protection Regulation (NDPR) and UK/EU GDPR. You have the right to request an automated machine-readable data export (JSON) or a full account purge at any time from your settings panel.
            </p>

            <h2 className="text-2xl font-bold text-[#17131D] mt-8 mb-4">5. Contact Us</h2>
            <p className="mb-6">
              For any privacy-related inquiries, please contact our Data Protection Officer at <strong>privacy@obiren.com</strong>.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
