import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = {
  title: "For Healthcare Professionals | Obiren",
  description: "Learn more about For Healthcare Professionals on Obiren."
};

export default function PlaceholderPage() {
  return (
    <div className="min-h-screen bg-white text-[#17131D] font-sans overflow-x-hidden selection:bg-[#E8E0FF] selection:text-[#6D4AFF]">
      <Navbar />
      <main className="pt-32 pb-24">
        <section className="relative pt-12 pb-20 overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#F4F1FF] rounded-full blur-[120px] -z-10 translate-x-1/3 -translate-y-1/3" />
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="space-y-8">
              <h1 className="text-5xl sm:text-6xl font-extrabold font-display tracking-tight text-[#171717] leading-[1.1]">
                For Healthcare Professionals
              </h1>
              <p className="text-xl text-[#666666] leading-relaxed max-w-3xl mx-auto font-semibold">
                This page is coming soon.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
