"use client";

import { useState } from "react";
import {
  CreditCard,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  X,
  FileText,
} from "lucide-react";

interface AdminPaymentsViewProps {
  selectedCountry: string;
}

export default function AdminPaymentsView({ selectedCountry }: AdminPaymentsViewProps) {
  const [payments, setPayments] = useState([
    {
      id: "tx-9011",
      user: "Ella Vance",
      doctor: "Dr. Amina Bello",
      country: "NG",
      flag: "🇳🇬",
      amount: "₦25,000",
      provider: "Paystack",
      type: "Doctor Consultation",
      status: "SUCCESSFUL",
      date: "2026-07-22",
    },
    {
      id: "tx-9012",
      user: "Chloe Vance",
      doctor: "Dr. Sarah Jenkins",
      country: "GB",
      flag: "🇬🇧",
      amount: "£120.00",
      provider: "Stripe",
      type: "Telegynecology Beta",
      status: "SUCCESSFUL",
      date: "2026-07-21",
    },
    {
      id: "tx-9013",
      user: "Amara Okafor",
      doctor: "Khadijah Vance",
      country: "NG",
      flag: "🇳🇬",
      amount: "₦15,000",
      provider: "Flutterwave",
      type: "Nutrition Plan",
      status: "REFUND_REQUESTED",
      date: "2026-07-20",
    },
  ]);

  const [selectedRefund, setSelectedRefund] = useState<any | null>(null);
  const [refundReason, setRefundReason] = useState("");

  const filteredPayments = payments.filter(
    (p) => selectedCountry === "ALL" || p.country === selectedCountry
  );

  const handleProcessRefund = () => {
    if (!refundReason) {
      alert("Please state a refund processing reason.");
      return;
    }
    setPayments((prev) =>
      prev.map((p) => (p.id === selectedRefund.id ? { ...p, status: "REFUNDED" } : p))
    );
    alert(`Refund processed for ${selectedRefund.id}. Reason: "${refundReason}". Audit Log generated.`);
    setSelectedRefund(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm">
        <div>
          <h2 className="text-2xl font-bold font-display text-[#17131D]">Payment Transactions & Refund Approvals</h2>
          <p className="text-xs text-[#6E6875]">Manage consultation revenue settlement across Paystack, Stripe & Flutterwave gateways.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#F5F2FF] rounded-2xl text-xs border border-[#E8E0FF]">
            <span className="text-[10px] uppercase font-bold text-[#6E6875] block">Total Platform Settlement</span>
            <span className="font-extrabold text-[#6C4CF1] text-base">₦14.2M / £38.5K / $42.1K</span>
          </div>
        </div>
      </div>

      {/* Financial Transactions Table */}
      <div className="bg-white rounded-3xl border border-[#E7E2EB] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#F5F2FF]/60 border-b border-[#E7E2EB] text-[#6E6875] uppercase text-[10px] font-bold tracking-wider">
                <th className="py-4 px-4">Transaction ID</th>
                <th className="py-4 px-4">User</th>
                <th className="py-4 px-4">Doctor / Provider</th>
                <th className="py-4 px-4">Market</th>
                <th className="py-4 px-4">Amount</th>
                <th className="py-4 px-4">Gateway</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E2EB]">
              {filteredPayments.map((p) => (
                <tr key={p.id} className="hover:bg-[#F5F2FF]/30 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-[#17131D]">{p.id}</td>
                  <td className="py-3.5 px-4 font-semibold text-[#17131D]">{p.user}</td>
                  <td className="py-3.5 px-4 text-[#6E6875]">{p.doctor}</td>

                  <td className="py-3.5 px-4 font-bold text-[#17131D]">
                    <span className="text-base mr-1">{p.flag}</span>
                    <span>{p.country}</span>
                  </td>

                  <td className="py-3.5 px-4 font-black text-[#17131D]">{p.amount}</td>
                  <td className="py-3.5 px-4 font-bold text-[#6C4CF1]">{p.provider}</td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                        p.status === "SUCCESSFUL"
                          ? "bg-emerald-50 text-[#238A5A] border border-emerald-200"
                          : p.status === "REFUND_REQUESTED"
                          ? "bg-amber-50 text-[#B87512] border border-amber-200"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    {p.status === "REFUND_REQUESTED" ? (
                      <button
                        onClick={() => {
                          setSelectedRefund(p);
                          setRefundReason("");
                        }}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-lg shadow-sm"
                      >
                        Process Refund
                      </button>
                    ) : (
                      <span className="text-[10px] text-[#6E6875] font-bold">Settled</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Refund Processing Modal */}
      {selectedRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h4 className="text-lg font-bold font-display text-[#17131D]">Process Approved Refund</h4>
              <button onClick={() => setSelectedRefund(null)}><X className="w-5 h-5 text-[#6E6875]" /></button>
            </div>

            <div className="p-3 bg-[#F5F2FF] rounded-2xl text-xs space-y-1">
              <p className="text-[#17131D]">Transaction ID: <strong className="font-mono">{selectedRefund.id}</strong></p>
              <p className="text-[#17131D]">Amount: <strong>{selectedRefund.amount}</strong> ({selectedRefund.provider})</p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase text-[#6E6875]">Refund Reason Note (Required)</label>
              <input
                type="text"
                required
                placeholder="e.g. Appointment cancelled by professional within 24h window..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full px-3 py-2 bg-[#F5F2FF] border border-[#E8E0FF] rounded-xl text-xs"
              />
            </div>

            <button
              onClick={handleProcessRefund}
              className="w-full py-3 bg-[#6C4CF1] text-white font-bold text-xs rounded-full shadow-md"
            >
              Approve & Dispatch Refund to {selectedRefund.provider}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
