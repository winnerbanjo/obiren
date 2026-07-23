"use client";

import { Heart } from "lucide-react";
import Link from "next/link";

interface FooterProps {
  onOpenWaitlist?: () => void;
}

export default function Footer({ onOpenWaitlist }: FooterProps) {
  return (
    <footer className="bg-[#1C152B] text-white pt-16 pb-12 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-white/10">
          
          {/* Brand Col */}
          <div className="md:col-span-4 space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6D4AFF] to-[#9B6BFF] flex items-center justify-center text-white shadow-md">
                <Heart className="w-5 h-5 fill-white/20" />
              </div>
              <span className="text-2xl font-bold font-display tracking-tight text-white">
                Obiren<span className="text-[#9B6BFF]">.</span>
              </span>
            </Link>

            <p className="text-xs text-white/70 leading-relaxed max-w-sm">
              Health. Safety. Peace of Mind.
              <br />
              Obiren means <span className="text-[#9B6BFF] font-semibold">Woman</span> in Itsekiri.
            </p>

            <p className="text-[11px] text-white/50">
              Launching first in Nigeria, with planned expansion into Ghana, the United Kingdom and the United States.
            </p>
          </div>

          {/* Care */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#9B6BFF]">Care</h4>
            <ul className="space-y-2 text-xs text-white/70">
              <li><Link href="/features/consult" className="hover:text-white transition-colors">Consult a Specialist</Link></li>
              <li><Link href="/features/cycle-tracking" className="hover:text-white transition-colors">Cycle Tracking</Link></li>
              <li><Link href="/features/pregnancy" className="hover:text-white transition-colors">Pregnancy Companion</Link></li>
              <li><Link href="/features/health-vault" className="hover:text-white transition-colors">Health Vault</Link></li>
              <li><Link href="/features/safety-sos" className="hover:text-white transition-colors">Safety Centre</Link></li>
            </ul>
          </div>

          {/* Learn */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#9B6BFF]">Learn</h4>
            <ul className="space-y-2 text-xs text-white/70">
              <li><Link href="/learn" className="hover:text-white transition-colors">Women’s Health Library</Link></li>
              <li><Link href="/learn#fibroids" className="hover:text-white transition-colors">Fibroids</Link></li>
              <li><Link href="/learn#pcos" className="hover:text-white transition-colors">PCOS</Link></li>
              <li><Link href="/learn#endometriosis" className="hover:text-white transition-colors">Endometriosis</Link></li>
              <li><Link href="/learn#pregnancy" className="hover:text-white transition-colors">Pregnancy and Birth</Link></li>
              <li><Link href="/learn#sexual-health" className="hover:text-white transition-colors">Sexual Health</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#9B6BFF]">Company</h4>
            <ul className="space-y-2 text-xs text-white/70">
              <li><Link href="/about" className="hover:text-white transition-colors">About Obiren</Link></li>
              <li><Link href="/legal/compliance" className="hover:text-white transition-colors">Our Clinical Approach</Link></li>
              <li><Link href="/professionals" className="hover:text-white transition-colors">For Healthcare Professionals</Link></li>
              <li><Link href="/about#careers" className="hover:text-white transition-colors">Careers</Link></li>
              <li><a href="mailto:contact@obiren.com" className="hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>

          {/* Trust and Legal */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#9B6BFF]">Trust and Legal</h4>
            <ul className="space-y-2 text-xs text-white/70">
              <li><Link href="/legal/privacy" className="hover:text-white transition-colors">Privacy Notice</Link></li>
              <li><Link href="/legal/terms" className="hover:text-white transition-colors">Terms of Use</Link></li>
              <li><Link href="/legal/compliance" className="hover:text-white transition-colors">Clinical Safety</Link></li>
              <li><Link href="/legal/privacy" className="hover:text-white transition-colors">Data Protection</Link></li>
              <li><Link href="/legal/compliance" className="hover:text-white transition-colors">Accessibility</Link></li>
              <li><Link href="/legal/terms" className="hover:text-white transition-colors">Emergency Disclaimer</Link></li>
            </ul>
          </div>

        </div>

        {/* Bottom copyright */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/50 text-center md:text-left">
          <p>© {new Date().getFullYear()} Obiren. All rights reserved.</p>
          <p className="max-w-xl text-[10px]">Obiren does not replace emergency services. In an emergency, contact the official emergency service available in your location.</p>
        </div>

      </div>
    </footer>
  );
}
