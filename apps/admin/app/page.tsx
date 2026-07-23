"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import SocialProof from "@/components/SocialProof";
import Features from "@/components/Features";
import WhyObiren from "@/components/WhyObiren";
import PositioningStrip from "@/components/PositioningStrip";
import TeleGynecologySection from "@/components/TeleGynecologySection";
import HomepageFeatureSections from "@/components/HomepageFeatureSections";
import ConditionsSection from "@/components/ConditionsSection";
import HowItWorks from "@/components/HowItWorks";
import EarlyAccessCTA from "@/components/EarlyAccessCTA";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";
import SignInModal from "@/components/SignInModal";
import OnboardingFlow from "@/components/OnboardingFlow";
import AppShell from "@/components/AppShell";
import DashboardView from "@/components/DashboardView";
import PeriodTrackerView from "@/components/PeriodTrackerView";
import PregnancyView from "@/components/PregnancyView";
import KnowledgeCentreView from "@/components/KnowledgeCentreView";
import SafetyCentreView from "@/components/SafetyCentreView";
import HealthVaultView from "@/components/HealthVaultView";
import ProfessionalsView from "@/components/ProfessionalsView";
import SettingsView from "@/components/SettingsView";
import DailyLogModal from "@/components/DailyLogModal";

export default function Home() {
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isDailyLogOpen, setIsDailyLogOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Modal Controls
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);

  // Load active session from localStorage on mount so page refreshes never drop session
  useEffect(() => {
    setMounted(true);
    try {
      const savedProfile = localStorage.getItem("obiren_user_profile");
      if (savedProfile) {
        setUserProfile(JSON.parse(savedProfile));
      }
    } catch (e) {
      console.error("Failed to parse stored profile", e);
    }
  }, []);

  const handleOnboardingComplete = (profile: any) => {
    setUserProfile(profile);
    try {
      localStorage.setItem("obiren_user_profile", JSON.stringify(profile));
    } catch (e) {}
    setIsSignUpOpen(false);
    setActiveTab("dashboard");
  };

  const handleSignInSuccess = (profile: any) => {
    setUserProfile(profile);
    try {
      localStorage.setItem("obiren_user_profile", JSON.stringify(profile));
    } catch (e) {}
    setIsSignInOpen(false);
    setActiveTab("dashboard");
  };

  const handleLogout = () => {
    setUserProfile(null);
    try {
      localStorage.removeItem("obiren_user_profile");
    } catch (e) {}
  };

  if (!mounted) return null;

  // If user is authenticated, render the Application Shell
  if (userProfile) {
    return (
      <AppShell
        userProfile={userProfile}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={handleLogout}
      >
        {activeTab === "dashboard" && (
          <DashboardView
            userProfile={userProfile}
            onNavigate={setActiveTab}
            onOpenDailyLog={() => setIsDailyLogOpen(true)}
          />
        )}

        {activeTab === "cycle" && (
          <PeriodTrackerView
            userProfile={userProfile}
            onOpenDailyLog={() => setIsDailyLogOpen(true)}
          />
        )}

        {activeTab === "pregnancy" && (
          <PregnancyView userProfile={userProfile} />
        )}

        {activeTab === "learn" && (
          <KnowledgeCentreView userProfile={userProfile} />
        )}

        {activeTab === "safety" && (
          <SafetyCentreView userProfile={userProfile} />
        )}

        {activeTab === "professionals" && (
          <ProfessionalsView userProfile={userProfile} />
        )}

        {activeTab === "vault" && (
          <HealthVaultView userProfile={userProfile} />
        )}

        {activeTab === "settings" && (
          <SettingsView userProfile={userProfile} />
        )}

        {/* Daily Check-in Modal */}
        <DailyLogModal
          isOpen={isDailyLogOpen}
          onClose={() => setIsDailyLogOpen(false)}
          onSaveLog={(log) => {
            console.log("Saved Daily Log:", log);
          }}
        />
      </AppShell>
    );
  }

  // If Sign Up flow is active, render progressive 7-step Onboarding
  if (isSignUpOpen) {
    return (
      <div className="min-h-screen bg-[#FBFAFD] flex flex-col justify-center">
        <div className="max-w-4xl mx-auto w-full p-4">
          <button
            onClick={() => setIsSignUpOpen(false)}
            className="mb-4 text-xs font-bold text-[#6C4CF1] hover:underline"
          >
            ← Back to Landing Page
          </button>
          <OnboardingFlow onComplete={handleOnboardingComplete} />
        </div>
      </div>
    );
  }

  // Unauthenticated Landing Page View with Sign In & Sign Up Modals
  return (
    <div className="min-h-screen bg-white text-[#17131D] font-sans selection:bg-[#E8E0FF] selection:text-[#6C4CF1] overflow-x-hidden">
      <Navbar
        onOpenWaitlist={() => setIsSignUpOpen(true)}
        onOpenSignIn={() => setIsSignInOpen(true)}
        onOpenSignUp={() => setIsSignUpOpen(true)}
      />

      <main>
        <Hero onOpenWaitlist={() => setIsSignUpOpen(true)} />
        <PositioningStrip />
        <TeleGynecologySection />
        <Features />
        <HowItWorks onOpenWaitlist={() => setIsSignUpOpen(true)} />
        <HomepageFeatureSections />
        <ConditionsSection />
        <WhyObiren />
        <SocialProof />
        <EarlyAccessCTA onOpenWaitlist={() => setIsSignUpOpen(true)} />
        <FinalCTA onOpenWaitlist={() => setIsSignUpOpen(true)} />
      </main>

      <Footer onOpenWaitlist={() => setIsSignUpOpen(true)} />

      {/* Modals */}
      <SignInModal
        isOpen={isSignInOpen}
        onClose={() => setIsSignInOpen(false)}
        onSuccess={handleSignInSuccess}
        onSwitchToSignUp={() => {
          setIsSignInOpen(false);
          setIsSignUpOpen(true);
        }}
      />
    </div>
  );
}
