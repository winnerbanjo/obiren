"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, FileCheck, Plus, RefreshCw, X } from "lucide-react";
import { adminApi, ApiError, AdminArticleData } from "@obiren/api-client";
import { EmptyState, ErrorBanner, NoticeBanner, StatusPill, TableSkeleton, formatDateTime } from "./admin-ui";

interface AdminCMSViewProps {
  selectedCountry: string;
  activeTabId?: string;
}

const CATEGORIES = [
  "Cycle health",
  "Pregnancy",
  "Fertility",
  "Mental wellness",
  "Conditions",
  "Care & support",
  "Safety",
];

const EMPTY_DRAFT = {
  slug: "",
  title: "",
  summary: "",
  body: "",
  category: CATEGORIES[0],
  tags: "",
};

/**
 * Knowledge CMS. Content is versioned and gated: a doctor-facing publish is
 * rejected by the API until a medical reviewer approves the current version
 * with an evidence reference. Nothing is published from the browser alone.
 */
export default function AdminCMSView({ activeTabId }: AdminCMSViewProps) {
  const reviewMode = activeTabId === "medical_reviews";
  const [articles, setArticles] = useState<AdminArticleData[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [notice, setNotice] = useState("");
  const [draftOpen, setDraftOpen] = useState(false);
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [reviewTarget, setReviewTarget] = useState<AdminArticleData | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async (status = statusFilter) => {
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await adminApi.listArticles({ status: status || undefined, limit: 50 });
      setArticles(data.articles ?? []);
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError && err.status === 403
          ? "Your role does not grant access to content management."
          : err instanceof ApiError
            ? err.message
            : "Could not load content.",
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load(statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const rows = reviewMode
    ? articles.filter((article) => article.medicalReviewStatus !== "approved" || article.status !== "published")
    : articles;

  const createDraft = async () => {
    setSaving(true);
    setFormError("");
    try {
      await adminApi.createArticle({
        slug: draft.slug.trim().toLowerCase(),
        title: draft.title.trim(),
        summary: draft.summary.trim(),
        body: draft.body.trim(),
        category: draft.category,
        tags: draft.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      setDraftOpen(false);
      setDraft({ ...EMPTY_DRAFT });
      setNotice("Draft created with medical review pending.");
      await load(statusFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not create the draft.");
    } finally {
      setSaving(false);
    }
  };

  const act = async (article: AdminArticleData, action: "publish" | "archive") => {
    setActingId(article.id);
    setErrorMsg("");
    setNotice("");
    try {
      if (action === "publish") await adminApi.publishArticle(article.id);
      else await adminApi.archiveArticle(article.id);
      setNotice(`"${article.title}" ${action === "publish" ? "published" : "archived"}.`);
      await load(statusFilter);
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : `Could not ${action} the article.`,
      );
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm">
        <div>
          <h2 className="text-xl font-bold font-display text-[#17131D]">
            {reviewMode ? "Medical reviews" : "Knowledge CMS"}
          </h2>
          <p className="text-xs text-[#6E6875]">
            {reviewMode
              ? "Content awaiting clinical approval. Publishing is refused until the current version is approved with evidence."
              : "Versioned educational content. Editing a published article resets it to draft and requires a new medical review."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!reviewMode ? (
            <button
              onClick={() => setDraftOpen(true)}
              className="px-4 py-2.5 bg-[#6C4CF1] text-white text-xs font-bold rounded-full inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> New article
            </button>
          ) : null}
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="px-3 py-2 bg-[#F5F2FF] border border-[#E8E0FF] rounded-full text-xs font-bold text-[#17131D] capitalize"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <button
            onClick={() => load(statusFilter)}
            className="px-4 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] text-[#6C4CF1] text-xs font-bold rounded-full inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      <ErrorBanner message={errorMsg} />
      <NoticeBanner message={notice} />

      <div className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm">
        {loading ? (
          <TableSkeleton label="Loading content..." />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={reviewMode ? <FileCheck className="w-10 h-10" /> : <BookOpen className="w-10 h-10" />}
            title={reviewMode ? "No content waiting for review" : "No articles yet"}
            description={
              reviewMode
                ? "New and edited articles appear here until a medical reviewer approves them."
                : "Create a draft, then record a medical review before publishing."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase font-bold text-[#6E6875] border-b border-[#E7E2EB]">
                  <th className="py-2 pr-4">Title</th>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Version</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Medical review</th>
                  <th className="py-2 pr-4">Published</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((article) => (
                  <tr key={article.id} className="border-b border-[#F5F2FF] last:border-0 align-top">
                    <td className="py-3 pr-4 max-w-[320px]">
                      <p className="font-bold text-[#17131D]">{article.title}</p>
                      <p className="text-[10px] text-[#6E6875] font-mono">{article.slug}</p>
                      <p className="text-[11px] text-[#6E6875] line-clamp-2">{article.summary}</p>
                    </td>
                    <td className="py-3 pr-4 text-[#6E6875]">{article.category}</td>
                    <td className="py-3 pr-4 text-[#6E6875]">v{article.version}</td>
                    <td className="py-3 pr-4">
                      <StatusPill status={article.status} />
                    </td>
                    <td className="py-3 pr-4">
                      <StatusPill status={article.medicalReviewStatus} />
                    </td>
                    <td className="py-3 pr-4 text-[#6E6875]">{formatDateTime(article.publishedAt)}</td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button
                          onClick={() => setReviewTarget(article)}
                          className="px-2.5 py-1.5 bg-[#F5F2FF] border border-[#E8E0FF] text-[#6C4CF1] rounded-full font-bold"
                        >
                          Review
                        </button>
                        <button
                          onClick={() => act(article, "publish")}
                          disabled={actingId === article.id || article.medicalReviewStatus !== "approved"}
                          className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full font-bold disabled:opacity-40"
                          title={
                            article.medicalReviewStatus === "approved"
                              ? "Publish"
                              : "Requires an approved medical review"
                          }
                        >
                          Publish
                        </button>
                        <button
                          onClick={() => act(article, "archive")}
                          disabled={actingId === article.id || article.status === "archived"}
                          className="px-2.5 py-1.5 bg-white border border-[#E7E2EB] text-[#6E6875] rounded-full font-bold disabled:opacity-40"
                        >
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {draftOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold text-[#6E6875]">New draft</p>
                <h3 className="text-lg font-bold font-display text-[#17131D]">Create article</h3>
              </div>
              <button
                onClick={() => setDraftOpen(false)}
                className="p-2 rounded-full hover:bg-[#F5F2FF] text-[#6E6875]"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Title">
                <input
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  maxLength={200}
                  className="field"
                />
              </Field>
              <Field label="Slug">
                <input
                  value={draft.slug}
                  onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
                  maxLength={120}
                  placeholder="understanding-pcos"
                  className="field"
                />
              </Field>
              <Field label="Category">
                <select
                  value={draft.category}
                  onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                  className="field"
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tags (comma separated)">
                <input
                  value={draft.tags}
                  onChange={(event) => setDraft({ ...draft, tags: event.target.value })}
                  className="field"
                />
              </Field>
            </div>

            <Field label="Summary">
              <textarea
                value={draft.summary}
                onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
                rows={2}
                maxLength={600}
                className="field"
              />
            </Field>
            <Field label="Body">
              <textarea
                value={draft.body}
                onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                rows={8}
                maxLength={50000}
                className="field"
              />
            </Field>

            {formError ? <ErrorBanner message={formError} /> : null}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDraftOpen(false)}
                className="px-4 py-2 rounded-full text-xs font-bold text-[#6E6875] hover:bg-[#F5F2FF]"
              >
                Cancel
              </button>
              <button
                onClick={createDraft}
                disabled={
                  saving ||
                  draft.title.trim().length < 3 ||
                  !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug.trim().toLowerCase()) ||
                  draft.summary.trim().length < 10 ||
                  draft.body.trim().length < 20
                }
                className="px-4 py-2 bg-[#6C4CF1] text-white rounded-full text-xs font-bold disabled:opacity-40"
              >
                {saving ? "Saving..." : "Create draft"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reviewTarget ? (
        <ReviewArticleDialog
          article={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onSaved={async (message) => {
            setReviewTarget(null);
            setNotice(message);
            await load(statusFilter);
          }}
        />
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-bold uppercase text-[#6E6875]">{label}</span>
      {children}
    </label>
  );
}

function ReviewArticleDialog({
  article,
  onClose,
  onSaved,
}: {
  article: AdminArticleData;
  onClose: () => void;
  onSaved: (message: string) => void | Promise<void>;
}) {
  const [decision, setDecision] = useState<"approved" | "rejected" | "pending">(article.medicalReviewStatus);
  const [evidenceRef, setEvidenceRef] = useState(article.reviewEvidenceRef || "");
  const [note, setNote] = useState(article.reviewNote || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await adminApi.reviewArticle(article.id, {
        medicalReviewStatus: decision,
        reviewEvidenceRef: evidenceRef.trim() || undefined,
        reviewNote: note.trim() || undefined,
      });
      await onSaved(`Medical review recorded for "${article.title}".`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record the review.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase font-bold text-[#6E6875]">Medical review • v{article.version}</p>
            <h3 className="text-lg font-bold font-display text-[#17131D]">{article.title}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[#F5F2FF] text-[#6E6875]" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 rounded-2xl bg-[#F5F2FF] border border-[#E8E0FF] max-h-40 overflow-y-auto">
          <p className="text-[11px] text-[#17131D] whitespace-pre-wrap">{article.body || article.summary}</p>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-[#6E6875]">Decision</label>
          <div className="flex gap-1.5">
            {(["approved", "rejected", "pending"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setDecision(value)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold border capitalize ${
                  decision === value
                    ? "bg-[#6C4CF1] text-white border-[#6C4CF1]"
                    : "bg-white text-[#17131D] border-[#E7E2EB]"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-[#6E6875]">Evidence reference</label>
          <input
            value={evidenceRef}
            onChange={(event) => setEvidenceRef(event.target.value)}
            maxLength={300}
            placeholder="Reviewer sign-off, document version or case reference"
            className="w-full p-3 rounded-2xl border border-[#E7E2EB] text-xs focus:outline-none focus:ring-2 focus:ring-[#6C4CF1]/30"
          />
          <p className="text-[10px] text-[#6E6875]">Required for approval.</p>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-[#6E6875]">Review note</label>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={500}
            className="w-full p-3 rounded-2xl border border-[#E7E2EB] text-xs focus:outline-none focus:ring-2 focus:ring-[#6C4CF1]/30"
          />
        </div>

        {error ? <ErrorBanner message={error} /> : null}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-full text-xs font-bold text-[#6E6875] hover:bg-[#F5F2FF]">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || (decision === "approved" && evidenceRef.trim().length < 3)}
            className="px-4 py-2 bg-[#6C4CF1] text-white rounded-full text-xs font-bold disabled:opacity-40"
          >
            {saving ? "Saving..." : "Record review"}
          </button>
        </div>
      </div>
    </div>
  );
}
