"use client";

import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

/** Accessible dark/light switch. Dark is Obiren's default. */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={`relative w-14 h-8 rounded-full flex items-center px-1 transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9B6BFF] focus-visible:ring-offset-2 ${
        isDark
          ? "bg-white/10 border border-white/15"
          : "bg-[#E8DFFF] border border-[#C4B5FD]"
      } ${className}`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className={`w-6 h-6 rounded-full flex items-center justify-center shadow-md ${
          isDark ? "ml-auto bg-[#2B2142]" : "mr-auto bg-white"
        }`}
      >
        {isDark ? (
          <Moon className="w-3.5 h-3.5 text-[#C9BCFF]" aria-hidden="true" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-[#6D4AFF]" aria-hidden="true" />
        )}
      </motion.span>
    </button>
  );
}
