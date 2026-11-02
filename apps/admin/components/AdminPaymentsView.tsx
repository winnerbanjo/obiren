"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, CreditCard, RefreshCw, Search } from "lucide-react";
import { adminApi, ApiError, AdminPaymentData } from "@obiren/api-client";
import {
  EmptyState,
  ErrorBanner,
  InfoBanner,
  StatusPill,
  TableSkeleton,
  formatDateTime,
  formatMoneyMinor,
} from "./admin-ui";

const STATUSES = ["succeeded", "initialized", "failed", "abandoned"] as const;

/**
 * Payment register. Everything shown is the gateway state the API recorded: a
 * client callback is never proof of payment, and no card data, authorization
 * URL or gateway secret is returned to this screen.
 */
export default function AdminPaymentsView({ activeTabId }: { selectedCountry: string; activeTabId?: string }) {
  const [payments, setPayments] = useState<AdminPaymentData[]>([]);
  const [totals, setTotals] = useState<Array<{ currency: string; amountMinor: number; count: number }>>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [policyPending, setPolicyPending] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const limit = 20;

  const load = useCallback(
    async (targetPage = 1) => {
      setLoading(true);
      setErrorMsg("");
      try {
        const data = await adminApi.listPayments({
          status: statusFilter || undefined,
          q: appliedSearch || undefined,
          page: targetPage,
          limit,
        });
        setPayments(data.payments ?? []);
        setTotals(data.totals ?? []);
        setStatusCounts(data.statusCounts ?? {});
        setPolicyPending(Boolean(data.policyPending));
        setTotal(data.total ?? 0);
        setPage(data.page ?? targetPage);
      } catch (err) {
        setErrorMsg(
          err instanceof ApiError && err.status === 403
            ? "Your role does not grant access to the payment register."
            : err instanceof ApiError
              ? err.message
              : "Could not load payments.",
        );
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, appliedSearch],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const isRefundView = activeTabId === "refunds" || activeTabId === "refund_approvals";

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold font-display text-[#17131D]">
              {isRefundView ? "Refund oversight" : "Payments & revenue"}
            </h2>
            <p className="text-xs text-[#6E6875]">
              {isRefundView
                ? "Refund decisions are made against the booking record. This register shows the gateway state so no refund is assumed."
                : `${total.toLocaleString()} transaction(s) recorded. Totals only include gateway-verified successful payments.`}
            </p>
          </div>
          <button
            onClick={() => load(page)}
            className="px-4 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] text-[#6C4CF1] text-xs font-bold rounded-full inline-flex items-center gap-2 self-start"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["", ...STATUSES] as const).map((status) => (
            <button
              key={status || "all"}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold border capitalize ${
                statusFilter === status
                  ? "bg-[#6C4CF1] text-white border-[#6C4CF1]"
                  : "bg-white text-[#17131D] border-[#E7E2EB]"
              }`}
            >
              {status ? `${status} (${statusCounts[status] ?? 0})` : `All (${total})`}
            </button>
          ))}
          <div className="flex items-center gap-1.5 flex-1 min-w-[200px] px-3 py-2 rounded-full border border-[#E7E2EB]">
            <Search className="w-3.5 h-3.5 text-[#918A98]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") setAppliedSearch(search.trim());
              }}
              placeholder="Reference, patient or doctor"
              className="w-full bg-transparent text-xs focus:outline-none"
            />
          </div>
          <button
            onClick={() => setAppliedSearch(search.trim())}
            className="px-4 py-2 bg-[#17131D] text-white rounded-full text-xs font-bold"
          >
            Search
          </button>
        </div>
      </div>

      {policyPending ? (
        <InfoBanner message="No approved payment policy or live gateway is configured on this environment. Rows below are recorded gateway attempts, not proof that money moved." />
      ) : null}

      <ErrorBanner message={errorMsg} />

      {totals.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {totals.map((row) => (
            <div key={row.currency} className="bg-white p-5 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-1">
              <p className="text-[10px] uppercase font-bold text-[#6E6875]">Verified {row.currency}</p>
              <p className="text-2xl font-black font-display text-[#17131D]">
                {formatMoneyMinor(row.amountMinor, row.currency)}
              </p>
              <p className="text-[11px] font-semibold text-[#6E6875]">{row.count} successful payment(s)</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-4">
        {loading ? (
          <TableSkeleton label="Loading payments..." />
        ) : payments.length === 0 ? (
          <EmptyState
            icon={<CreditCard className="w-10 h-10" />}
            title="No payments recorded"
            description="Checkout attempts appear here once the payment policy is approved and a gateway is configured."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase font-bold text-[#6E6875] border-b border-[#E7E2EB]">
                  <th className="py-2 pr-4">Reference</th>
                  <th className="py-2 pr-4">Patient</th>
                  <th className="py-2 pr-4">Doctor</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Gateway</th>
                  <th className="py-2 pr-4">Booking</th>
                  <th className="py-2 pr-4">Verified</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-[#F5F2FF] last:border-0">
                    <td className="py-3 pr-4 font-mono text-[10px] text-[#6E6875]">{payment.reference}</td>
                    <td className="py-3 pr-4">
                      <p className="font-bold text-[#17131D]">{payment.patient.displayName}</p>
                      <p className="text-[10px] text-[#6E6875]">{payment.patient.email || "—"}</p>
                    </td>
                    <td className="py-3 pr-4 text-[#6E6875]">{payment.doctor.displayName}</td>
                    <td className="py-3 pr-4 font-bold text-[#17131D]">
                      {formatMoneyMinor(payment.amountMinor, payment.currency)}
                    </td>
                    <td className="py-3 pr-4 text-[#6E6875] capitalize">{payment.gateway}</td>
                    <td className="py-3 pr-4">
                      <StatusPill status={payment.bookingStatus || "unknown"} />
                    </td>
                    <td className="py-3 pr-4 text-[#6E6875]">{formatDateTime(payment.verifiedAt)}</td>
                    <td className="py-3 pr-4">
                      <StatusPill status={payment.status} />
                      {payment.failureReason ? (
                        <p className="text-[10px] text-red-600 mt-1 max-w-[180px]">{payment.failureReason}</p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-[#E7E2EB]">
            <button
              onClick={() => load(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 text-xs font-bold text-[#6C4CF1] disabled:opacity-30 inline-flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <span className="text-xs font-bold text-[#6E6875]">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => load(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-xs font-bold text-[#6C4CF1] disabled:opacity-30 inline-flex items-center gap-1"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
