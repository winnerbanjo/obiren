"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLoginModal from "@/components/AdminLoginModal";
import AdminShell from "@/components/AdminShell";
import AdminOverviewView from "@/components/AdminOverviewView";
import AdminUsersView from "@/components/AdminUsersView";
import AdminSupportView from "@/components/AdminSupportView";
import AdminHealthcareView from "@/components/AdminHealthcareView";
import AdminDoctorsView from "@/components/AdminDoctorsView";
import AdminSafetyView from "@/components/AdminSafetyView";
import AdminCMSView from "@/components/AdminCMSView";
import AdminPaymentsView from "@/components/AdminPaymentsView";
import AdminPlatformView from "@/components/AdminPlatformView";
import { authApi, onSessionExpired, setAccessToken, AuthUser } from "@obiren/api-client";

const ADMIN_ROLES = [
  "super_admin",
  "platform_admin",
  "compliance_officer",
  "emergency_manager",
  "content_manager",
  "medical_reviewer",
  "support_agent",
];

export default function AdminPage() {
  const [adminProfile, setAdminProfile] = useState<AuthUser | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedCountry, setSelectedCountry] = useState("ALL");
  const [sessionNotice, setSessionNotice] = useState("");

  // Restore the admin session from the HTTP-only refresh cookie.
  // No fake admin is ever created: if there is no valid session with an
  // administrative role, the login modal is shown.
  const restore = useCallback(async () => {
    setRestoring(true);
    try {
      const auth = await authApi.restore();
      if (auth && (auth.roles || []).some((r) => ADMIN_ROLES.includes(r))) {
        setAdminProfile(auth);
        setSessionNotice("");
      } else {
        setAccessToken(null);
        setAdminProfile(null);
      }
    } catch {
      setAdminProfile(null);
    } finally {
      setRestoring(false);
    }
  }, []);

  useEffect(() => {
    restore();
  }, [restore]);

  // A protected call that fails even after the automatic token refresh means
  // the session is over. Return to sign-in once with a clear reason, instead
  // of leaving every screen showing the same authorization error.
  useEffect(() => {
    return onSessionExpired((message) => {
      setAccessToken(null);
      setAdminProfile(null);
      setActiveTab("overview");
      setSessionNotice(
        /not active|suspend|restrict|deleted/i.test(message)
          ? "This administrator account is no longer active. Sign in with an active account."
          : "Your session has ended. Sign in again to continue.",
      );
    });
  }, []);

  const handleLoginSuccess = (auth: AuthUser) => {
    setAdminProfile(auth);
    setSessionNotice("");
    setActiveTab("overview");
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Clear locally regardless.
    }
    setAccessToken(null);
    setAdminProfile(null);
  };

  if (restoring) {
    return (
      <div className="min-h-screen bg-[#21182F] flex items-center justify-center">
        <div className="text-center space-y-3">
          <span className="inline-block w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Restoring secure session...</p>
        </div>
      </div>
    );
  }

  if (!adminProfile) {
    return (
      <div className="min-h-screen bg-[#21182F] flex items-center justify-center">
        <AdminLoginModal isOpen={true} notice={sessionNotice} onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  // Determine which component to render based on the active tab
  const renderContent = () => {
    switch (activeTab) {
      case "overview":
        return <AdminOverviewView selectedCountry={selectedCountry} onNavigate={setActiveTab} />;
      case "users":
        return <AdminUsersView currentUserId={adminProfile.id} />;
      case "support":
      case "support_tickets":
        return <AdminSupportView />;
      case "doctors":
        return <AdminDoctorsView />;
      case "professionals":
      case "appointments":
        return <AdminHealthcareView selectedCountry={selectedCountry} activeTabId={activeTab} />;
      case "emergency_resources":
      case "safety_incidents":
        return <AdminSafetyView selectedCountry={selectedCountry} activeTabId={activeTab} />;
      case "knowledge":
      case "medical_reviews":
        return <AdminCMSView selectedCountry={selectedCountry} activeTabId={activeTab} />;
      case "payments":
      case "refunds":
      case "refund_approvals":
        return <AdminPaymentsView selectedCountry={selectedCountry} activeTabId={activeTab} />;
      case "countries":
      case "feature_flags":
      case "audit_logs":
      case "settings":
      case "system_settings":
        return <AdminPlatformView selectedCountry={selectedCountry} activeTabId={activeTab} />;
      default:
        return <AdminOverviewView selectedCountry={selectedCountry} onNavigate={setActiveTab} />;
    }
  };

  return (
    <AdminShell
      adminProfile={adminProfile}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      selectedCountry={selectedCountry}
      onCountryChange={setSelectedCountry}
      onLogout={handleLogout}
    >
      {renderContent()}
    </AdminShell>
  );
}
