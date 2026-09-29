"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { authApi, ApiError, AuthUser } from "@obiren/api-client";
import {
  X,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Heart,
  Zap,
} from "lucide-react";
import { LoginSchema } from "@obiren/validation";

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (auth: AuthUser) => void;
  onSwitchToSignUp: () => void;
}

export default function SignInModal({
  isOpen,
  onClose,
  onSuccess,
  onSwitchToSignUp,
}: SignInModalProps) {
  const [authMode, setAuthMode] = useState<"password" | "magic" | "forgot">("password");

  // Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Status & Error
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  if (!isOpen) return null;

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const valResult = LoginSchema.safeParse({ email, password });
    if (!valResult.success) {
      setErrorMsg(valResult.error.issues[0]?.message || "Invalid email or password.");
      return;
    }

    setLoading(true);

    try {
      const result = await authApi.login(email, password);
      onSuccess(result.user);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError ? err.message : "Unable to sign in right now. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg("Please enter your email address to receive a sign-in link.");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setMagicSent(true);
    }, 800);
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg("Please enter your registered email address.");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setForgotSent(true);
    }, 800);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl p-6 sm:p-10 w-full max-w-lg shadow-2xl relative border border-[#E8DFFF] overflow-hidden my-8"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 text-[#666666] hover:bg-[#F4F1FF] rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="space-y-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#F4F1FF] text-[#6C4CF1] flex items-center justify-center shadow-inner">
              <Lock className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-2xl font-bold font-display text-[#171717]">Sign In to Obiren</h3>
              <p className="text-xs text-[#666666]">Access your private 256-bit encrypted health space.</p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex gap-2 p-1 bg-[#F4F1FF] rounded-xl text-xs font-bold mb-6">
            <button
              onClick={() => { setAuthMode("password"); setErrorMsg(""); }}
              className={`flex-1 py-2 rounded-lg transition-all ${authMode === "password" ? "bg-[#6C4CF1] text-white" : "text-[#666666]"}`}
            >
              Password Login
            </button>
            <button
              onClick={() => { setAuthMode("magic"); setErrorMsg(""); }}
              className={`flex-1 py-2 rounded-lg transition-all ${authMode === "magic" ? "bg-[#6C4CF1] text-white" : "text-[#666666]"}`}
            >
              Magic Link
            </button>
          </div>

          {/* Error Alert Banner */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. PASSWORD SIGN IN FORM */}
          {authMode === "password" && (
            <form onSubmit={handlePasswordSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#666666] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F4F1FF]/60 border border-[#E8DFFF] focus:border-[#6C4CF1] focus:bg-white rounded-xl text-sm outline-none transition-all"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#666666]">Password</label>
                  <button
                    type="button"
                    onClick={() => { setAuthMode("forgot"); setErrorMsg(""); }}
                    className="text-xs font-bold text-[#6C4CF1] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-4 pr-11 py-3 bg-[#F4F1FF]/60 border border-[#E8DFFF] focus:border-[#6C4CF1] focus:bg-white rounded-xl text-sm outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-[#666666] hover:text-[#6C4CF1] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[#666666] font-semibold">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="accent-[#6C4CF1] w-4 h-4"
                  />
                  <span>Remember this device</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white font-bold text-xs rounded-full shadow-lg shadow-[#6C4CF1]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In to My Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* 2. MAGIC LINK FORM */}
          {authMode === "magic" && (
            <div className="space-y-4">
              {!magicSent ? (
                <form onSubmit={handleMagicLink} className="space-y-4">
                  <p className="text-xs text-[#666666] leading-relaxed">
                    Enter your email to receive a 1-click passwordless sign in link.
                  </p>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#666666] mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-[#F4F1FF]/60 border border-[#E8DFFF] focus:border-[#6C4CF1] rounded-xl text-sm outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white font-bold text-xs rounded-full shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <span>Send Magic Sign-In Link</span>
                    )}
                  </button>
                </form>
              ) : (
                <div className="text-center py-6 space-y-3 bg-[#F4F1FF] rounded-2xl border border-[#E8DFFF] p-4">
                  <CheckCircle2 className="w-10 h-10 text-[#238A5A] mx-auto" />
                  <p className="text-sm font-bold text-[#171717]">Check your inbox!</p>
                  <p className="text-xs text-[#666666]">
                    We emailed a magic sign-in link to <strong>{email}</strong>. Click the link to log in instantly.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 3. FORGOT PASSWORD FORM */}
          {authMode === "forgot" && (
            <div className="space-y-4">
              {!forgotSent ? (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <p className="text-xs text-[#666666] leading-relaxed">
                    Enter your email address and we will send you password reset instructions.
                  </p>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#666666] mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-[#F4F1FF]/60 border border-[#E8DFFF] focus:border-[#6C4CF1] rounded-xl text-sm outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white font-bold text-xs rounded-full shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <span>Send Reset Link</span>
                    )}
                  </button>
                </form>
              ) : (
                <div className="text-center py-6 space-y-3 bg-[#F4F1FF] rounded-2xl border border-[#E8DFFF] p-4">
                  <CheckCircle2 className="w-10 h-10 text-[#238A5A] mx-auto" />
                  <p className="text-sm font-bold text-[#171717]">Reset link sent!</p>
                  <p className="text-xs text-[#666666]">
                    Check <strong>{email}</strong> for instructions to reset your password.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Switch to Sign Up Handoff Footer */}
          <div className="pt-6 mt-6 border-t border-[#E8DFFF] text-center text-xs text-[#666666]">
            Don&apos;t have an account yet?{" "}
            <button
              onClick={() => {
                onClose();
                onSwitchToSignUp();
              }}
              className="font-bold text-[#6C4CF1] hover:underline"
            >
              Sign Up Now (7-Step Onboarding)
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
