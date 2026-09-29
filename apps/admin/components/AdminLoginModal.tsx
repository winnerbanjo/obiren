"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertTriangle,
  Heart,
} from "lucide-react";
import { authApi, ApiError, AuthUser } from "@obiren/api-client";

interface AdminLoginModalProps {
  isOpen: boolean;
  onLoginSuccess: (auth: AuthUser) => void;
}

export default function AdminLoginModal({ isOpen, onLoginSuccess }: AdminLoginModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!email || !password) {
      setErrorMsg("Email and password are required.");
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.login(email, password);
      const roles: string[] = result.user.roles || [];
      const isAdmin = roles.some((r) =>
        ["super_admin", "platform_admin", "compliance_officer", "emergency_manager", "content_manager", "medical_reviewer", "support_agent"].includes(r),
      );
      if (!isAdmin) {
        setErrorMsg("This account does not have administrative access.");
        return;
      }
      onLoginSuccess(result.user);
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "Unable to sign in right now. Please try again.",
      );
    } finally {
      setLoading(false);
    }
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

        <form onSubmit={handleCredentialsSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#6E6875] mb-1.5">
              Administrator Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@obiren.com"
              className="w-full px-4 py-3 bg-[#F5F2FF] border border-[#E8E0FF] rounded-2xl text-xs font-bold text-[#17131D] focus:outline-none focus:border-[#6C4CF1]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#6E6875] mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-3 pr-11 bg-[#F5F2FF] border border-[#E8E0FF] rounded-2xl text-xs font-bold text-[#17131D] focus:outline-none focus:border-[#6C4CF1]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-[#6E6875] hover:text-[#6C4CF1]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white text-xs font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Authenticate Securely</span>
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-[10px] text-[#918A98] leading-relaxed text-center">
          Access requires an administrator role granted in the database. Role assignments and
          privileged actions are enforced server-side and recorded in the audit log.
        </p>
      </motion.div>
    </div>
  );
}
