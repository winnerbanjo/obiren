"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLoginModal from "@/components/AdminLoginModal";
import AdminShell from "@/components/AdminShell";
import AdminOverviewView from "@/components/AdminOverviewView";
import AdminUsersView from "@/components/AdminUsersView";
import AdminHealthcareView from "@/components/AdminHealthcareView";
import AdminSafetyView from "@/components/AdminSafetyView";
import AdminCMSView from "@/components/AdminCMSView";
import AdminPaymentsView from "@/components/AdminPaymentsView";
import AdminPlatformView from "@/components/AdminPlatformView";
import AdminPlaceholderView from "@/components/AdminPlaceholderView";
import { authApi, setAccessToken, AuthUser } from "@obiren/api-client";

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

  // Restore the admin session from the HTTP-only refresh cookie.
  // No fake admin is ever created: if there is no valid session with an
  // administrative role, the login modal is shown.
  const restore = useCallback(async () => {
    setRestoring(true);
    try {
      const auth = await authApi.restore();
      if (auth && (auth.roles || []).some((r) => ADMIN_ROLES.includes(r))) {
        setAdminProfile(auth);
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

  const handleLoginSuccess = (auth: AuthUser) => {
    setAdminProfile(auth);
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
        <AdminLoginModal isOpen={true} onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  // Determine which component to render based on the active tab
  const renderContent = () => {
    switch (activeTab) {
      case "overview":
        return <AdminOverviewView selectedCountry={selectedCountry} onNavigate={setActiveTab} />;
      case "users":
      case "support":
      case "support_tickets":
      case "notifications":
        return <AdminUsersView selectedCountry={selectedCountry} activeTabId={activeTab} />;
      case "professionals":
      case "health_tracking":
      case "pregnancy":
      case "appointments":
        return <AdminHealthcareView selectedCountry={selectedCountry} activeTabId={activeTab} />;
      case "emergency_resources":
      case "safety_incidents":
      case "trusted_circle":
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
        // Render placeholder for all unimplemented tabs
        return <AdminPlaceholderView activeTab={activeTab} />;
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
