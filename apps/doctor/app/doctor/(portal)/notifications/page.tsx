"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, ChevronDown } from "lucide-react";
import { doctorApi, DoctorNotificationData } from "@obiren/api-client";
import { Card, EmptyState, ErrorBanner, Loading } from "@/components/ui";

export default function NotificationsPage() {
  const [items, setItems] = useState<DoctorNotificationData[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (append = false, nextCursor?: string | null) => {
    append ? setLoadingMore(true) : setLoading(true);
    setError("");
    try {
      const response = await doctorApi.notifications({ limit: 20, cursor: nextCursor || undefined });
      setItems((current) => (append ? [...current, ...response.notifications] : response.notifications));
      setUnread(response.unreadCount);
      setCursor(response.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load notifications.");
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (notification: DoctorNotificationData) => {
    if (notification.readAt) return;
    try {
      const result = await doctorApi.markNotificationRead(notification.id);
      setItems((current) => current.map((item) => (item.id === notification.id ? { ...item, readAt: result.readAt } : item)));
      setUnread((value) => Math.max(0, value - 1));
    } catch {
      // Non-blocking: the feed keeps its unread state and the user can retry.
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold">Notifications</h1>
          <p className="text-xs text-[#6E6875]">
            Booking events for your appointments. Messages never include a patient&apos;s symptoms or diagnosis.
          </p>
        </div>
        <span className="text-[11px] font-bold text-[#6C4CF1]">{unread} unread</span>
      </div>

      {error && <ErrorBanner message={error} />}
      {loading ? (
        <Loading label="Loading notifications…" />
      ) : items.length === 0 ? (
        <Card className="p-5">
          <EmptyState title="No notifications yet" hint="New bookings, cancellations and reschedules will appear here." icon={<Bell className="w-8 h-8" />} />
        </Card>
      ) : (
        <Card className="divide-y divide-[#F0EDF3]">
          {items.map((notification) => (
            <div key={notification.id} className={`p-4 flex items-start gap-3 ${notification.readAt ? "" : "bg-[#FBFAFF]"}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${notification.readAt ? "bg-[#F5F2FF] text-[#9B94A3]" : "bg-[#6C4CF1] text-white"}`}>
                <Bell className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold">{notification.title}</p>
                <p className="text-[11px] text-[#6E6875]">{notification.body}</p>
                <p className="text-[10px] text-[#9B94A3] mt-1">
                  {new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(notification.createdAt))}
                </p>
                <div className="flex gap-3 mt-1.5">
                  {notification.objectId && (
                    <Link
                      href={
                        notification.deepLink?.startsWith("/") && notification.deepLink.startsWith("/doctor")
                          ? notification.deepLink
                          : `/doctor/appointments/${notification.objectId}`
                      }
                      className="text-[10px] font-bold text-[#6C4CF1]"
                      onClick={() => markRead(notification)}
                    >
                      Open appointment
                    </Link>
                  )}
                  {!notification.readAt && (
                    <button onClick={() => markRead(notification)} className="text-[10px] font-bold text-[#6E6875] inline-flex items-center gap-1">
                      <CheckCheck className="w-3 h-3" /> Mark read
                    </button>
                  )}
                </div>
              </div>
              {!notification.readAt && <span className="w-2 h-2 rounded-full bg-[#6C4CF1] mt-1.5" aria-label="Unread" />}
            </div>
          ))}
        </Card>
      )}

      {cursor && !loading && (
        <button
          onClick={() => load(true, cursor)}
          disabled={loadingMore}
          className="w-full py-2.5 rounded-xl border border-[#E7E2EB] bg-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          {loadingMore ? "Loading…" : "Load more"} <ChevronDown className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
