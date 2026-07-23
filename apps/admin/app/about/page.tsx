import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white text-[#17131D] font-sans overflow-x-hidden selection:bg-[#E8E0FF] selection:text-[#6C4CF1]">
      <Navbar />

      <main className="pt-32 pb-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-extrabold font-display tracking-tight text-[#17131D] mb-8 text-center">
            About Obiren
          </h1>
          
          <div className="prose prose-lg prose-indigo mx-auto text-[#6E6875]">
            <p className="lead text-xl font-medium text-[#17131D] mb-6">
              Obiren means "Woman" in Itsekiri. We are building the single, unified platform that women deserve for their health, safety, and peace of mind.
            </p>
            
            <h2 className="text-2xl font-bold text-[#17131D] mt-10 mb-4">Our Mission</h2>
            <p className="mb-6">
              For too long, women have had to use fragmented tools — one app for period logging, another for pregnancy, with zero safety integration or privacy guarantees. Obiren unites everything into one trustworthy, empowering system. We built Obiren to serve women in the UK, US, Nigeria, and Ghana, with culturally aware health guidance and localized emergency resources.
            </p>
            
            <h2 className="text-2xl font-bold text-[#17131D] mt-10 mb-4">Focused on African Women</h2>
            <p className="mb-6">
              Conditions like Fibroids affect up to 70% of African women by age 50. Obiren provides dedicated tracking, clinical guidance, and specialist access tailored to these specific needs, breaking down stigmas and improving health literacy.
            </p>
            
            <h2 className="text-2xl font-bold text-[#17131D] mt-10 mb-4">Zero Data Monetization</h2>
            <p className="mb-6">
              Your reproductive logs belong to you alone. We are fiercely committed to privacy. Your personal health entries, daily symptom logs, and pregnancy records will NEVER be sold to third-party ad networks, insurance underwriters, or data brokers.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
