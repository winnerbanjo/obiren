"use client";

import { useCallback, useEffect, useState } from "react";
import { LifeBuoy, RefreshCw, Send, X } from "lucide-react";
import { adminApi, ApiError, AdminSupportTicketData } from "@obiren/api-client";
import {
  EmptyState,
  ErrorBanner,
  NoticeBanner,
  StatusPill,
  TableSkeleton,
  formatDateTime,
} from "./admin-ui";

const STATUS_FILTERS = ["all", "open", "in_progress", "resolved", "closed"] as const;
const STATUS_ACTIONS = ["in_progress", "resolved", "closed"] as const;

/**
 * Support queue backed by the real ticket API. Replies are stored with the
 * staff role and the handler is recorded server-side; the admin app never
 * attaches or displays clinical records from a ticket.
 */
export default function AdminSupportView() {
  const [tickets, setTickets] = useState<AdminSupportTicketData[]>([]);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("open");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<AdminSupportTicketData | null>(null);
  const [reply, setReply] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (status = statusFilter) => {
      setLoading(true);
      setErrorMsg("");
      try {
        const data = await adminApi.supportTickets({
          status: status === "all" ? undefined : status,
          limit: 50,
        });
        setTickets(data.tickets ?? []);
      } catch (err) {
        setErrorMsg(
          err instanceof ApiError && err.status === 403
            ? "Your role does not grant access to the support queue."
            : err instanceof ApiError
              ? err.message
              : "Could not load support tickets.",
        );
      } finally {
        setLoading(false);
      }
    },
    [statusFilter],
  );

  useEffect(() => {
    load(statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const update = async (ticket: AdminSupportTicketData, input: { status?: string; reply?: string }) => {
    setSaving(true);
    setErrorMsg("");
    setNotice("");
    try {
      const updated = await adminApi.updateSupportTicket(ticket.id, input);
      setNotice(`Ticket ${ticket.reference} updated.`);
      setSelected({ ...ticket, ...updated });
      setReply("");
      await load(statusFilter);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Could not update the ticket.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm">
        <div>
          <h2 className="text-xl font-bold font-display text-[#17131D]">Support queue</h2>
          <p className="text-xs text-[#6E6875]">
            Cross-account ticket queue. Replies are recorded as support staff; no health record is attached.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as (typeof STATUS_FILTERS)[number])}
            className="px-3 py-2 bg-[#F5F2FF] border border-[#E8E0FF] rounded-full text-xs font-bold text-[#17131D]"
          >
            {STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {status === "all" ? "All statuses" : status.replace(/_/g, " ")}
              </option>
            ))}
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
          <TableSkeleton label="Loading tickets..." />
        ) : tickets.length === 0 ? (
          <EmptyState
            icon={<LifeBuoy className="w-10 h-10" />}
            title="No tickets in this view"
            description="Tickets raised from the user app land here with their account context."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase font-bold text-[#6E6875] border-b border-[#E7E2EB]">
                  <th className="py-2 pr-4">Reference</th>
                  <th className="py-2 pr-4">Subject</th>
                  <th className="py-2 pr-4">Account</th>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Raised</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="border-b border-[#F5F2FF] last:border-0">
                    <td className="py-3 pr-4 font-black text-[#6C4CF1]">{ticket.reference}</td>
                    <td className="py-3 pr-4 font-bold text-[#17131D] max-w-[240px] truncate">{ticket.subject}</td>
                    <td className="py-3 pr-4 text-[#6E6875]">
                      {ticket.user?.displayName || ticket.user?.email || "Unknown account"}
                    </td>
                    <td className="py-3 pr-4 text-[#6E6875] capitalize">{ticket.category}</td>
                    <td className="py-3 pr-4">
                      <StatusPill status={ticket.status} />
                    </td>
                    <td className="py-3 pr-4 text-[#6E6875]">{formatDateTime(ticket.createdAt)}</td>
                    <td className="py-3 pr-4 text-right">
                      <button
                        onClick={() => {
                          setSelected(ticket);
                          setReply("");
                        }}
                        className="px-3 py-1.5 bg-[#F5F2FF] border border-[#E8E0FF] text-[#6C4CF1] rounded-full font-bold"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase font-bold text-[#6E6875]">{selected.reference}</p>
                <h3 className="text-lg font-bold font-display text-[#17131D]">{selected.subject}</h3>
                <p className="text-xs text-[#6E6875]">
                  {selected.user?.displayName || "Unknown"} • {selected.user?.email || "no email"} •{" "}
                  {selected.user?.countryCode || "—"}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-2 rounded-full hover:bg-[#F5F2FF] text-[#6E6875]"
                aria-label="Close ticket"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <StatusPill status={selected.status} />
              <span className="text-[11px] text-[#6E6875] capitalize">{selected.category}</span>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              <div className="p-3 rounded-2xl bg-[#F5F2FF] border border-[#E8E0FF]">
                <p className="text-[10px] font-bold uppercase text-[#6E6875]">Account holder</p>
                <p className="text-xs text-[#17131D] whitespace-pre-wrap">{selected.message}</p>
              </div>
              {(selected.replies || []).map((entry, index) => (
                <div
                  key={`${entry.createdAt}-${index}`}
                  className={`p-3 rounded-2xl border ${
                    entry.authorRole === "support"
                      ? "bg-emerald-50/60 border-emerald-200"
                      : "bg-white border-[#E7E2EB]"
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase text-[#6E6875]">{entry.authorRole}</p>
                  <p className="text-xs text-[#17131D] whitespace-pre-wrap">{entry.body}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-[#6E6875]">Reply as support</label>
              <textarea
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                rows={3}
                maxLength={4000}
                placeholder="Share what was checked. Never include clinical records or other people's data."
                className="w-full p-3 rounded-2xl border border-[#E7E2EB] text-xs focus:outline-none focus:ring-2 focus:ring-[#6C4CF1]/30"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {STATUS_ACTIONS.filter((status) => status !== selected.status).map((status) => (
                  <button
                    key={status}
                    disabled={saving}
                    onClick={() => update(selected, { status })}
                    className="px-3 py-1.5 rounded-full border border-[#E7E2EB] text-[11px] font-bold text-[#17131D] hover:bg-[#F5F2FF] disabled:opacity-40 capitalize"
                  >
                    Mark {status.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
              <button
                disabled={saving || reply.trim().length < 2}
                onClick={() => update(selected, { reply: reply.trim() })}
                className="px-4 py-2 bg-[#6C4CF1] text-white rounded-full text-xs font-bold inline-flex items-center gap-2 disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" /> Send reply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
