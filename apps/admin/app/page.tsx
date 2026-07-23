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
        // Default pre-authenticated Super Admin for instant preview demo
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

  return (
    <AdminShell
      adminProfile={adminProfile}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      selectedCountry={selectedCountry}
      onCountryChange={setSelectedCountry}
      onLogout={handleLogout}
    >
      {activeTab === "overview" && (
        <AdminOverviewView
          selectedCountry={selectedCountry}
          onNavigate={setActiveTab}
        />
      )}

      {(activeTab === "users" || activeTab === "support" || activeTab === "notifications") && (
        <AdminUsersView selectedCountry={selectedCountry} />
      )}

      {(activeTab === "professionals" || activeTab === "appointments" || activeTab === "health_tracking" || activeTab === "pregnancy") && (
        <AdminHealthcareView selectedCountry={selectedCountry} />
      )}

      {(activeTab === "emergency_resources" || activeTab === "safety_incidents" || activeTab === "trusted_circle") && (
        <AdminSafetyView selectedCountry={selectedCountry} />
      )}

      {(activeTab === "knowledge" || activeTab === "medical_reviews") && (
        <AdminCMSView selectedCountry={selectedCountry} />
      )}

      {(activeTab === "payments" || activeTab === "refunds") && (
        <AdminPaymentsView selectedCountry={selectedCountry} />
      )}

      {(activeTab === "countries" || activeTab === "feature_flags" || activeTab === "audit_logs" || activeTab === "settings") && (
        <AdminPlatformView selectedCountry={selectedCountry} />
      )}
    </AdminShell>
  );
}
