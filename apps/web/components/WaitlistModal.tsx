"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, ArrowRight, ShieldCheck, HeartHandshake } from "lucide-react";

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WaitlistModal({ isOpen, onClose }: WaitlistModalProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    countryCode: "GB",
    primaryGoal: "PERIOD_TRACKING",
    privacyConsent: true,
  });

  const [status, setStatus] = useState<{
    submitted: boolean;
    position?: number;
    message?: string;
  }>({ submitted: false });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok) {
        setStatus({
          submitted: true,
          position: data.position || 1420,
          message: data.message || "Your spot on the Obiren waitlist has been reserved.",
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl p-6 sm:p-10 w-full max-w-lg shadow-2xl relative border border-[#E8DFFF] overflow-hidden"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 text-[#666666] hover:bg-[#F4F1FF] rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {!status.submitted ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F4F1FF] text-[#6D4AFF] rounded-full text-xs font-semibold uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5" /> Early Access Program
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-[#171717] font-display">
                  Join the Obiren Waitlist
                </h3>
                <p className="text-xs text-[#666666] leading-relaxed">
                  Be among the first women to access Obiren when we launch in your region.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#666666] mb-1">First Name</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Amara"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#F4F1FF]/60 border border-[#E8DFFF] rounded-xl text-xs font-medium focus:outline-none focus:border-[#6D4AFF]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#666666] mb-1">Last Name</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Okafor"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#F4F1FF]/60 border border-[#E8DFFF] rounded-xl text-xs font-medium focus:outline-none focus:border-[#6D4AFF]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#666666] mb-1">Email Address</label>
                  <input
                    required
                    type="email"
                    placeholder="amara@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[#F4F1FF]/60 border border-[#E8DFFF] rounded-xl text-xs font-medium focus:outline-none focus:border-[#6D4AFF]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#666666] mb-1">Country</label>
                    <select
                      value={formData.countryCode}
                      onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                      className="w-full px-3 py-2.5 bg-[#F4F1FF]/60 border border-[#E8DFFF] rounded-xl text-xs font-bold text-[#171717] focus:outline-none"
                    >
                      <option value="GB">🇬🇧 United Kingdom</option>
                      <option value="US">🇺🇸 United States</option>
                      <option value="NG">🇳🇬 Nigeria</option>
                      <option value="GH">🇬🇭 Ghana</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#666666] mb-1">Primary Interest</label>
                    <select
                      value={formData.primaryGoal}
                      onChange={(e) => setFormData({ ...formData, primaryGoal: e.target.value })}
                      className="w-full px-3 py-2.5 bg-[#F4F1FF]/60 border border-[#E8DFFF] rounded-xl text-xs font-bold text-[#171717] focus:outline-none"
                    >
                      <option value="PERIOD_TRACKING">Period & Cycle Tracker</option>
                      <option value="PREGNANCY">Pregnancy Companion</option>
                      <option value="SAFETY">Safety & Silent SOS</option>
                      <option value="CONSULTATIONS">Doctor Consultations</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-[#6D4AFF] hover:bg-[#5B3DE0] text-white font-bold text-xs rounded-full shadow-lg shadow-[#6D4AFF]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Reserve My Spot</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="text-center space-y-6 py-4">
              <div className="w-16 h-16 bg-[#F4F1FF] text-[#6D4AFF] rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-9 h-9 text-[#38B26C]" />
              </div>
              
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F4F1FF] text-[#6D4AFF] rounded-full text-xs font-semibold uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5" /> Early Access Confirmed
                </span>
                <h3 className="text-2xl font-bold text-[#171717] font-display">You&apos;re on the list!</h3>
                <p className="text-[#666666] text-sm leading-relaxed max-w-md mx-auto">
                  {status.message}
                </p>
              </div>

              {status.position && (
                <div className="p-4 bg-[#F4F1FF] rounded-2xl border border-[#E8DFFF] flex items-center justify-around">
                  <div className="text-center">
                    <span className="text-xs text-[#666666] uppercase font-bold block">Waitlist Position</span>
                    <span className="text-2xl font-black text-[#6D4AFF]">#{status.position}</span>
                  </div>
                  <div className="h-8 w-[1px] bg-[#E8DFFF]" />
                  <div className="text-center">
                    <span className="text-xs text-[#666666] uppercase font-bold block">Status</span>
                    <span className="text-xs font-bold text-[#38B26C]">Priority Reserved</span>
                  </div>
                </div>
              )}

              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-[#171717] text-white text-xs font-bold rounded-full hover:bg-black transition-colors"
              >
                Close Window
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
