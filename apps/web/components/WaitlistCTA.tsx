"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, CheckCircle2, Mail, Globe } from "lucide-react";

interface WaitlistCTAProps {
  onOpenWaitlist: () => void;
}

export default function WaitlistCTA({ onOpenWaitlist }: WaitlistCTAProps) {
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("GB");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, countryCode: country }),
      });

      if (res.ok) {
        setSubmitted(true);
        setEmail("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="waitlist" className="py-24 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Box */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="bg-gradient-to-br from-[#21182F] via-[#2F2148] to-[#21182F] text-white rounded-[40px] p-8 sm:p-16 shadow-2xl relative overflow-hidden text-center border border-purple-900/50"
        >
          {/* Background Ambient Circles */}
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-purple-900/20 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto space-y-8">
            {/* Pill */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/15 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider text-white border border-white/20">
              <ShieldCheck className="w-4 h-4 text-white" /> Early Access Program
            </div>

            {/* Headline */}
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold font-display tracking-tight leading-tight">
              Join thousands of women preparing for a healthier future.
            </h2>

            {/* Supporting Copy */}
            <p className="text-base sm:text-xl text-white/80 leading-relaxed font-normal max-w-2xl mx-auto">
              Be the first to know when Obiren launches. Join the waitlist today and receive early access, exclusive product updates, and launch announcements.
            </p>

            {/* Inline Form */}
            {!submitted ? (
              <form onSubmit={handleSubmit} className="max-w-xl mx-auto space-y-4">
                <div className="flex flex-col sm:flex-row items-center gap-3 p-2 bg-white/10 backdrop-blur-xl rounded-full border border-white/20">
                  <div className="flex items-center gap-2 px-4 py-2 text-white/70 text-xs font-medium shrink-0">
                    <Globe className="w-4 h-4 text-[#9B6BFF]" />
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="bg-transparent text-white focus:outline-none cursor-pointer font-bold"
                    >
                      <option value="GB" className="text-black">🇬🇧 UK</option>
                      <option value="US" className="text-black">🇺🇸 US</option>
                      <option value="NG" className="text-black">🇳🇬 NG</option>
                      <option value="GH" className="text-black">🇬🇭 GH</option>
                    </select>
                  </div>

                  <input
                    type="email"
                    required
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-transparent text-white placeholder-white/50 text-sm focus:outline-none"
                  />

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full sm:w-auto px-8 py-3.5 bg-[#6D4AFF] hover:bg-[#5B3DE0] text-white font-bold text-xs rounded-full shadow-lg transition-all shrink-0 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Join Waitlist</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-center gap-4 text-xs text-white/60 pt-2">
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-[#38B26C]" /> Priority Access</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-[#38B26C]" /> Exclusive Updates</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-[#38B26C]" /> Zero Spam</span>
                </div>
              </form>
            ) : (
              <div className="p-6 bg-white/10 rounded-3xl border border-white/20 text-center space-y-2 max-w-md mx-auto">
                <CheckCircle2 className="w-10 h-10 text-[#38B26C] mx-auto" />
                <h3 className="text-xl font-bold font-display text-white">You&apos;re on the list!</h3>
                <p className="text-xs text-white/80">
                  Thank you for joining Obiren early access. We will notify you as soon as launch doors open in your country.
                </p>
              </div>
            )}

          </div>
        </motion.div>

      </div>
    </section>
  );
}
