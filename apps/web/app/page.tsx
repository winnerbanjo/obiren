"use client";

import { useCallback, useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import SocialProof from "@/components/SocialProof";
import Features from "@/components/Features";
import WhyObiren from "@/components/WhyObiren";
import PrivacySection from "@/components/PrivacySection";
import SafetySection from "@/components/SafetySection";
import KnowledgeCentreSection from "@/components/KnowledgeCentreSection";
import FutureRoadmap from "@/components/FutureRoadmap";
import WaitlistCTA from "@/components/WaitlistCTA";
import Footer from "@/components/Footer";
import WaitlistModal from "@/components/WaitlistModal";
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
import { authApi, usersApi, pregnancyApi, ApiError, setAccessToken, AuthUser } from "@obiren/api-client";

/**
 * Session model: the access token lives in memory only; the refresh token
 * is an HTTP-only cookie managed by the API. On boot we silently restore
 * the session from the cookie - localStorage is never the authority.
 */
export interface ObirenSession {
  auth: AuthUser;
  firstName: string;
  lastName: string;
  displayName: string;
  countryCode: string;
  trackingGoal: string;
  onboardingStatus: string;
  pregnancy: { id: string; currentWeek?: number; estimatedDueDate: string } | null;
}

export default function Home() {
  const [session, setSession] = useState<ObirenSession | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isDailyLogOpen, setIsDailyLogOpen] = useState(false);

  // Modal Controls
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);

  const loadSession = useCallback(async (auth: AuthUser) => {
    let profile: Awaited<ReturnType<typeof usersApi.getProfile>> | null = null;
    let pregnancy: Awaited<ReturnType<typeof pregnancyApi.getCurrent>> = null;
    try {
      profile = await usersApi.getProfile();
    } catch {
      // Profile is optional at first login; dashboard handles empty fields.
    }
    try {
      pregnancy = await pregnancyApi.getCurrent();
    } catch {
      pregnancy = null;
    }
    setSession({
      auth,
      firstName: profile?.firstName || auth.profile?.firstName || "",
      lastName: profile?.lastName || auth.profile?.lastName || "",
      displayName: profile?.displayName || auth.profile?.displayName || auth.email.split("@")[0],
      countryCode: auth.countryCode,
      trackingGoal: profile?.trackingGoal || auth.profile?.trackingGoal || "CYCLE_TRACKING",
      onboardingStatus: profile?.onboardingStatus || auth.profile?.onboardingStatus || "COMPLETED",
      pregnancy:
        pregnancy && pregnancy.id
          ? { id: pregnancy.id, currentWeek: pregnancy.currentWeek, estimatedDueDate: pregnancy.estimatedDueDate }
          : null,
    });
  }, []);

  // Restore session from the HTTP-only refresh cookie on boot.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const auth = await authApi.restore();
        if (auth && !cancelled) await loadSession(auth);
      } catch {
        // No valid session - stay on the public landing page.
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
      setAccessToken(null);
    };
  }, [loadSession]);

  const handleOnboardingComplete = async (auth: AuthUser) => {
    setIsSignUpOpen(false);
    await loadSession(auth);
    setActiveTab("dashboard");
  };

  const handleSignInSuccess = async (auth: AuthUser) => {
    setIsSignInOpen(false);
    await loadSession(auth);
    setActiveTab("dashboard");
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Logging out locally regardless.
    }
    setAccessToken(null);
    setSession(null);
    setIsDailyLogOpen(false);
  };

  // The landing page markup is identical on server and client (no
  // hydration mismatch); the authenticated shell swaps in after restore.
  if (session) {
    return (
      <AppShell
        userProfile={session}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={handleLogout}
      >
        {activeTab === "dashboard" && (
          <DashboardView
            userProfile={session}
            onNavigate={setActiveTab}
            onOpenDailyLog={() => setIsDailyLogOpen(true)}
          />
        )}

        {activeTab === "cycle" && (
          <PeriodTrackerView
            userProfile={session}
            onOpenDailyLog={() => setIsDailyLogOpen(true)}
          />
        )}

        {activeTab === "pregnancy" && (
          <PregnancyView userProfile={session} onSessionRefresh={() => loadSession(session.auth)} />
        )}

        {activeTab === "learn" && <KnowledgeCentreView userProfile={session} />}

        {activeTab === "safety" && <SafetyCentreView userProfile={session} />}

        {activeTab === "professionals" && <ProfessionalsView userProfile={session} />}

        {activeTab === "vault" && <HealthVaultView userProfile={session} />}

        {activeTab === "settings" && <SettingsView userProfile={session} onLogout={handleLogout} />}

        {/* Daily Check-in Modal */}
        <DailyLogModal
          isOpen={isDailyLogOpen}
          onClose={() => setIsDailyLogOpen(false)}
          onSaveLog={() => {
            // Data refresh is handled inside the modal after a successful save.
          }}
        />
      </AppShell>
    );
  }

  // Sign Up flow: progressive 7-step onboarding (real registration).
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

  // Unauthenticated Landing Page View with Sign In & Sign Up Modals.
  // (While restoring a session we intentionally render the public landing
  // page rather than blanking the screen.)
  return (
    <div className="min-h-screen bg-white text-[#17131D] font-sans selection:bg-[#E8E0FF] selection:text-[#6C4CF1] overflow-x-hidden">
      <Navbar
        onOpenWaitlist={() => setIsWaitlistOpen(true)}
        onOpenSignIn={() => setIsSignInOpen(true)}
        onOpenSignUp={() => setIsSignUpOpen(true)}
      />

      <main>
        <Hero onOpenWaitlist={() => setIsSignUpOpen(true)} />
        <SocialProof />
        <Features onOpenWaitlist={() => setIsSignUpOpen(true)} />
        <WhyObiren />
        <PrivacySection />
        <SafetySection onOpenWaitlist={() => setIsSignUpOpen(true)} />
        <KnowledgeCentreSection onOpenWaitlist={() => setIsSignUpOpen(true)} />
        <FutureRoadmap onOpenWaitlist={() => setIsSignUpOpen(true)} />
        <WaitlistCTA onOpenWaitlist={() => setIsSignUpOpen(true)} />
      </main>

      <Footer onOpenWaitlist={() => setIsSignUpOpen(true)} />

      {/* Modals */}
      <WaitlistModal isOpen={isWaitlistOpen} onClose={() => setIsWaitlistOpen(false)} />

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
