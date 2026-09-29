"use client";

import { ShieldAlert, Database } from "lucide-react";

interface AdminPlaceholderViewProps {
  activeTab: string;
  title?: string;
  description?: string;
}

/**
 * Renders an honest "not yet implemented" state for admin modules whose
 * backend functionality does not exist yet. We deliberately avoid fake
 * datasets so no screen pretends an action succeeded.
 */
export default function AdminPlaceholderView({
  activeTab,
  title,
  description,
}: AdminPlaceholderViewProps) {
  const label = title || activeTab.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white p-10 rounded-3xl border border-[#E7E2EB] shadow-sm text-center space-y-3">
        <Database className="w-10 h-10 text-[#918A98] mx-auto" />
        <h3 className="text-lg font-bold font-display text-[#17131D]">{label} — Coming Soon</h3>
        <p className="text-xs text-[#6E6875] max-w-md mx-auto">
          {description ||
            "This module does not have backend functionality yet. Rather than displaying simulated data, this screen will become available once the corresponding API is implemented."}
        </p>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F5F2FF] text-[#6C4CF1] rounded-full text-[10px] font-bold uppercase tracking-wider">
          <ShieldAlert className="w-3.5 h-3.5" /> No simulated data shown
        </div>
      </div>
    </div>
  );
}
