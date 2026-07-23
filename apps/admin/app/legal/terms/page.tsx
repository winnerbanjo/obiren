import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white text-[#17131D] font-sans overflow-x-hidden selection:bg-[#E8E0FF] selection:text-[#6C4CF1]">
      <Navbar />

      <main className="pt-32 pb-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold font-display tracking-tight text-[#17131D] mb-4">
            Terms of Service
          </h1>
          <p className="text-sm text-[#6E6875] font-bold mb-10 border-b border-[#E7E2EB] pb-6">
            Effective Date: August 1, 2026
          </p>
          
          <div className="prose prose-lg prose-indigo mx-auto text-[#6E6875]">
            <h2 className="text-2xl font-bold text-[#17131D] mt-8 mb-4">1. Acceptance of Terms</h2>
            <p className="mb-6">
              By accessing or using the Obiren application, website, and services, you agree to be bound by these Terms of Service. If you do not agree to all the terms and conditions, you may not access or use the services.
            </p>

            <h2 className="text-2xl font-bold text-[#17131D] mt-8 mb-4">2. Not Medical Advice</h2>
            <p className="mb-6">
              <strong>MEDICAL DISCLAIMER:</strong> Obiren provides health tracking and prediction tools for informational purposes only. The app and its non-diagnostic prediction calculations are NOT a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or qualified health provider with any questions you may have regarding a medical condition.
            </p>

            <h2 className="text-2xl font-bold text-[#17131D] mt-8 mb-4">3. User Responsibilities</h2>
            <p className="mb-6">
              You are responsible for maintaining the confidentiality of your account credentials. The safety SOS features rely on your device's network connectivity and location services; Obiren cannot guarantee delivery of emergency alerts if cellular or internet service is unavailable.
            </p>

            <h2 className="text-2xl font-bold text-[#17131D] mt-8 mb-4">4. Termination</h2>
            <p className="mb-6">
              We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
            </p>

            <h2 className="text-2xl font-bold text-[#17131D] mt-8 mb-4">5. Governing Law</h2>
            <p className="mb-6">
              These Terms shall be governed and construed in accordance with the laws of the United Kingdom, without regard to its conflict of law provisions.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
