"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  Clock,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Stethoscope,
  User,
  X,
} from "lucide-react";
import {
  ApiError,
  authApi,
  doctorApi,
  AuthUser,
  DoctorNotificationData,
  DoctorProfileData,
  getAccessToken,
  getAuthUser,
  setAccessToken,
} from "@obiren/api-client";
import BrandMark from "./BrandMark";

// React Strict Mode mounts effects twice in development. These module-level
// promises collapse the duplicate session/profile reads into one request each,
// so the portal does not pay for the same data twice.
let sessionInFlight: Promise<AuthUser | null> | null = null;
let profileInFlight: Promise<{ me: DoctorProfileData; unread: number }> | null = null;

function loadSessionOnce(): Promise<AuthUser | null> {
  if (sessionInFlight) return sessionInFlight;
  // The login response already carried the verified identity. Reuse it when the
  // access token is still in memory; a hard reload has no token and falls
  // through to the refresh-cookie restore path.
  const cached = getAccessToken() ? getAuthUser() : null;
  if (cached) return Promise.resolve(cached);
  const promise = (async () => (getAccessToken() ? await authApi.me() : await authApi.restore()))();
  sessionInFlight = promise.finally(() => {
    sessionInFlight = null;
  });
  return sessionInFlight;
}

function loadDoctorProfileOnce(): Promise<{ me: DoctorProfileData; unread: number }> {
  if (profileInFlight) return profileInFlight;
  const promise = (async () => {
    const [me, feed] = await Promise.all([
      doctorApi.me(),
      doctorApi.notifications({ limit: 1 }).catch(() => null),
    ]);
    return { me, unread: feed?.unreadCount ?? 0 };
  })();
  profileInFlight = promise.finally(() => {
    profileInFlight = null;
  });
  return profileInFlight;
}

// Notifications and Settings live in the top bar (bell + profile menu) so the
// two things a doctor reaches for most are always one click away.
const NAV = [
  { href: "/doctor/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/doctor/appointments", label: "Appointments", icon: Clock },
  { href: "/doctor/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/doctor/availability", label: "Availability", icon: CalendarDays },
  { href: "/doctor/profile", label: "My Profile", icon: User },
];

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "Dr"
  );
}

function relativeTime(value: string): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(new Date(value));
}

/**
 * Client-side shell and navigation.
 *
 * This is a convenience guard only: every API route independently enforces the
 * clinician role and profile ownership server-side, so a hidden page is never
 * the security boundary.
 */
export default function DoctorShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<"loading" | "ready" | "forbidden" | "error">("loading");
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<DoctorProfileData | null>(null);
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [previewItems, setPreviewItems] = useState<DoctorNotificationData[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const bellRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  const loadProfile = useCallback(async () => {
    // Profile and unread badge are independent; fetch them together and share
    // the in-flight promise with any Strict Mode duplicate mount.
    const { me, unread: unreadCount } = await loadDoctorProfileOnce();
    setProfile(me);
    setUnread(unreadCount);
  }, []);

  const boot = useCallback(async () => {
    setState("loading");
    setMessage("");
    try {
      // Immediately after sign-in the access token is already in memory. Only
      // call /auth/refresh when a full reload lost it, so a fresh login never
      // spends a round-trip (or a rate-limit slot) restoring a session it has.
      // The shared promise prevents a duplicate Strict Mode mount from asking
      // /auth/me twice.
      const session = await loadSessionOnce();
      if (!session) {
        router.replace("/doctor/login");
        return;
      }
      if (!(session.roles || []).includes("clinician")) {
        await authApi.logout().catch(() => undefined);
        setAccessToken(null);
        setState("forbidden");
        return;
      }
      // Authentication is verified. Render the portal now so the page and its
      // dashboard request start while the profile and badge load in parallel.
      // Every API still enforces the clinician role server-side.
      setState("ready");
      await loadProfile();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace("/doctor/login");
        return;
      }
      if (error instanceof ApiError && error.status === 403) {
        setState("forbidden");
        return;
      }
      setMessage(error instanceof Error ? error.message : "Could not restore your secure session.");
      setState("error");
    }
  }, [loadProfile, router]);

  useEffect(() => {
    void boot();
  }, [boot]);

  const logout = async () => {
    setProfileOpen(false);
    await authApi.logout().catch(() => undefined);
    setAccessToken(null);
    router.replace("/doctor/login");
  };

  // The bell shows the latest few events without leaving the page; the full
  // paginated list stays at /doctor/notifications.
  const openBell = useCallback(async () => {
    setBellOpen((open) => !open);
    setProfileOpen(false);
  }, []);

  useEffect(() => {
    if (!bellOpen) return;
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError("");
    doctorApi
      .notifications({ limit: 6 })
      .then((response) => {
        if (cancelled) return;
        setPreviewItems(response.notifications);
        setUnread(response.unreadCount);
      })
      .catch((error) => {
        if (!cancelled) setPreviewError(error instanceof Error ? error.message : "Could not load notifications.");
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bellOpen]);

  // Close either menu on outside click or Escape.
  useEffect(() => {
    if (!bellOpen && !profileOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (bellOpen && !bellRef.current?.contains(target)) setBellOpen(false);
      if (profileOpen && !profileRef.current?.contains(target)) setProfileOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setBellOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [bellOpen, profileOpen]);

  // Navigating away closes both menus and the mobile drawer.
  useEffect(() => {
    setBellOpen(false);
    setProfileOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  const markPreviewRead = async (notification: DoctorNotificationData) => {
    if (notification.readAt) return;
    try {
      const result = await doctorApi.markNotificationRead(notification.id);
      setPreviewItems((items) => items.map((item) => (item.id === notification.id ? { ...item, readAt: result.readAt } : item)));
      setUnread((value) => Math.max(0, value - 1));
    } catch {
      // Non-blocking: the unread dot simply stays until the next attempt.
    }
  };

  const notificationHref = (notification: DoctorNotificationData) =>
    notification.deepLink?.startsWith("/doctor")
      ? notification.deepLink
      : notification.objectId
        ? `/doctor/appointments/${notification.objectId}`
        : "/doctor/notifications";

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <span className="inline-block w-8 h-8 border-2 border-[#6C4CF1]/20 border-t-[#6C4CF1] rounded-full animate-spin" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#6E6875]">Restoring secure session…</p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-[#E7E2EB] rounded-3xl p-8 text-center space-y-4">
          <ShieldCheck className="w-10 h-10 text-[#6C4CF1] mx-auto" />
          <h1 className="text-lg font-bold">We couldn&apos;t open your portal</h1>
          <p role="alert" className="text-xs text-[#6E6875]">
            {message || "The server is temporarily unavailable. Your session is still secure."}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button onClick={() => void boot()} className="px-4 py-2.5 bg-[#6C4CF1] text-white text-xs font-bold rounded-xl">
              Try again
            </button>
            <Link href="/doctor/login" className="px-4 py-2.5 border border-[#E7E2EB] text-xs font-bold rounded-xl">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (state === "forbidden") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-[#E7E2EB] rounded-3xl p-8 text-center space-y-4">
          <ShieldCheck className="w-10 h-10 text-[#6C4CF1] mx-auto" />
          <h1 className="text-lg font-bold">Doctor access required</h1>
          <p className="text-xs text-[#6E6875]">
            This portal is limited to accounts with an approved doctor profile. If you were invited, activate your account first.
            Obiren staff can reissue your invitation.
          </p>
          <Link href="/doctor/login" className="inline-block px-4 py-2.5 bg-[#6C4CF1] text-white text-xs font-bold rounded-xl">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  const displayName = profile?.displayName || "Doctor";
  const status = profile?.accountStatus;
  const pageTitle = pathname.startsWith("/doctor/appointments/")
    ? "Appointment details"
    : pathname.startsWith("/doctor/notifications")
      ? "Notifications"
      : pathname.startsWith("/doctor/settings")
        ? "Settings"
        : NAV.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label ?? "Dashboard";

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <aside className="hidden lg:flex flex-col justify-between w-64 shrink-0 bg-white border-r border-[#E7E2EB] p-5 h-screen sticky top-0 overflow-y-auto">
        <div className="space-y-6">
          <div className="flex items-center gap-2.5">
            <BrandMark size={36} />
            <div>
              <span className="block text-sm font-bold">Obiren</span>
              <span className="block text-[10px] uppercase tracking-widest font-bold text-[#6C4CF1]">Doctor Portal</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-[#F5F2FF] border border-[#E8E0FF]">
            <p className="text-[10px] uppercase font-bold text-[#6E6875]">Signed in</p>
            <p className="text-xs font-bold truncate">{displayName}</p>
            <p className="text-[10px] text-[#6E6875] mt-0.5">
              {status === "active" && profile?.listed ? "Active · listed" : status === "active" ? "Active · hidden" : status}
            </p>
          </div>

          <nav className="space-y-1" aria-label="Doctor portal">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                    active ? "bg-[#6C4CF1] text-white" : "text-[#6E6875] hover:bg-[#F5F2FF] hover:text-[#6C4CF1]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="flex-1">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {profile && !profile.listed && (
          <div className="pt-4 border-t border-[#E7E2EB]">
            <p className="text-[10px] leading-relaxed text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2">
              Your profile is hidden from patient discovery
              {profile.verificationStatus !== "verified" ? " until Obiren approves your verification." : "."}
            </p>
          </div>
        )}
      </aside>

      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#E7E2EB] px-4 sm:px-8 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-[#F5F2FF] shrink-0"
              onClick={() => setMenuOpen((value) => !value)}
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{pageTitle}</p>
              <p className="text-[10px] text-[#6E6875] hidden sm:block truncate">
                {profile?.professionalTitle || profile?.timeZone || "Doctor portal"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F5F2FF] border border-[#E8E0FF] text-[10px] font-bold text-[#6C4CF1]">
              <Stethoscope className="w-3 h-3" /> {profile?.verificationStatus}
            </span>

            {/* Bell: latest booking events without leaving the page. */}
            <div ref={bellRef} className="relative">
              <button
                type="button"
                onClick={openBell}
                aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
                aria-haspopup="menu"
                aria-expanded={bellOpen}
                className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                  bellOpen ? "bg-[#6C4CF1] text-white" : "bg-[#F7F5FB] text-[#4B4453] hover:bg-[#F5F2FF] hover:text-[#6C4CF1]"
                }`}
              >
                <Bell className="w-4 h-4" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-[#F0417A] text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div
                  role="menu"
                  aria-label="Recent notifications"
                  className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] bg-white border border-[#E7E2EB] rounded-2xl shadow-xl shadow-[#6C4CF1]/10 overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#F0EDF3]">
                    <p className="text-xs font-bold">Notifications</p>
                    {unread > 0 && <span className="text-[10px] font-bold text-[#6C4CF1]">{unread} unread</span>}
                  </div>

                  {previewError ? (
                    <p role="alert" className="px-4 py-6 text-[11px] text-[#6E6875] text-center">
                      {previewError}
                    </p>
                  ) : previewLoading && previewItems.length === 0 ? (
                    <p className="px-4 py-6 text-[11px] text-[#6E6875] text-center">Loading notifications…</p>
                  ) : previewItems.length === 0 ? (
                    <div className="px-4 py-8 text-center space-y-1">
                      <Bell className="w-6 h-6 mx-auto text-[#C9C2D3]" />
                      <p className="text-[11px] font-bold">You&apos;re all caught up</p>
                      <p className="text-[10px] text-[#6E6875]">New bookings and changes will show up here.</p>
                    </div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto divide-y divide-[#F5F2F8]">
                      {previewItems.map((notification) => (
                        <Link
                          key={notification.id}
                          href={notificationHref(notification)}
                          role="menuitem"
                          onClick={() => void markPreviewRead(notification)}
                          className={`block px-4 py-3 hover:bg-[#F7F5FB] transition-colors ${notification.readAt ? "" : "bg-[#FBFAFF]"}`}
                        >
                          <div className="flex gap-2.5">
                            <span
                              className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                                notification.readAt ? "bg-[#DDD7E4]" : "bg-[#6C4CF1]"
                              }`}
                              aria-hidden
                            />
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold truncate">{notification.title}</p>
                              <p className="text-[11px] text-[#6E6875] leading-snug line-clamp-2">{notification.body}</p>
                              <p className="text-[10px] text-[#9B94A3] mt-0.5">{relativeTime(notification.createdAt)}</p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  <Link
                    href="/doctor/notifications"
                    className="block px-4 py-2.5 text-center text-[11px] font-bold text-[#6C4CF1] border-t border-[#F0EDF3] hover:bg-[#FBFAFF]"
                  >
                    View all notifications
                  </Link>
                </div>
              )}
            </div>

            {/* Profile: account summary, profile, notifications, settings, sign out. */}
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileOpen((open) => !open);
                  setBellOpen(false);
                }}
                aria-label="Account menu"
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                className={`flex items-center gap-1.5 sm:gap-2 p-0.5 sm:pl-1 sm:pr-1.5 rounded-full transition-colors ${
                  profileOpen ? "bg-[#F5F2FF]" : "hover:bg-[#F7F5FB]"
                }`}
              >
                {profile?.photoUrl ? (
                  <img src={profile.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-[#E7E2EB]" />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#6C4CF1] to-[#9B6BFF] text-white text-[11px] font-bold flex items-center justify-center">
                    {initialsOf(displayName)}
                  </span>
                )}
                <ChevronDown className={`hidden sm:block w-3.5 h-3.5 text-[#6E6875] transition-transform ${profileOpen ? "rotate-180" : ""}`} />
              </button>

              {profileOpen && (
                <div
                  role="menu"
                  aria-label="Account"
                  className="absolute right-0 mt-2 w-64 bg-white border border-[#E7E2EB] rounded-2xl shadow-xl shadow-[#6C4CF1]/10 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-[#F0EDF3]">
                    <div className="flex items-center gap-2.5">
                      {profile?.photoUrl ? (
                        <img src={profile.photoUrl} alt="" className="w-9 h-9 rounded-full object-cover border border-[#E7E2EB]" />
                      ) : (
                        <span className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#6C4CF1] to-[#9B6BFF] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                          {initialsOf(displayName)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{displayName}</p>
                        <p className="text-[10px] text-[#6E6875] truncate">{profile?.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F5F2FF] border border-[#E8E0FF] text-[9px] font-bold text-[#6C4CF1]">
                        <Stethoscope className="w-2.5 h-2.5" /> {profile?.verificationStatus ?? "pending"}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                          profile?.listed
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : "bg-[#F7F5FB] border-[#E7E2EB] text-[#6E6875]"
                        }`}
                      >
                        {profile?.listed ? "Listed to patients" : "Hidden from patients"}
                      </span>
                    </div>
                  </div>

                  <div className="p-1.5">
                    <Link
                      href="/doctor/profile"
                      role="menuitem"
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-[#4B4453] hover:bg-[#F7F5FB]"
                    >
                      <User className="w-4 h-4 text-[#6C4CF1]" /> My profile
                    </Link>
                    <Link
                      href="/doctor/notifications"
                      role="menuitem"
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-[#4B4453] hover:bg-[#F7F5FB]"
                    >
                      <Bell className="w-4 h-4 text-[#6C4CF1]" /> Notifications
                      {unread > 0 && (
                        <span className="ml-auto min-w-5 h-4 px-1 rounded-full bg-[#F0417A] text-white text-[9px] font-bold flex items-center justify-center">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </Link>
                    <Link
                      href="/doctor/settings"
                      role="menuitem"
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-[#4B4453] hover:bg-[#F7F5FB]"
                    >
                      <Settings className="w-4 h-4 text-[#6C4CF1]" /> Settings
                    </Link>
                  </div>

                  <div className="p-1.5 border-t border-[#F0EDF3]">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void logout()}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="w-4 h-4" /> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {menuOpen && (
          <nav className="lg:hidden bg-white border-b border-[#E7E2EB] p-3 grid grid-cols-2 gap-1.5" aria-label="Doctor portal mobile">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${
                    active ? "bg-[#6C4CF1] text-white" : "bg-[#F5F2FF] text-[#17131D]"
                  }`}
                >
                  <Icon className="w-4 h-4" /> {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        <main className="p-4 sm:p-8 max-w-6xl mx-auto w-full">{children}</main>
      </div>
    </div>
  );
}
