"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FolderLock,
  Lock,
  UploadCloud,
  FileText,
  Trash2,
  Download,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import {
  vaultApi,
  uploadVaultFile,
  ApiError,
  VaultDocument,
} from "@obiren/api-client";

interface HealthVaultViewProps {
  userProfile: any;
}

const CATEGORY_LABELS: Record<string, string> = {
  laboratory_result: "LAB_RESULT",
  prescription: "PRESCRIPTION",
  ultrasound: "ULTRASOUND",
  scan: "SCAN",
  referral: "REFERRAL",
  vaccination: "VACCINATION",
  medical_note: "MEDICAL_NOTE",
  other: "OTHER",
};

export default function HealthVaultView({ userProfile }: HealthVaultViewProps) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const docs = await vaultApi.getDocuments();
      setDocuments(docs ?? []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        setErrorMsg("Health Vault storage is not configured yet. Please contact support.");
      } else {
        setErrorMsg(err instanceof ApiError ? err.message : "Could not load your documents.");
      }
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = ["All", "LAB_RESULT", "PRESCRIPTION", "ULTRASOUND", "VACCINATION", "MEDICAL_NOTE", "OTHER"];

  const handleUpload = async (file: File) => {
    setUploading(true);
    setErrorMsg("");
    setNotice("");
    try {
      // 1) Upload directly to Cloudinary with a server-issued signature
      //    (the API secret never touches the browser).
      const { publicId } = await uploadVaultFile(file);
      // 2) Persist the document metadata against the authenticated user.
      await vaultApi.saveDocument({
        title: file.name.replace(/\.[^.]+$/, "").slice(0, 200) || "Medical Document",
        documentType: "medical_note",
        cloudinaryPublicId: publicId,
        accessLevel: "private",
      });
      setNotice("Document uploaded and encrypted.");
      await load();
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError && err.status === 503
          ? "Health Vault storage is not configured yet. Please contact support."
          : err instanceof ApiError
            ? err.message
            : "Upload failed. Please try again.",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownload = async (doc: VaultDocument) => {
    const id = doc.id || doc._id;
    if (!id) return;
    setActingId(id);
    setErrorMsg("");
    try {
      const { signedDownloadUrl } = await vaultApi.getDownloadUrl(id);
      window.open(signedDownloadUrl, "_blank", "noopener");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Could not generate a secure download link.");
    } finally {
      setActingId(null);
    }
  };

  const handleDelete = async (doc: VaultDocument) => {
    const id = doc.id || doc._id;
    if (!id) return;
    if (!window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    setActingId(id);
    setErrorMsg("");
    try {
      await vaultApi.deleteDocument(id);
      setNotice("Document deleted.");
      await load();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Could not delete the document.");
    } finally {
      setActingId(null);
    }
  };

  const filtered = documents.filter(
    (d) => selectedCategory === "All" || CATEGORY_LABELS[d.documentType] === selectedCategory
  );

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm">
        <div>
          <h2 className="text-2xl font-bold font-display text-[#17131D]">Personal Health Vault</h2>
          <p className="text-xs text-[#6E6875]">Private storage for medical scans, prescriptions & lab results.</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.heic"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="px-5 py-2.5 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white text-xs font-bold rounded-full shadow-md shadow-[#6C4CF1]/20 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {uploading ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <UploadCloud className="w-4 h-4" />
          )}
          <span>{uploading ? "Uploading..." : "Upload Document"}</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-2xl flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {notice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-2xl flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Security Banner */}
      <div className="p-4 bg-[#F5F2FF] rounded-2xl border border-[#E8E0FF] flex items-center gap-3 text-xs text-[#6C4CF1] font-semibold">
        <Lock className="w-4 h-4 shrink-0" />
        <span>
          Private delivery: downloads use short-lived (5-minute) server-signed URLs. Only you can authorize access to your files.
        </span>
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

        {loading ? (
          <div className="text-center py-12 text-sm text-[#6E6875]">Loading your documents...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <FolderLock className="w-12 h-12 text-[#918A98] mx-auto" />
            <p className="text-sm font-bold text-[#17131D]">No Documents Found</p>
            <p className="text-xs text-[#6E6875]">Upload your medical records to keep them safe and accessible anywhere.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((doc) => {
              const id = doc.id || doc._id || "";
              return (
                <div
                  key={id}
                  className="p-4 bg-[#F5F2FF]/60 rounded-2xl border border-[#E8E0FF] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white text-[#6C4CF1] border border-[#E8E0FF] flex items-center justify-center shrink-0 font-bold">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#17131D]">{doc.title}</p>
                      <p className="text-[10px] text-[#6E6875]">
                        {CATEGORY_LABELS[doc.documentType] || doc.documentType} •{" "}
                        {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : "Recently added"} •{" "}
                        {doc.accessLevel}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownload(doc)}
                      disabled={actingId === id}
                      className="p-2 text-[#6C4CF1] hover:bg-white rounded-xl transition-colors disabled:opacity-40"
                      title="Download via secure signed link"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(doc)}
                      disabled={actingId === id}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-40"
                      title="Delete File"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
