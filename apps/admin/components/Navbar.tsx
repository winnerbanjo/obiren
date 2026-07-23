"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowUpRight, Heart, LogIn, UserPlus } from "lucide-react";
import Link from "next/link";

interface NavbarProps {
  onOpenWaitlist?: () => void;
  onOpenSignIn?: () => void;
  onOpenSignUp?: () => void;
}

export default function Navbar({
  onOpenWaitlist,
  onOpenSignIn,
  onOpenSignUp,
}: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Consult a Specialist", href: "/features/consult" },
    { name: "Cycle Tracking", href: "/features/cycle-tracking" },
    { name: "Pregnancy", href: "/features/pregnancy" },
    { name: "Safety", href: "/features/safety-sos" },
    { name: "Health Library", href: "/learn" },
    { name: "About", href: "/about" },
  ];

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          scrolled
            ? "bg-white/90 backdrop-blur-xl border-b border-[#E8DFFF]/60 shadow-sm"
            : "bg-transparent"
        }`}
      >
        {/* Announcement Bar */}
        <div className="bg-[#6C4CF1] text-white text-[10px] sm:text-xs font-semibold tracking-wide py-2 text-center px-4">
          Launching first in Nigeria 🇳🇬, with the United Kingdom 🇬🇧, United States 🇺🇸 and Ghana 🇬🇭 to follow.
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            
            {/* Brand Logo */}
            <Link
              href="/"
              className="flex items-center gap-2 group text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6C4CF1] to-[#9B6BFF] flex items-center justify-center text-white shadow-md shadow-[#6C4CF1]/20 group-hover:scale-105 transition-transform">
                <Heart className="w-5 h-5 fill-white/20" />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold font-display tracking-tight text-[#17131D]">
                  Obiren<span className="text-[#6C4CF1]">.</span>
                </span>
                <span className="text-[10px] uppercase font-semibold tracking-widest text-[#6E6875] -mt-1 hidden sm:block">
                  Health & Safety
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1 bg-[#F5F2FF]/80 px-4 py-1.5 rounded-full border border-[#E8E0FF]">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="px-3.5 py-1.5 text-xs font-semibold text-[#6E6875] hover:text-[#6C4CF1] transition-colors rounded-full hover:bg-white/80"
                >
                  {link.name}
                </Link>
              ))}
            </nav>

            {/* Right Action Auth Buttons */}
            <div className="hidden md:flex items-center gap-3">
              {/* Sign In Button */}
              <button
                onClick={() => onOpenSignIn ? onOpenSignIn() : window.location.href = "/"}
                className="px-4.5 py-2.5 bg-white border border-[#E7E2EB] hover:bg-[#F5F2FF] hover:border-[#6C4CF1] text-[#17131D] text-xs font-bold rounded-full transition-all flex items-center gap-1.5 shadow-sm"
              >
                <LogIn className="w-4 h-4 text-[#6C4CF1]" />
                <span>Sign In</span>
              </button>

              {/* Sign Up Button */}
              <button
                onClick={() => onOpenSignUp ? onOpenSignUp() : window.location.href = "/"}
                className="px-5 py-2.5 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white text-xs font-bold rounded-full shadow-lg shadow-[#6C4CF1]/25 hover:shadow-xl hover:shadow-[#6C4CF1]/35 hover:-translate-y-0.5 transition-all flex items-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create Free Account</span>
              </button>
            </div>

            {/* Mobile Hamburger & Actions */}
            <div className="md:hidden flex items-center gap-2">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-[#17131D] hover:bg-[#F5F2FF] rounded-xl transition-colors"
                aria-label="Toggle navigation"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="fixed top-[64px] left-0 right-0 z-30 bg-white/95 backdrop-blur-2xl border-b border-[#E8DFFF] md:hidden px-6 py-6 shadow-2xl"
          >
            <div className="flex flex-col gap-3">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-3 px-4 text-base font-semibold text-[#17131D] hover:text-[#6C4CF1] hover:bg-[#F5F2FF] rounded-xl transition-all"
                >
                  {link.name}
                </Link>
              ))}
              <div className="pt-4 border-t border-[#E8DFFF] flex flex-col gap-3">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (onOpenSignIn) onOpenSignIn();
                    else window.location.href = "/";
                  }}
                  className="w-full py-3 bg-white border border-[#E7E2EB] text-[#17131D] font-bold text-sm rounded-xl text-center"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (onOpenSignUp) onOpenSignUp();
                    else window.location.href = "/";
                  }}
                  className="w-full py-3.5 bg-[#6C4CF1] text-white font-bold text-sm rounded-xl text-center shadow-lg shadow-[#6C4CF1]/30"
                >
                  Create Free Account
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
