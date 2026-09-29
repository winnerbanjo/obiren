"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, RefreshCw, AlertTriangle, CheckCircle2, Ban, ChevronLeft, ChevronRight } from "lucide-react";
import { adminApi, ApiError } from "@obiren/api-client";

interface AdminUsersViewProps {
  selectedCountry: string;
  activeTabId: string;
}

/**
 * The Users tab lists REAL registered users straight from the API and can
 * change account status (suspend/restrict/reinstate) with server-side
 * authorization. Other sub-tabs (support tickets, notifications) do not have
 * real backend functionality yet, so they render an honest unavailable state
 * instead of fake data.
 */
export default function AdminUsersView({ selectedCountry, activeTabId }: AdminUsersViewProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [notice, setNotice] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const limit = 20;

  const isUsersTab = activeTabId === "users";

  const load = useCallback(
    async (p: number) => {
      if (!isUsersTab) return;
      setLoading(true);
      setErrorMsg("");
      try {
        const data = await adminApi.listUsers(p, limit);
        setUsers(data.users ?? []);
        setTotal(data.total ?? 0);
        setPage(data.page ?? p);
      } catch (err) {
        setErrorMsg(
          err instanceof ApiError && err.status === 403
            ? "Your role does not grant access to user management."
            : err instanceof ApiError
              ? err.message
              : "Could not load users.",
        );
      } finally {
        setLoading(false);
      }
    },
    [isUsersTab],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  const setStatus = async (userId: string, status: string) => {
    setActingId(userId);
    setErrorMsg("");
    setNotice("");
    try {
      await adminApi.setUserStatus(userId, status);
      setNotice(`User status updated to "${status}".`);
      await load(page);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Could not update the user.");
    } finally {
      setActingId(null);
    }
  };

  if (!isUsersTab) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="bg-white p-10 rounded-3xl border border-[#E7E2EB] shadow-sm text-center space-y-3">
          <Users className="w-10 h-10 text-[#918A98] mx-auto" />
          <h3 className="text-lg font-bold font-display text-[#17131D]">Coming soon</h3>
          <p className="text-xs text-[#6E6875] max-w-md mx-auto">
            The <strong>{activeTabId.replace(/_/g, " ")}</strong> module is not implemented in the backend yet.
            Rather than showing simulated data, this screen will light up once the corresponding API exists.
          </p>
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm">
        <div>
          <h2 className="text-xl font-bold font-display text-[#17131D]">Registered Users</h2>
          <p className="text-xs text-[#6E6875]">
            {total.toLocaleString()} accounts in the production database
            {selectedCountry !== "ALL" ? ` • market filter: ${selectedCountry}` : ""}
          </p>
        </div>
        <button
          onClick={() => load(page)}
          className="px-4 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] text-[#6C4CF1] text-xs font-bold rounded-full inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-2xl flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {notice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-2xl flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-4">
        {loading ? (
          <div className="py-10 text-center text-sm text-[#6E6875]">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <Users className="w-10 h-10 text-[#918A98] mx-auto" />
            <p className="text-sm font-bold text-[#17131D]">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase font-bold text-[#6E6875] border-b border-[#E7E2EB]">
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Roles</th>
                  <th className="py-2 pr-4">Country</th>
                  <th className="py-2 pr-4">Joined</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id || u.id} className="border-b border-[#F5F2FF] last:border-0">
                    <td className="py-3 pr-4 font-bold text-[#17131D]">{u.email}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          u.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : u.status === "suspended" || u.status === "restricted"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-[#6E6875]">{(u.roles || []).join(", ")}</td>
                    <td className="py-3 pr-4 text-[#6E6875]">{u.countryCode}</td>
                    <td className="py-3 pr-4 text-[#6E6875]">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex gap-1.5">
                        {u.status !== "active" ? (
                          <button
                            onClick={() => setStatus(u._id || u.id, "active")}
                            disabled={actingId === (u._id || u.id)}
                            className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full font-bold disabled:opacity-40"
                            title="Reinstate account"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setStatus(u._id || u.id, "suspended")}
                            disabled={actingId === (u._id || u.id)}
                            className="px-2.5 py-1 bg-red-50 border border-red-200 text-red-700 rounded-full font-bold disabled:opacity-40"
                            title="Suspend account"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
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
