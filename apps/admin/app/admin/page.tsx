"use client";

import { useState, useEffect } from "react";
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

export default function AdminPage() {
  const [adminProfile, setAdminProfile] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedCountry, setSelectedCountry] = useState("ALL");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const savedAdmin = localStorage.getItem("obiren_admin_profile");
      if (savedAdmin) {
        setAdminProfile(JSON.parse(savedAdmin));
      } else {
        const defaultAdmin = {
          name: "Director Vance",
          email: "admin@obiren.com",
          role: "super_admin",
          roleTitle: "Super Administrator",
          sessionIp: "102.89.23.14 (Lagos, NG)",
          authenticatedAt: new Date().toLocaleTimeString(),
        };
        setAdminProfile(defaultAdmin);
        localStorage.setItem("obiren_admin_profile", JSON.stringify(defaultAdmin));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleLoginSuccess = (profile: any) => {
    setAdminProfile(profile);
    try {
      localStorage.setItem("obiren_admin_profile", JSON.stringify(profile));
    } catch (e) {}
    setActiveTab("overview");
  };

  const handleLogout = () => {
    setAdminProfile(null);
    try {
      localStorage.removeItem("obiren_admin_profile");
    } catch (e) {}
  };

  if (!mounted) return null;

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
      case "refund_approvals":
        return <AdminPaymentsView selectedCountry={selectedCountry} activeTabId={activeTab} />;
      case "countries":
      case "feature_flags":
      case "audit_logs":
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
