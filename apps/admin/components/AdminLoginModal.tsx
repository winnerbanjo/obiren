"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Lock,
  KeyRound,
  UserCheck,
  ArrowRight,
  AlertTriangle,
  Globe,
  Heart,
  CheckCircle2,
} from "lucide-react";

interface AdminLoginModalProps {
  isOpen: boolean;
  onLoginSuccess: (adminProfile: any) => void;
}

export default function AdminLoginModal({ isOpen, onLoginSuccess }: AdminLoginModalProps) {
  const [selectedRole, setSelectedRole] = useState("super_admin");
  const [email, setEmail] = useState("admin@obiren.com");
  const [password, setPassword] = useState("ObirenAdmin2026!");
  const [twoFactorCode, setTwoFactorCode] = useState("892-104");
  const [step, setStep] = useState<"credentials" | "2fa">("credentials");
  const [loading, setLoading] = useState(false);

  const roles = [
    { id: "super_admin", title: "Super Administrator", desc: "Unrestricted operational & security access" },
    { id: "platform_admin", title: "Platform Administrator", desc: "User, content, emergency & doctor management" },
    { id: "healthcare_verifier", title: "Healthcare Verification Officer", desc: "Doctor licence & credential verification" },
    { id: "emergency_manager", title: "Emergency Resource Manager", desc: "Hospital & SOS directory curation" },
    { id: "content_manager", title: "Content Manager", desc: "Knowledge Centre CMS & article drafting" },
    { id: "medical_reviewer", title: "Medical Reviewer", desc: "Clinical review & publication approvals" },
    { id: "finance_admin", title: "Finance Administrator", desc: "Transactions, revenue & refund processing" },
    { id: "support_agent", title: "Support Agent", desc: "User ticket resolution & account assistance" },
    { id: "compliance_officer", title: "Compliance Officer", desc: "NDPR, GDPR, audit logs & privacy exports" },
  ];

  if (!isOpen) return null;

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep("2fa");
    }, 600);
  };

  const handle2FASubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const roleObj = roles.find((r) => r.id === selectedRole) || roles[0];
      onLoginSuccess({
        name: "Director Vance",
        email: email,
        role: roleObj.id,
        roleTitle: roleObj.title,
        sessionIp: "102.89.23.14 (Lagos, NG)",
        authenticatedAt: new Date().toLocaleTimeString(),
      });
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl p-6 sm:p-10 w-full max-w-xl shadow-2xl border border-[#E7E2EB] relative my-8"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#6C4CF1] to-[#9B6BFF] text-white flex items-center justify-center shadow-lg shadow-[#6C4CF1]/20">
            <Heart className="w-6 h-6 fill-white/20" />
          </div>
          <div>
            <h2 className="text-2xl font-bold font-display text-[#17131D]">Obiren Admin Control Centre</h2>
            <p className="text-xs text-[#6E6875]">Central operational & compliance command server.</p>
          </div>
        </div>

        {step === "credentials" ? (
          <form onSubmit={handleCredentialsSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#6E6875] mb-1.5">
                Select Administrative Operational Role
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-4 py-3 bg-[#F5F2FF] border border-[#E8E0FF] rounded-2xl text-xs font-bold text-[#17131D] focus:outline-none focus:border-[#6C4CF1]"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} — {r.desc}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#6E6875] mb-1">
                Admin Work Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[#F5F2FF] border border-[#E8E0FF] rounded-2xl text-sm font-medium focus:outline-none focus:border-[#6C4CF1]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#6E6875] mb-1">
                Master Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#F5F2FF] border border-[#E8E0FF] rounded-2xl text-sm font-medium focus:outline-none focus:border-[#6C4CF1]"
              />
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#6C4CF1] shrink-0 mt-0.5" />
              <span>
                All administrative actions are logged in immutable audit records. Unrestricted API access is prohibited under NDPR & GDPR standards.
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white font-bold text-xs rounded-full shadow-lg shadow-[#6C4CF1]/30 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Proceed to 2FA Verification</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handle2FASubmit} className="space-y-5">
            <div className="p-4 bg-[#F5F2FF] rounded-2xl border border-[#E8E0FF] text-center space-y-1">
              <KeyRound className="w-8 h-8 text-[#6C4CF1] mx-auto" />
              <h3 className="text-base font-bold text-[#17131D]">Two-Factor Authentication Required</h3>
              <p className="text-xs text-[#6E6875]">An authenticator security pin has been issued for <strong>{email}</strong>.</p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#6E6875] mb-1 text-center">
                Enter 6-Digit 2FA Token
              </label>
              <input
                type="text"
                required
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                className="w-full px-4 py-3 bg-[#F5F2FF] border border-[#E8E0FF] rounded-2xl text-center text-xl font-mono tracking-widest font-bold focus:outline-none focus:border-[#6C4CF1]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white font-bold text-xs rounded-full shadow-lg shadow-[#6C4CF1]/30 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Authenticate & Launch Operational Console</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setStep("credentials")}
              className="w-full text-center text-xs font-bold text-[#666666] hover:underline"
            >
              ← Change Role or Credentials
            </button>
          </form>
        )}

      </motion.div>
    </div>
  );
}
