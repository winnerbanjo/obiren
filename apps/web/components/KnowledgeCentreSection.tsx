"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Video, FileText, HeartPulse, CheckCircle2, ArrowRight } from "lucide-react";

interface KnowledgeCentreProps {
  onOpenWaitlist: () => void;
}

export default function KnowledgeCentreSection({ onOpenWaitlist }: KnowledgeCentreProps) {
  const [activeCategory, setActiveCategory] = useState("Fibroids & PCOS");

  const categories = [
    "Menstruation & Cycle",
    "Pregnancy & Birth",
    "Fibroids & PCOS",
    "Endometriosis",
    "Breast Health",
    "Mental Wellness",
    "Sexual Health",
  ];

  const contentItems = [
    {
      title: "Understanding Uterine Fibroids: Symptoms, Diagnosis & Treatment Options",
      category: "Fibroids & PCOS",
      type: "Medical Article",
      author: "Dr. Amina Bello (Obstetrician & Gynecologist)",
      readTime: "6 min read",
      summary:
        "Uterine fibroids affect up to 70% of African women by age 50. Learn about non-invasive procedures, dietary adjustments, and when to see a specialist.",
    },
    {
      title: "PCOS & Insulin Resistance: Managing Symptoms Through Nutrition",
      category: "Fibroids & PCOS",
      type: "Nutritional Guide",
      author: "Khadijah Vance (Maternal Nutritionist)",
      readTime: "8 min read",
      summary:
        "Polycystic Ovary Syndrome (PCOS) can disrupt ovulatory regularity. Discover evidence-based nutrition protocols tailored for traditional African diets.",
    },
    {
      title: "Postpartum Depression: Recognizing Early Signs & Finding Care",
      category: "Mental Wellness",
      type: "Clinical Article",
      author: "Grace Asante (Licensed Maternal Therapist)",
      readTime: "5 min read",
      summary:
        "Hormonal shifts after birth can trigger anxiety or mood swings. Learn how to identify symptoms early and connect with qualified maternal counselors.",
    },
  ];

  return (
    <section id="education" className="py-24 bg-[#FBFAFD] relative border-t border-[#E8DFFF]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Section Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#F4F1FF] text-[#6D4AFF] rounded-full text-xs font-bold uppercase tracking-wider">
            <BookOpen className="w-3.5 h-3.5" /> Evidence-Based Knowledge
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#171717] font-display tracking-tight leading-tight">
            Health literacy <span className="purple-gradient-text">reviewed by doctors.</span>
          </h2>

          <p className="text-base sm:text-lg text-[#666666] leading-relaxed">
            Obiren delivers trusted health education tailored for African women in Nigeria, Ghana, the UK, and the US.
          </p>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center justify-center gap-2 overflow-x-auto pb-4 no-scrollbar max-w-4xl mx-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                activeCategory === cat
                  ? "bg-[#6D4AFF] text-white shadow-md shadow-[#6D4AFF]/20"
                  : "bg-white text-[#666666] border border-[#E8DFFF] hover:bg-[#F4F1FF] hover:text-[#6D4AFF]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Article Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {contentItems.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="bg-white rounded-3xl p-8 border border-[#E8DFFF] shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[#6D4AFF] bg-[#F4F1FF] px-3 py-1 rounded-full uppercase">
                    {item.category}
                  </span>
                  <span className="text-[#666666] font-medium">{item.readTime}</span>
                </div>

                <h3 className="text-lg font-bold font-display text-[#171717] group-hover:text-[#6D4AFF] transition-colors leading-snug">
                  {item.title}
                </h3>

                <p className="text-xs text-[#666666] leading-relaxed">
                  {item.summary}
                </p>
              </div>

              <div className="pt-4 border-t border-[#F4F1FF] flex items-center justify-between text-xs text-[#666666]">
                <span className="font-semibold text-[#38B26C] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Reviewed
                </span>

                <button
                  onClick={onOpenWaitlist}
                  className="font-bold text-[#6D4AFF] hover:underline flex items-center gap-1"
                >
                  Read Article <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
