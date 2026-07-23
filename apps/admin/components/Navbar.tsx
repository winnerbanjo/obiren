"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowUpRight, Heart, LogIn, UserPlus } from "lucide-react";

interface NavbarProps {
  onOpenWaitlist: () => void;
  onOpenSignIn: () => void;
  onOpenSignUp: () => void;
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
    { name: "Features", href: "#features" },
    { name: "Safety", href: "#safety" },
    { name: "Education", href: "#education" },
    { name: "Privacy", href: "#privacy" },
    { name: "Roadmap", href: "#roadmap" },
  ];

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          scrolled
            ? "py-3 bg-white/90 backdrop-blur-xl border-b border-[#E8DFFF]/60 shadow-sm"
            : "py-5 bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            
            {/* Brand Logo */}
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
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
            </button>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1 bg-[#F5F2FF]/80 px-4 py-1.5 rounded-full border border-[#E8E0FF]">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="px-3.5 py-1.5 text-xs font-semibold text-[#6E6875] hover:text-[#6C4CF1] transition-colors rounded-full hover:bg-white/80"
                >
                  {link.name}
                </a>
              ))}
            </nav>

            {/* Right Action Auth Buttons */}
            <div className="hidden md:flex items-center gap-3">
              {/* Admin Portal Link */}
              <a
                href="/admin"
                className="px-4.5 py-2.5 bg-[#17131D] hover:bg-[#2A2333] text-white text-xs font-bold rounded-full transition-all flex items-center gap-1.5 shadow-sm"
              >
                <span>Admin Portal</span>
              </a>

              {/* Sign In Button */}
              <button
                onClick={onOpenSignIn}
                className="px-4.5 py-2.5 bg-white border border-[#E7E2EB] hover:bg-[#F5F2FF] hover:border-[#6C4CF1] text-[#17131D] text-xs font-bold rounded-full transition-all flex items-center gap-1.5 shadow-sm"
              >
                <LogIn className="w-4 h-4 text-[#6C4CF1]" />
                <span>Sign In</span>
              </button>

              {/* Sign Up Button */}
              <button
                onClick={onOpenSignUp}
                className="px-5 py-2.5 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white text-xs font-bold rounded-full shadow-lg shadow-[#6C4CF1]/25 hover:shadow-xl hover:shadow-[#6C4CF1]/35 hover:-translate-y-0.5 transition-all flex items-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" />
                <span>Sign Up</span>
              </button>
            </div>

            {/* Mobile Hamburger & Actions */}
            <div className="md:hidden flex items-center gap-2">
              <a
                href="/admin"
                className="px-3 py-1.5 bg-[#17131D] text-white text-[10px] font-bold rounded-full"
              >
                Admin
              </a>
              <button
                onClick={onOpenSignIn}
                className="px-3 py-1.5 bg-white border border-[#E7E2EB] text-[#17131D] text-[10px] font-bold rounded-full"
              >
                Sign In
              </button>
              <button
                onClick={onOpenSignUp}
                className="px-3 py-1.5 bg-[#6C4CF1] text-white text-[10px] font-bold rounded-full"
              >
                Sign Up
              </button>
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
                <a
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-3 px-4 text-base font-semibold text-[#17131D] hover:text-[#6C4CF1] hover:bg-[#F5F2FF] rounded-xl transition-all"
                >
                  {link.name}
                </a>
              ))}
              <div className="pt-4 border-t border-[#E8DFFF] flex flex-col gap-3">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenSignIn();
                  }}
                  className="w-full py-3 bg-white border border-[#E7E2EB] text-[#17131D] font-bold text-sm rounded-xl text-center"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenSignUp();
                  }}
                  className="w-full py-3.5 bg-[#6C4CF1] text-white font-bold text-sm rounded-xl text-center shadow-lg shadow-[#6C4CF1]/30"
                >
                  Sign Up (Create Account)
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
