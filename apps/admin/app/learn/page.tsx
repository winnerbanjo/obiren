import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { BookOpen, Search, ArrowRight, HeartPulse, Sparkles, Activity, ShieldCheck, Baby } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Women's Health Library | Obiren",
  description: "Trusted, medically-reviewed information on women's health, covering topics like PCOS, Fibroids, Endometriosis, Pregnancy, and Sexual Health."
};

export default function LearnPage() {
  const categories = [
    {
      title: "Fibroids",
      description: "Understanding symptoms, diagnosis, and modern management options for uterine fibroids.",
      icon: HeartPulse,
      color: "bg-rose-50 text-rose-600 border-rose-100",
      articleCount: 12
    },
    {
      title: "PCOS",
      description: "Navigating Polycystic Ovary Syndrome, from hormonal balance to lifestyle adjustments.",
      icon: Activity,
      color: "bg-emerald-50 text-emerald-600 border-emerald-100",
      articleCount: 18
    },
    {
      title: "Endometriosis",
      description: "Insights into managing pelvic pain, seeking diagnosis, and available treatment pathways.",
      icon: ShieldCheck,
      color: "bg-[#F4F1FF] text-[#6D4AFF] border-[#E8DFFF]",
      articleCount: 14
    },
    {
      title: "Pregnancy & Birth",
      description: "Evidence-based guidance for every trimester, labor preparation, and postpartum recovery.",
      icon: Baby,
      color: "bg-amber-50 text-amber-600 border-amber-100",
      articleCount: 24
    },
    {
      title: "Sexual Health",
      description: "Resources on contraception, STI prevention, and maintaining healthy intimate relationships.",
      icon: BookOpen,
      color: "bg-sky-50 text-sky-600 border-sky-100",
      articleCount: 16
    }
  ];

  const featuredArticles = [
    {
      title: "Recognizing the Early Signs of Endometriosis",
      category: "Endometriosis",
      readTime: "5 min read",
      date: "Oct 12, 2026"
    },
    {
      title: "How Diet Impacts PCOS Symptoms",
      category: "PCOS",
      readTime: "7 min read",
      date: "Oct 10, 2026"
    },
    {
      title: "Preparing for Your First Prenatal Visit",
      category: "Pregnancy & Birth",
      readTime: "4 min read",
      date: "Oct 08, 2026"
    }
  ];

  return (
    <div className="min-h-screen bg-white text-[#17131D] font-sans overflow-x-hidden selection:bg-[#E8E0FF] selection:text-[#6D4AFF]">
      <Navbar />

      <main className="pt-32 pb-24">
        {/* Hero Section */}
        <section className="relative pt-12 pb-20 overflow-hidden">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#F4F1FF] rounded-full blur-[120px] -z-10 translate-x-1/3 -translate-y-1/3" />
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#F4F1FF] text-[#6D4AFF] mb-2 shadow-sm">
                <BookOpen className="w-8 h-8" />
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold font-display tracking-tight text-[#171717] leading-tight">
                Empower yourself with <br className="hidden sm:inline" />
                <span className="purple-gradient-text">knowledge</span>
              </h1>
              <p className="text-lg sm:text-xl text-[#666666] leading-relaxed font-semibold">
                Trusted, medically-reviewed information on women's health. Clear answers to the questions you might be hesitant to ask.
              </p>
              
              {/* Search Bar */}
              <div className="relative max-w-xl mx-auto mt-8">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="w-5 h-5 text-gray-400" />
                </div>
                <input 
                  type="text" 
                  placeholder="Search for conditions, symptoms, or articles..." 
                  className="w-full pl-11 pr-4 py-4 rounded-full border border-[#E8DFFF] shadow-lg shadow-[#6D4AFF]/5 focus:outline-none focus:ring-2 focus:ring-[#6D4AFF] focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Categories Section */}
        <section className="py-20 bg-[#FBFAFD] border-y border-[#E8DFFF]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-end mb-12">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#171717] font-display">Browse by Category</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.map((cat, idx) => {
                const Icon = cat.icon;
                return (
                  <Link href={`#`} key={idx} className="bg-white p-8 rounded-[32px] border border-[#E8DFFF] shadow-md shadow-[#6D4AFF]/5 hover:shadow-xl hover:border-[#6D4AFF]/30 transition-all group">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border mb-6 ${cat.color} group-hover:scale-110 transition-transform`}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <h3 className="text-xl font-bold text-[#171717] mb-3">{cat.title}</h3>
                    <p className="text-[#666666] leading-relaxed text-sm mb-6 line-clamp-2">
                      {cat.description}
                    </p>
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span className="text-gray-400">{cat.articleCount} Articles</span>
                      <span className="text-[#6D4AFF] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        Explore <ArrowRight className="w-4 h-4" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Featured Articles */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#171717] font-display mb-12">Featured Reads</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {featuredArticles.map((article, idx) => (
                <div key={idx} className="group cursor-pointer space-y-4">
                  <div className="w-full aspect-[4/3] bg-[#F4F1FF] rounded-3xl border border-[#E8DFFF] overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-tr from-[#6D4AFF]/10 to-transparent group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-[#6D4AFF] uppercase tracking-wider">{article.category}</span>
                    <h3 className="text-lg font-bold text-[#171717] leading-tight group-hover:text-[#6D4AFF] transition-colors">
                      {article.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                      <span>{article.readTime}</span>
                      <span>•</span>
                      <span>{article.date}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Clinical Assurance Banner */}
        <section className="py-16 bg-[#F4F1FF] border-t border-[#E8DFFF]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#6D4AFF] mx-auto shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-[#171717]">Clinically Reviewed Content</h2>
            <p className="text-[#666666] leading-relaxed max-w-2xl mx-auto">
              All articles and educational materials in the Obiren Health Library are reviewed by our clinical advisory board. However, this information is for educational purposes only and does not replace professional medical advice.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
