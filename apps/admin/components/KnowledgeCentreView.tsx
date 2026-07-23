"use client";

import { useState } from "react";
import {
  BookOpen,
  Search,
  Bookmark,
  Share2,
  CheckCircle2,
  FileText,
  HeartPulse,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

interface KnowledgeCentreViewProps {
  userProfile: any;
}

export default function KnowledgeCentreView({ userProfile }: KnowledgeCentreViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [activeArticle, setActiveArticle] = useState<any | null>(null);

  const categories = [
    "All",
    "Menstrual Health",
    "Fertility",
    "Pregnancy",
    "Fibroids & PCOS",
    "Breast Health",
    "Mental Wellbeing",
    "Safety & Rights",
  ];

  const articles = [
    {
      id: "art-1",
      title: "Understanding Uterine Fibroids: Symptoms, Diagnosis & Modern Treatments",
      summary:
        "Fibroids affect up to 70% of African women by age 50. Learn about non-invasive procedures, dietary adjustments, and when to consult a gynecologist.",
      category: "Fibroids & PCOS",
      author: "Dr. Amina Bello (Obstetrician)",
      medicalReviewer: "Apex Gynecological Review Board",
      lastReviewed: "July 15, 2026",
      readTime: "6 min read",
      sources: ["World Health Organization 2025", "Journal of African Women's Health Vol 14"],
      content: `Uterine fibroids are non-cancerous growths of the uterus that often appear during childbearing years. Symptoms include heavy menstrual bleeding, prolonged periods, pelvic pain, and frequent urination.

### Early Detection & Diagnosis
Diagnosis is typically confirmed via pelvic ultrasound or MRI. Early consultation allows doctors to recommend conservative management techniques before surgical intervention is required.`,
    },
    {
      id: "art-[#2]",
      title: "PCOS & Fertility: Managing Insulin Resistance Through Nutrition",
      summary:
        "Polycystic Ovary Syndrome (PCOS) can cause irregular cycles. Discover evidence-based nutrition protocols tailored for traditional African diets.",
      category: "Fibroids & PCOS",
      author: "Khadijah Vance (Maternal Nutritionist)",
      medicalReviewer: "Dr. Sarah Jenkins (Gynecologist)",
      lastReviewed: "June 28, 2026",
      readTime: "8 min read",
      sources: ["Clinical Endocrinology Quarterly"],
      content: `Insulin resistance is a central driver of PCOS symptoms. Incorporating complex carbohydrates, high-fiber legumes, and lean proteins helps stabilize blood glucose levels and promote ovulatory regularity.`,
    },
    {
      id: "art-3",
      title: "Postpartum Mental Health: Overcoming Anxiety & Baby Blues",
      summary:
        "Navigating hormonal shifts after childbirth. How to identify postpartum depression early and connect with supportive maternal therapists.",
      category: "Mental Wellbeing",
      author: "Grace Asante (Licensed Maternal Therapist)",
      medicalReviewer: "Dr. Chidimma Okoro",
      lastReviewed: "July 02, 2026",
      readTime: "5 min read",
      sources: ["Maternal Mental Health Global Initiative"],
      content: `Postpartum depression is common and treatable. Symptoms include persistent sadness, anxiety, difficulty bonding with baby, and insomnia. Reaching out for professional care is a sign of strength.`,
    },
  ];

  const toggleBookmark = (id: string) => {
    setBookmarkedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const filteredArticles = articles.filter((art) => {
    const matchesCat = selectedCategory === "All" || art.category === selectedCategory;
    const matchesSearch =
      art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm">
        <div>
          <h2 className="text-2xl font-bold font-display text-[#17131D]">Knowledge Centre</h2>
          <p className="text-xs text-[#6E6875]">Medically reviewed health education & evidence-based guides.</p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#918A98]" />
          <input
            type="text"
            placeholder="Search health topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] rounded-full text-xs font-medium focus:outline-none focus:border-[#6C4CF1]"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${
              selectedCategory === cat
                ? "bg-[#6C4CF1] text-white shadow-md shadow-[#6C4CF1]/20"
                : "bg-white text-[#6E6875] border border-[#E7E2EB] hover:bg-[#F5F2FF] hover:text-[#6C4CF1]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main Content Layout */}
      {activeArticle ? (
        // Detailed Article View
        <div className="bg-white p-6 sm:p-10 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-6 max-w-4xl mx-auto">
          <button
            onClick={() => setActiveArticle(null)}
            className="text-xs font-bold text-[#6C4CF1] hover:underline"
          >
            ← Back to Knowledge Directory
          </button>

          <div className="space-y-4">
            <span className="text-xs font-bold text-[#6C4CF1] bg-[#F5F2FF] px-3 py-1 rounded-full uppercase">
              {activeArticle.category}
            </span>
            <h1 className="text-2xl sm:text-4xl font-extrabold font-display text-[#17131D]">
              {activeArticle.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-[#6E6875] border-y border-[#E7E2EB] py-3">
              <span>Author: <strong className="text-[#17131D]">{activeArticle.author}</strong></span>
              <span>Reviewed By: <strong className="text-[#238A5A]">{activeArticle.medicalReviewer}</strong></span>
              <span>Last Checked: {activeArticle.lastReviewed}</span>
              <span>{activeArticle.readTime}</span>
            </div>
          </div>

          <div className="text-sm text-[#17131D] leading-relaxed whitespace-pre-line space-y-4 font-normal">
            {activeArticle.content}
          </div>

          <div className="p-4 bg-[#F5F2FF] rounded-2xl text-xs space-y-2 border border-[#E8E0FF]">
            <p className="font-bold text-[#6C4CF1]">Sources & Medical Disclaimer:</p>
            <ul className="list-disc list-inside text-[#6E6875] space-y-1">
              {activeArticle.sources.map((s: string, i: number) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            <p className="text-[11px] text-[#918A98] pt-1">
              Obiren articles provide health education and do not replace formal clinical diagnosis by a licensed doctor.
            </p>
          </div>
        </div>
      ) : (
        // Articles Grid
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredArticles.map((art) => {
            const isBookmarked = bookmarkedIds.includes(art.id);
            return (
              <div
                key={art.id}
                className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#6C4CF1] bg-[#F5F2FF] px-2.5 py-1 rounded-full uppercase">
                      {art.category}
                    </span>
                    <button
                      onClick={() => toggleBookmark(art.id)}
                      className={`p-1.5 rounded-full transition-colors ${
                        isBookmarked ? "text-[#6C4CF1] bg-[#F5F2FF]" : "text-[#918A98] hover:text-[#17131D]"
                      }`}
                    >
                      <Bookmark className="w-4 h-4" />
                    </button>
                  </div>

                  <h3
                    onClick={() => setActiveArticle(art)}
                    className="text-lg font-bold font-display text-[#17131D] group-hover:text-[#6C4CF1] cursor-pointer transition-colors leading-snug"
                  >
                    {art.title}
                  </h3>

                  <p className="text-xs text-[#6E6875] leading-relaxed line-clamp-3">
                    {art.summary}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#E7E2EB] flex items-center justify-between text-xs text-[#6E6875]">
                  <span className="flex items-center gap-1 font-semibold text-[#238A5A]">
                    <ShieldCheck className="w-3.5 h-3.5" /> Reviewed
                  </span>
                  <button
                    onClick={() => setActiveArticle(art)}
                    className="font-bold text-[#6C4CF1] hover:underline flex items-center gap-1"
                  >
                    Read Guide <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
