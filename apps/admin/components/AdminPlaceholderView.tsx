"use client";

import { Hammer } from "lucide-react";

interface AdminPlaceholderViewProps {
  activeTab: string;
}

export default function AdminPlaceholderView({ activeTab }: AdminPlaceholderViewProps) {
  const formattedTitle = activeTab
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return (
    <div className="space-y-6 max-w-7xl mx-auto h-[60vh] flex flex-col items-center justify-center text-center">
      <div className="w-20 h-20 bg-[#F5F2FF] rounded-full flex items-center justify-center text-[#6C4CF1] mb-4 shadow-sm border border-[#E8E0FF]">
        <Hammer className="w-10 h-10" />
      </div>
      <h2 className="text-3xl font-bold font-display text-[#17131D]">
        {formattedTitle} Module
      </h2>
      <p className="text-[#6E6875] max-w-md mx-auto leading-relaxed">
        This administrative module is currently under development or pending authorization.
        Please check back later or contact the platform engineering team for access.
      </p>
    </div>
  );
}
