"use client";

import { useState, useEffect } from "react";
import {
  ShieldAlert,
  Radio,
  Plus,
  PhoneCall,
  MapPin,
  CheckCircle2,
  AlertCircle,
  X,
  Hospital,
  Building2,
  ExternalLink,
  Search,
} from "lucide-react";
import { VERIFIED_EMERGENCY_DATASET, VerifiedEmergencyRecord } from "@obiren/localization";

interface AdminSafetyViewProps {
  selectedCountry: string;
  activeTabId?: string;
}

export default function AdminSafetyView({ selectedCountry, activeTabId }: AdminSafetyViewProps) {
  const defaultTab = activeTabId === "safety_incidents" ? "incidents" : "directory";
  const [activeTab, setActiveTab] = useState<"directory" | "incidents">(defaultTab);

  // Keep internal tab in sync if sidebar changes
  useEffect(() => {
    if (activeTabId === "safety_incidents") setActiveTab("incidents");
    else if (activeTabId === "emergency_resources") setActiveTab("directory");
  }, [activeTabId]);
  const [searchQuery, setSearchQuery] = useState("");

  // Initial Emergency Resources Directory populated with 31 verified records
  const [resources, setResources] = useState<VerifiedEmergencyRecord[]>(VERIFIED_EMERGENCY_DATASET);

  const [showAddResource, setShowAddResource] = useState(false);
  const [newResource, setNewResource] = useState({
    name: "",
    country: "Nigeria",
    countryCode: "NG" as "NG" | "GH" | "GB" | "US",
    category: "Emergency services",
    phone: "",
    city: "",
    address: "",
    summary: "",
  });

  const filteredResources = resources.filter((r) => {
    const matchesCountry = selectedCountry === "ALL" || r.countryCode === selectedCountry;
    const matchesQuery =
      r.organisation_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.service_summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.top_category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCountry && matchesQuery;
  });

  const handleAddResource = (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: VerifiedEmergencyRecord = {
      record_id: `${newResource.countryCode}-${Date.now().toString().slice(-3)}`,
      organisation_name: newResource.name,
      top_category: newResource.category,
      service_category: "General Emergency",
      country: newResource.country,
      countryCode: newResource.countryCode,
      region: newResource.city || "Nationwide",
      city: newResource.city,
      phone: newResource.phone,
      whatsapp_or_text: "",
      email: "",
      service_summary: newResource.summary || "Emergency service contact.",
      hours: "24/7",
      cost: "Free",
      organisation_type: "Government / NGO",
      verification_status: "Source verified",
      obiren_follow_up: "Operational confirmation",
      source_url: "",
    };

    setResources([newRecord, ...resources]);
    setShowAddResource(false);
    setNewResource({ name: "", country: "Nigeria", countryCode: "NG", category: "Emergency services", phone: "", city: "", address: "", summary: "" });
  };

  const incidents = [
    {
      id: "inc-9921",
      user: "Ella Vance",
      country: "NG",
      flag: "🇳🇬",
      type: "Web SOS Panic Button (Test)",
      time: "Today at 02:15 PM",
      gps: "6.5244° N, 3.3792° E",
      guardiansNotified: 4,
      status: "RESOLVED",
    },
    {
      id: "inc-9922",
      user: "Chloe Vance",
      country: "GB",
      flag: "🇬🇧",
      type: "Web SOS Panic Button",
      time: "Yesterday at 11:40 PM",
      gps: "51.5074° N, 0.1278° W",
      guardiansNotified: 2,
      status: "RESOLVED",
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm">
        <div>
          <h2 className="text-2xl font-bold font-display text-[#17131D]">Safety Incidents & Emergency Directory ({resources.length} Entries)</h2>
          <p className="text-xs text-[#6E6875]">Curate 31 source-verified emergency contacts across Nigeria, Ghana, UK & US, and monitor SOS triggers.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("directory")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              activeTab === "directory" ? "bg-[#6C4CF1] text-white" : "bg-[#F5F2FF] text-[#6E6875]"
            }`}
          >
            Directory Entries ({filteredResources.length})
          </button>
          <button
            onClick={() => setActiveTab("incidents")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              activeTab === "incidents" ? "bg-[#6C4CF1] text-white" : "bg-[#F5F2FF] text-[#6E6875]"
            }`}
          >
            SOS Incidents Log
          </button>
        </div>
      </div>

      {activeTab === "directory" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-lg font-bold font-display text-[#17131D]">Geospatial Verified Directory Database</h3>

            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#6E6875]" />
                <input
                  type="text"
                  placeholder="Search 31 emergency records..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#F5F2FF] border border-[#E8E0FF] rounded-full text-xs font-medium focus:outline-none"
                />
              </div>

              <button
                onClick={() => setShowAddResource(true)}
                className="px-4 py-2.5 bg-[#6C4CF1] text-white text-xs font-bold rounded-full flex items-center gap-1.5 shadow-md shrink-0"
              >
                <Plus className="w-4 h-4" /> Add Record
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-[#E7E2EB] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F5F2FF]/60 border-b border-[#E7E2EB] text-[#6E6875] uppercase text-[10px] font-bold tracking-wider">
                    <th className="py-4 px-4">Record ID</th>
                    <th className="py-4 px-4">Organisation Name</th>
                    <th className="py-4 px-4">Country & Region</th>
                    <th className="py-4 px-4">Category</th>
                    <th className="py-4 px-4">Phone / Contact</th>
                    <th className="py-4 px-4">Hours & Cost</th>
                    <th className="py-4 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E2EB]">
                  {filteredResources.map((res) => (
                    <tr key={res.record_id} className="hover:bg-[#F5F2FF]/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#6C4CF1]">{res.record_id}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#17131D]">{res.organisation_name}</div>
                        <div className="text-[11px] text-[#6E6875] line-clamp-1">{res.service_summary}</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-[#17131D]">
                        {res.country} ({res.region || "Nationwide"})
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-[#6C4CF1]">{res.top_category}</span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#17131D]">
                        {res.phone || "Online Referral"}
                      </td>
                      <td className="py-3 px-4 text-[#6E6875]">
                        {res.hours} • {res.cost}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-[#238A5A] border border-emerald-200">
                          {res.verification_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Resource Modal */}
          {showAddResource && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
                <div className="flex justify-between items-center">
                  <h4 className="text-lg font-bold font-display">Add Emergency Directory Record</h4>
                  <button onClick={() => setShowAddResource(false)}><X className="w-5 h-5 text-[#6E6875]" /></button>
                </div>

                <form onSubmit={handleAddResource} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-[#6E6875] mb-1">Organisation Name</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Lagos State General Hospital ER"
                      value={newResource.name}
                      onChange={(e) => setNewResource({ ...newResource, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] rounded-xl text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold uppercase text-[#6E6875] mb-1">Country</label>
                      <select
                        value={newResource.countryCode}
                        onChange={(e) => {
                          const code = e.target.value as any;
                          const nameMap: any = { NG: "Nigeria", GB: "United Kingdom", US: "United States", GH: "Ghana" };
                          setNewResource({ ...newResource, countryCode: code, country: nameMap[code] });
                        }}
                        className="w-full px-3 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] rounded-xl text-xs font-bold"
                      >
                        <option value="NG">🇳🇬 Nigeria</option>
                        <option value="GB">🇬🇧 United Kingdom</option>
                        <option value="US">🇺🇸 United States</option>
                        <option value="GH">🇬🇭 Ghana</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-[#6E6875] mb-1">Category</label>
                      <select
                        value={newResource.category}
                        onChange={(e) => setNewResource({ ...newResource, category: e.target.value })}
                        className="w-full px-3 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] rounded-xl text-xs font-bold"
                      >
                        <option value="Emergency services">Emergency services</option>
                        <option value="Safety and abuse support">Safety and abuse support</option>
                        <option value="Women’s healthcare">Women’s healthcare</option>
                        <option value="Mental health">Mental health</option>
                        <option value="Legal and safety support">Legal and safety support</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-[#6E6875] mb-1">Phone Number</label>
                    <input
                      required
                      type="text"
                      placeholder="112, +234..."
                      value={newResource.phone}
                      onChange={(e) => setNewResource({ ...newResource, phone: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] rounded-xl text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-[#6E6875] mb-1">Service Summary</label>
                    <input
                      required
                      type="text"
                      placeholder="24/7 toll-free national emergency line..."
                      value={newResource.summary}
                      onChange={(e) => setNewResource({ ...newResource, summary: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] rounded-xl text-xs"
                    />
                  </div>

                  <button type="submit" className="w-full py-3 bg-[#6C4CF1] text-white font-bold text-xs rounded-xl">
                    Publish Record
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "incidents" && (
        <div className="bg-white rounded-3xl border border-[#E7E2EB] shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-bold font-display text-[#17131D]">Live & Historical Safety SOS Audit Log</h3>
          <div className="space-y-3">
            {incidents.map((inc) => (
              <div key={inc.id} className="p-4 bg-[#F5F2FF] rounded-2xl border border-[#E8E0FF] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#17131D]">{inc.id} — {inc.user}</span>
                    <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded border border-[#E8E0FF]">{inc.flag} {inc.country}</span>
                  </div>
                  <p className="text-[#6E6875]">{inc.type} • Triggered: {inc.time}</p>
                  <p className="text-[#6C4CF1] font-mono text-[11px]">GPS: {inc.gps} ({inc.guardiansNotified} Guardians Notified)</p>
                </div>

                <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-emerald-50 text-[#238A5A] border border-emerald-200 self-start sm:self-center">
                  {inc.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
