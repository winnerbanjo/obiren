"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { RegisterSchema } from "@obiren/validation";
import { authApi, ApiError, AuthUser } from "@obiren/api-client";

interface OnboardingFlowProps {
  onComplete: (auth: AuthUser) => void;
}

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(1);

  // Form States
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    countryCode: "NG",
    statedAverageCycleLength: 28,
    termsAccepted: false,
    privacyAccepted: false,
    healthDataProcessingConsent: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);

  // Password Requirement Checks
  const hasMinLength = formData.password.length >= 8;
  const hasUppercase = /[A-Z]/.test(formData.password);
  const hasNumber = /[0-9]/.test(formData.password);
  const passwordsMatch = formData.password !== "" && formData.password === formData.confirmPassword;

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleNextStep = async () => {
    setErrorMsg("");

    if (currentStep === 2) {
      if (!formData.firstName.trim() || !formData.lastName.trim()) {
        setErrorMsg("Please enter your first and last name.");
        return;
      }
      if (!hasMinLength || !hasUppercase || !hasNumber) {
        setErrorMsg("Please meet all password requirements before proceeding.");
        return;
      }
      if (!passwordsMatch) {
        setErrorMsg("Passwords do not match.");
        return;
      }
    }

    if (currentStep === 3) {
      if (!formData.termsAccepted || !formData.privacyAccepted || !formData.healthDataProcessingConsent) {
        setErrorMsg("You must accept all terms and consents to proceed.");
        return;
      }

      // Final step: register the real account through the API.
      setSubmitting(true);
      try {
        const parsed = RegisterSchema.safeParse({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email,
          password: formData.password,
          countryCode: formData.countryCode,
        });
        if (!parsed.success) {
          setErrorMsg(parsed.error.issues[0]?.message || "Please check your details.");
          return;
        }

        await authApi.register(parsed.data);

        // Registration succeeded. The account requires email verification
        // before sign-in, so hand back to the landing page with a notice.
        setVerificationRequired(true);
      } catch (err) {
        if (err instanceof ApiError) {
          setErrorMsg(err.message || "Registration failed.");
        } else {
          setErrorMsg("Unable to create your account right now. Please try again.");
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (currentStep < 7) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  if (verificationRequired) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-3xl p-6 sm:p-10 border border-[#E7E2EB] shadow-2xl space-y-6 text-center">
        <CheckCircle2 className="w-14 h-14 text-[#238A5A] mx-auto" />
        <div className="space-y-2">
          <h3 className="text-2xl font-extrabold font-display text-[#17131D]">Almost there - verify your email</h3>
          <p className="text-xs sm:text-sm text-[#6E6875] leading-relaxed">
            We sent a verification link to <strong>{formData.email}</strong>.
            Click the link to activate your account, then sign in.
          </p>
        </div>
        <button
          onClick={() => onComplete({} as AuthUser)}
          className="px-6 py-2.5 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white text-xs font-bold rounded-full shadow-md transition-all inline-flex items-center gap-1.5"
        >
          Back to Sign In <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-3xl p-5 sm:p-10 border border-[#E7E2EB] shadow-2xl space-y-6 sm:space-y-8">
      {/* Progress Bar & Step Numbers */}
      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs font-bold">
          <span className="text-[#6C4CF1] uppercase tracking-wider">Step {currentStep} of 7</span>
          <span className="text-[#6E6875]">
            {currentStep === 1 && "Welcome"}
            {currentStep === 2 && "Account & Password"}
            {currentStep === 3 && "Privacy & Consents"}
            {currentStep === 4 && "Personalization"}
            {currentStep === 5 && "Cycle Setup"}
            {currentStep === 6 && "Discreet Mode"}
            {currentStep === 7 && "Complete"}
          </span>
        </div>

        {/* Step Circles */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {Array.from({ length: 7 }, (_, i) => i + 1).map((step) => (
            <div
              key={step}
              className={`h-2 flex-1 rounded-full transition-all ${
                step <= currentStep ? "bg-[#6C4CF1]" : "bg-[#F5F2FF]"
              }`}
            />
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Step Content Views */}
      <AnimatePresence mode="wait">
        {currentStep === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
            <h3 className="text-2xl font-extrabold font-display text-[#17131D]">Welcome to Obiren</h3>
            <p className="text-xs sm:text-sm text-[#6E6875] leading-relaxed">
              We are excited to welcome you to a private, empowering health and safety space designed specifically for women.
            </p>
            <div className="p-4 bg-[#F5F2FF] rounded-2xl border border-[#E8E0FF] space-y-2 text-xs">
              <span className="font-bold text-[#6C4CF1] flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Privacy Guarantee</span>
              <p className="text-[#6E6875]">Your records are encrypted. We never sell your data to advertisers.</p>
            </div>
          </motion.div>
        )}

        {currentStep === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
            <h3 className="text-xl sm:text-2xl font-extrabold font-display text-[#17131D]">Account & Security</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase text-[#6E6875] mb-1">First Name</label>
                <input
                  type="text"
                  required
                  placeholder="Ada"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  autoComplete="given-name"
                  className="w-full px-4 py-3 bg-[#F5F2FF]/60 border border-[#E8E0FF] rounded-xl text-base sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-[#6E6875] mb-1">Last Name</label>
                <input
                  type="text"
                  required
                  placeholder="Obi"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  autoComplete="family-name"
                  className="w-full px-4 py-3 bg-[#F5F2FF]/60 border border-[#E8E0FF] rounded-xl text-base sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#6E6875] mb-1">Email Address</label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                autoComplete="email"
                className="w-full px-4 py-3 bg-[#F5F2FF]/60 border border-[#E8E0FF] rounded-xl text-base sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#6E6875] mb-1">Country</label>
              <select
                value={formData.countryCode}
                onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                className="w-full px-4 py-3 bg-[#F5F2FF]/60 border border-[#E8E0FF] rounded-xl text-base sm:text-sm"
              >
                <option value="NG">🇳🇬 Nigeria</option>
                <option value="GH">🇬🇭 Ghana</option>
                <option value="GB">🇬🇧 United Kingdom</option>
                <option value="US">🇺🇸 United States</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#6E6875] mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Create password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  autoComplete="new-password"
                  className="w-full pl-4 pr-11 py-3 bg-[#F5F2FF]/60 border border-[#E8E0FF] rounded-xl text-base sm:text-sm"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-3.5 text-[#6E6875]">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#6E6875] mb-1">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  placeholder="Confirm password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  autoComplete="new-password"
                  className="w-full pl-4 pr-11 py-3 bg-[#F5F2FF]/60 border border-[#E8E0FF] rounded-xl text-base sm:text-sm"
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3.5 top-3.5 text-[#6E6875]">
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Real-time Checklist */}
            <div className="p-3 bg-[#F5F2FF] rounded-2xl space-y-1.5 text-xs">
              <div className={`flex items-center gap-2 ${hasMinLength ? "text-emerald-600 font-bold" : "text-[#6E6875]"}`}>
                <CheckCircle2 className="w-4 h-4" /> At least 8 characters
              </div>
              <div className={`flex items-center gap-2 ${hasUppercase ? "text-emerald-600 font-bold" : "text-[#6E6875]"}`}>
                <CheckCircle2 className="w-4 h-4" /> At least 1 uppercase letter
              </div>
              <div className={`flex items-center gap-2 ${hasNumber ? "text-emerald-600 font-bold" : "text-[#6E6875]"}`}>
                <CheckCircle2 className="w-4 h-4" /> At least 1 number
              </div>
              <div className={`flex items-center gap-2 ${passwordsMatch ? "text-emerald-600 font-bold" : "text-[#6E6875]"}`}>
                <CheckCircle2 className="w-4 h-4" /> Passwords match
              </div>
            </div>
          </motion.div>
        )}

        {currentStep === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
            <h3 className="text-xl sm:text-2xl font-extrabold font-display text-[#17131D]">Consents & Agreements</h3>
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 bg-[#F5F2FF]/60 rounded-xl cursor-pointer text-xs text-[#17131D]">
                <input
                  type="checkbox"
                  checked={formData.termsAccepted}
                  onChange={(e) => setFormData({ ...formData, termsAccepted: e.target.checked })}
                  className="accent-[#6C4CF1] w-4 h-4 mt-0.5"
                />
                <span>I accept the Obiren Terms of Service (v1.0)</span>
              </label>

              <label className="flex items-start gap-3 p-3 bg-[#F5F2FF]/60 rounded-xl cursor-pointer text-xs text-[#17131D]">
                <input
                  type="checkbox"
                  checked={formData.privacyAccepted}
                  onChange={(e) => setFormData({ ...formData, privacyAccepted: e.target.checked })}
                  className="accent-[#6C4CF1] w-4 h-4 mt-0.5"
                />
                <span>I accept the Obiren Privacy Policy (v1.0)</span>
              </label>

              <label className="flex items-start gap-3 p-3 bg-[#F5F2FF]/60 rounded-xl cursor-pointer text-xs text-[#17131D]">
                <input
                  type="checkbox"
                  checked={formData.healthDataProcessingConsent}
                  onChange={(e) => setFormData({ ...formData, healthDataProcessingConsent: e.target.checked })}
                  className="accent-[#6C4CF1] w-4 h-4 mt-0.5"
                />
                <span>I consent to processing of sensitive health records</span>
              </label>
            </div>
          </motion.div>
        )}

        {currentStep >= 4 && (
          <motion.div key="step4" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4 text-center py-4">
            <CheckCircle2 className="w-12 h-12 text-[#238A5A] mx-auto" />
            <h3 className="text-xl font-bold font-display text-[#17131D]">Ready to Create Your Account</h3>
            <p className="text-xs text-[#6E6875]">Click continue to create your encrypted account and verify your email.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Footer */}
      <div className="flex justify-between items-center pt-4 border-t border-[#E7E2EB]">
        {currentStep > 1 && !submitting ? (
          <button
            onClick={handlePrevStep}
            className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#17131D] text-xs font-bold rounded-full transition-colors flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        ) : <div />}

        <button
          onClick={handleNextStep}
          disabled={submitting}
          className="px-6 py-2.5 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white text-xs font-bold rounded-full shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
        >
          {submitting ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>{currentStep === 3 ? "Create My Account" : "Continue"}</span>
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
