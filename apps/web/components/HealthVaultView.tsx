"use client";

import { useState } from "react";
import {
  FolderLock,
  Lock,
  UploadCloud,
  FileText,
  Trash2,
  Download,
  Share2,
  CheckCircle2,
  ShieldCheck,
  Plus,
} from "lucide-react";

interface HealthVaultViewProps {
  userProfile: any;
}

export default function HealthVaultView({ userProfile }: HealthVaultViewProps) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [documents, setDocuments] = useState([
    { id: "doc_1", title: "Pelvic Ultrasound Report", category: "ULTRASOUND", date: "2026-07-10", size: "2.4 MB", mime: "application/pdf" },
    { id: "doc_2", title: "Hormonal Panel Laboratory Blood Test", category: "LAB_RESULT", date: "2026-06-22", size: "1.1 MB", mime: "application/pdf" },
    { id: "doc_3", title: "Gynecology Digital Prescription", category: "PRESCRIPTION", date: "2026-06-05", size: "640 KB", mime: "application/pdf" },
  ]);

  const [uploading, setUploading] = useState(false);

  const categories = ["All", "ULTRASOUND", "LAB_RESULT", "PRESCRIPTION", "VACCINATION", "INSURANCE"];

  const handleSimulatedUpload = () => {
    setUploading(true);
    setTimeout(() => {
      setDocuments((prev) => [
        {
          id: `doc_${Date.now()}`,
          title: "New Encrypted Medical Document",
          category: "LAB_RESULT",
          date: new Date().toISOString().split("T")[0],
          size: "1.8 MB",
          mime: "application/pdf",
        },
        ...prev,
      ]);
      setUploading(false);
    }, 1200);
  };

  const handleDelete = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const filtered = documents.filter(
    (d) => selectedCategory === "All" || d.category === selectedCategory
  );

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm">
        <div>
          <h2 className="text-2xl font-bold font-display text-[#17131D]">Personal Health Vault</h2>
          <p className="text-xs text-[#6E6875]">Private 256-bit encrypted storage for medical scans, prescriptions & lab results.</p>
        </div>

        <button
          onClick={handleSimulatedUpload}
          disabled={uploading}
          className="px-5 py-2.5 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white text-xs font-bold rounded-full shadow-md shadow-[#6C4CF1]/20 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {uploading ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <UploadCloud className="w-4 h-4" />
          )}
          <span>Upload Document</span>
        </button>
      </div>

      {/* Security Banner */}
      <div className="p-4 bg-[#F5F2FF] rounded-2xl border border-[#E8E0FF] flex items-center gap-3 text-xs text-[#6C4CF1] font-semibold">
        <Lock className="w-4 h-4 shrink-0" />
        <span>Signed URL Security Active: Files are encrypted with zero-knowledge keys. Only you can authorize temporary doctor access.</span>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${
              selectedCategory === cat ? "bg-[#6C4CF1] text-white" : "bg-white text-[#6E6875] border border-[#E7E2EB]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Documents List */}
      <div className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-4">
        <h3 className="text-lg font-bold font-display text-[#17131D]">Your Vault Files ({filtered.length})</h3>

        {filtered.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <FolderLock className="w-12 h-12 text-[#918A98] mx-auto" />
            <p className="text-sm font-bold text-[#17131D]">No Documents Found</p>
            <p className="text-xs text-[#6E6875]">Upload your medical records to keep them safe and accessible anywhere.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((doc) => (
              <div
                key={doc.id}
                className="p-4 bg-[#F5F2FF]/60 rounded-2xl border border-[#E8E0FF] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white text-[#6C4CF1] border border-[#E8E0FF] flex items-center justify-center shrink-0 font-bold">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#17131D]">{doc.title}</p>
                    <p className="text-[10px] text-[#6E6875]">
                      {doc.category} • Uploaded {doc.date} • {doc.size}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => alert(`Presigned URL generated for ${doc.title}. Downloading encrypted file...`)}
                    className="p-2 text-[#6C4CF1] hover:bg-white rounded-xl transition-colors"
                    title="Download File"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => alert(`Generated 24-hour temporary access token for doctor sharing.`)}
                    className="p-2 text-[#6C4CF1] hover:bg-white rounded-xl transition-colors"
                    title="Share Access Link"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                    title="Delete File"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
