"use client";

import { useState, useEffect } from "react";
import {
  BookOpen,
  Plus,
  FileCheck,
  CheckCircle2,
  Clock,
  Eye,
  X,
  FileText,
  UserCheck,
} from "lucide-react";

interface AdminCMSViewProps {
  selectedCountry: string;
  activeTabId?: string;
}

export default function AdminCMSView({ selectedCountry, activeTabId }: AdminCMSViewProps) {
  let defaultTab: "knowledge" | "medical_reviews" = "knowledge";
  if (activeTabId === "medical_reviews") defaultTab = "medical_reviews";

  const [activeTab, setActiveTab] = useState<"knowledge" | "medical_reviews">(defaultTab);

  useEffect(() => {
    if (activeTabId === "knowledge") setActiveTab("knowledge");
    else if (activeTabId === "medical_reviews") setActiveTab("medical_reviews");
  }, [activeTabId]);

  const [articles, setArticles] = useState([
    {
      id: "art-1",
      title: "Understanding Uterine Fibroids: Symptoms, Diagnosis & Treatment",
      category: "Fibroids & PCOS",
      country: "NG",
      flag: "🇳🇬",
      author: "Khadijah Vance",
      reviewer: "Dr. Amina Bello (Gynecologist)",
      status: "PUBLISHED",
      readTime: "6 min",
      viewsCount: "14,290",
      content: "Uterine fibroids affect up to 70% of African women by age 50...",
    },
    {
      id: "art-2",
      title: "PCOS & Insulin Resistance: Managing Symptoms Through African Diets",
      category: "Fibroids & PCOS",
      country: "NG",
      flag: "🇳🇬",
      author: "Khadijah Vance",
      reviewer: "Dr. Amina Bello (Gynecologist)",
      status: "PUBLISHED",
      readTime: "8 min",
      viewsCount: "9,810",
      content: "Polycystic Ovary Syndrome (PCOS) can disrupt ovulatory regularity...",
    },
    {
      id: "art-3",
      title: "Postpartum Depression: Recognizing Early Signs & Finding Care",
      category: "Mental Wellness",
      country: "GB",
      flag: "🇬🇧",
      author: "Grace Asante",
      reviewer: "Dr. Sarah Jenkins (MRCOG)",
      status: "UNDER_MEDICAL_REVIEW",
      readTime: "5 min",
      viewsCount: "1,200",
      content: "Hormonal shifts after birth can trigger anxiety or mood swings...",
    },
  ]);

  const [showEditor, setShowEditor] = useState(false);
  const [newArticle, setNewArticle] = useState({
    title: "",
    category: "Fibroids & PCOS",
    country: "NG",
    summary: "",
    content: "",
    reviewer: "Dr. Amina Bello",
  });

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    setArticles([
      ...articles,
      {
        id: `art_${Date.now()}`,
        title: newArticle.title,
        category: newArticle.category,
        country: newArticle.country,
        flag: newArticle.country === "NG" ? "🇳🇬" : newArticle.country === "GB" ? "🇬🇧" : "🇺🇸",
        author: "Obiren Content Team",
        reviewer: newArticle.reviewer,
        status: "UNDER_MEDICAL_REVIEW",
        readTime: "5 min",
        viewsCount: "0",
        content: newArticle.content,
      },
    ]);
    setShowEditor(false);
    alert("Article submitted to Medical Reviewer queue!");
  };

  const approveMedicalReview = (id: string) => {
    setArticles((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "PUBLISHED" } : a))
    );
    alert("Medical Review Approved! Article is now live across web & mobile apps.");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E7E2EB] pb-4">
        <button
          onClick={() => setActiveTab("knowledge")}
          className={`px-4 py-2 text-xs font-bold rounded-full transition-colors flex items-center gap-1.5 ${
            activeTab === "knowledge" ? "bg-[#17131D] text-white shadow-md" : "text-[#6E6875] hover:bg-[#F5F2FF]"
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Knowledge CMS
        </button>
        <button
          onClick={() => setActiveTab("medical_reviews")}
          className={`px-4 py-2 text-xs font-bold rounded-full transition-colors flex items-center gap-1.5 ${
            activeTab === "medical_reviews" ? "bg-[#17131D] text-white shadow-md" : "text-[#6E6875] hover:bg-[#F5F2FF]"
          }`}
        >
          <FileCheck className="w-3.5 h-3.5" />
          Medical Reviews
          {articles.some(a => a.status === "UNDER_MEDICAL_REVIEW") && (
            <span className="w-2 h-2 rounded-full bg-rose-500" />
          )}
        </button>
      </div>

      {activeTab === "knowledge" && (
        <>
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm">
            <div>
              <h2 className="text-2xl font-bold font-display text-[#17131D]">Knowledge Centre CMS</h2>
              <p className="text-xs text-[#6E6875]">Author evidence-based medical articles and enforce gynecologist review approval workflows.</p>
            </div>

            <button
              onClick={() => setShowEditor(true)}
              className="px-5 py-2.5 bg-[#6C4CF1] text-white text-xs font-bold rounded-full shadow-md flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" /> Draft New Article
            </button>
          </div>

          {/* Articles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {articles.map((art) => (
              <div key={art.id} className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-[#6C4CF1] bg-[#F5F2FF] px-2.5 py-0.5 rounded-full uppercase text-[10px]">
                      {art.category}
                    </span>
                    <span className="font-bold">{art.flag} {art.country}</span>
                  </div>

                  <h3 className="text-base font-bold font-display text-[#17131D] leading-snug">{art.title}</h3>
                  <p className="text-xs text-[#6E6875] line-clamp-2">{art.content}</p>
                </div>

                <div className="space-y-3 pt-3 border-t border-[#E7E2EB] text-xs">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#6E6875]">Medical Reviewer:</span>
                    <span className="font-bold text-[#17131D] truncate">{art.reviewer}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                        art.status === "PUBLISHED"
                          ? "bg-emerald-50 text-[#238A5A] border border-emerald-200"
                          : "bg-amber-50 text-[#B87512] border border-amber-200"
                      }`}
                    >
                      {art.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === "medical_reviews" && (
        <div className="bg-white rounded-3xl border border-[#E7E2EB] shadow-sm overflow-hidden p-6 space-y-6">
          <div>
            <h2 className="text-2xl font-bold font-display text-[#17131D]">Medical Review Approvals Queue</h2>
            <p className="text-xs text-[#6E6875]">Clinical specialists must sign off on content before it goes live to the public.</p>
          </div>
          
          <div className="space-y-4">
            {articles.filter(a => a.status === "UNDER_MEDICAL_REVIEW").map((art) => (
              <div key={art.id} className="p-4 bg-white rounded-2xl border border-[#E8E0FF] flex justify-between items-center hover:border-[#6C4CF1] transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-[#F5F2FF] rounded-lg text-[#6D4AFF]">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#17131D] text-sm">{art.title}</h4>
                    <p className="text-xs text-[#6E6875] mt-0.5">Author: {art.author} • Assigned to: {art.reviewer}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => approveMedicalReview(art.id)} className="px-4 py-2 bg-[#238A5A] text-white text-xs font-bold rounded-full shadow-md">Sign Off & Publish</button>
                </div>
              </div>
            ))}
            
            {articles.filter(a => a.status === "UNDER_MEDICAL_REVIEW").length === 0 && (
              <div className="p-8 text-center bg-[#F5F2FF]/50 rounded-2xl border border-dashed border-[#E8E0FF]">
                <CheckCircle2 className="w-8 h-8 text-[#6D4AFF] mx-auto mb-2 opacity-50" />
                <p className="text-xs font-bold text-[#6E6875]">No pending reviews in the queue.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Article Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-xl space-y-4 shadow-2xl border border-[#E7E2EB] my-8">
            <div className="flex justify-between items-center border-b border-[#E7E2EB] pb-3">
              <h3 className="text-xl font-bold font-display text-[#17131D]">Draft Knowledge Centre Article</h3>
              <button onClick={() => setShowEditor(false)}><X className="w-5 h-5 text-[#6E6875]" /></button>
            </div>

            <form onSubmit={handlePublish} className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-[#6E6875] mb-1">Article Title</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Managing Endometriosis Symptoms Naturally"
                  value={newArticle.title}
                  onChange={(e) => setNewArticle({ ...newArticle, title: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] rounded-xl text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase text-[#6E6875] mb-1">Category</label>
                  <select
                    value={newArticle.category}
                    onChange={(e) => setNewArticle({ ...newArticle, category: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] rounded-xl text-xs font-bold"
                  >
                    <option value="Fibroids & PCOS">Fibroids & PCOS</option>
                    <option value="Menstruation & Cycle">Menstruation & Cycle</option>
                    <option value="Pregnancy & Birth">Pregnancy & Birth</option>
                    <option value="Mental Wellness">Mental Wellness</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#6E6875] mb-1">Assigned Medical Reviewer</label>
                  <select
                    value={newArticle.reviewer}
                    onChange={(e) => setNewArticle({ ...newArticle, reviewer: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] rounded-xl text-xs font-bold"
                  >
                    <option value="Dr. Amina Bello">Dr. Amina Bello (FMCOG)</option>
                    <option value="Dr. Sarah Jenkins">Dr. Sarah Jenkins (MRCOG)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#6E6875] mb-1">Article Content</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Write medically referenced guidance..."
                  value={newArticle.content}
                  onChange={(e) => setNewArticle({ ...newArticle, content: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] rounded-xl text-xs font-medium"
                />
              </div>

              <button type="submit" className="w-full py-3 bg-[#6C4CF1] text-white font-bold text-xs rounded-full shadow-md">
                Submit for Medical Review
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
