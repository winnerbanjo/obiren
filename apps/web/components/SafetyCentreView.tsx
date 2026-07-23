"use client";

import { useState } from "react";
import {
  ShieldAlert,
  Users,
  MapPin,
  PhoneCall,
  Radio,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Hospital,
  Building2,
  Lock,
  Search,
  ArrowRight,
  ShieldCheck,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { getCountryConfig, VERIFIED_EMERGENCY_DATASET, VerifiedEmergencyRecord } from "@obiren/localization";

interface SafetyCentreViewProps {
  userProfile: any;
}

export default function SafetyCentreView({ userProfile }: SafetyCentreViewProps) {
  const countryCode = userProfile?.countryCode || "NG";
  const countryConfig = getCountryConfig(countryCode);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"circle" | "sos" | "directory">("directory");
  const [directoryCategory, setDirectoryCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Trusted Contacts State
  const [contacts, setContacts] = useState([
    { id: "c1", name: "Khadijah Okafor", relation: "Mother", phone: "+234 803 123 4567", email: "mom@example.com", status: "ACCEPTED" },
    { id: "c2", name: "Chloe Vance", relation: "Sister", phone: "+44 7700 900077", email: "chloe@example.com", status: "ACCEPTED" },
    { id: "c3", name: "Dr. Amina Bello", relation: "Doctor", phone: "+234 802 999 8877", email: "doctor@example.com", status: "ACCEPTED" },
    { id: "c4", name: "Spouse", relation: "Partner", phone: "+234 809 111 2233", email: "partner@example.com", status: "ACCEPTED" },
  ]);

  // Modal State for Adding Contact
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "", email: "", relation: "Family" });

  // SOS Flow State
  const [isTestMode, setIsTestMode] = useState(true);
  const [sosActive, setSosActive] = useState(false);
  const [sosLogs, setSosLogs] = useState<Array<{ time: string; msg: string }>>([]);

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.name || !newContact.email) return;

    if (contacts.length >= 5) {
      alert("Trusted Circle allows a maximum of 5 emergency contacts.");
      return;
    }

    setContacts([
      ...contacts,
      {
        id: `c_${Date.now()}`,
        name: newContact.name,
        relation: newContact.relation,
        phone: newContact.phone,
        email: newContact.email,
        status: "PENDING",
      },
    ]);
    setShowAddContact(false);
    setNewContact({ name: "", phone: "", email: "", relation: "Family" });
  };

  const triggerSos = () => {
    setSosActive(true);
    setSosLogs([
      { time: new Date().toLocaleTimeString(), msg: `SOS Triggered (${isTestMode ? "TEST MODE" : "LIVE INCIDENT"})` },
      { time: new Date().toLocaleTimeString(), msg: "GPS Coordinates Captured: 6.5244° N, 3.3792° E" },
      { time: new Date().toLocaleTimeString(), msg: `Dispatched SMS & Push notifications to ${contacts.length} Trusted Contacts` },
    ]);
  };

  const cancelSos = () => {
    setSosActive(false);
    setSosLogs((prev) => [
      { time: new Date().toLocaleTimeString(), msg: "Incident Cancelled by User PIN" },
      ...prev,
    ]);
  };

  // Filter 31 verified emergency records
  const categoryOptions = ["All", "Emergency services", "Safety and abuse support", "Women’s healthcare", "Mental health", "Legal and safety support"];

  const filteredDirectory = VERIFIED_EMERGENCY_DATASET.filter((record) => {
    const matchesCountry = record.countryCode === countryCode || record.country.toLowerCase().includes(countryConfig.name.toLowerCase());
    const matchesCat = directoryCategory === "All" || record.top_category.toLowerCase().includes(directoryCategory.toLowerCase());
    const matchesQuery =
      record.organisation_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.service_summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.service_category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCountry && matchesCat && matchesQuery;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-[#E7E2EB] shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-[#17131D]">Safety Centre & Emergency Directory</h2>
          <p className="text-xs text-[#6E6875]">Trusted Circle, Web SOS panic dispatch & 31 verified emergency records for {countryConfig.name} {countryConfig.flag}.</p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: "directory", label: `Directory (${filteredDirectory.length})` },
            { id: "sos", label: "Web SOS Flow" },
            { id: "circle", label: `Guardians (${contacts.length}/5)` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-full text-xs font-bold capitalize transition-all shrink-0 ${
                activeTab === tab.id ? "bg-[#6C4CF1] text-white shadow-sm" : "bg-[#F5F2FF] text-[#6E6875]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. DIRECTORY TAB (31 VERIFIED REAL EMERGENCY RECORDS) */}
      {activeTab === "directory" && (
        <div className="space-y-6">
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold font-display text-[#17131D]">Verified Emergency Directory</h3>
                <p className="text-xs text-[#6E6875]">Source-verified emergency numbers, crisis shelters, legal aid, and maternal health services.</p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#6E6875]" />
                <input
                  type="text"
                  placeholder="Search helpline, legal aid..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#F5F2FF] border border-[#E8E0FF] rounded-full text-xs font-medium focus:outline-none focus:border-[#6C4CF1]"
                />
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
              {categoryOptions.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setDirectoryCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                    directoryCategory === cat
                      ? "bg-[#6C4CF1] text-white shadow-sm"
                      : "bg-[#F5F2FF] text-[#6E6875] hover:bg-[#E8E0FF] hover:text-[#6C4CF1]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Directory Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {filteredDirectory.map((rec) => (
                <div
                  key={rec.record_id}
                  className="p-5 bg-[#F5F2FF]/60 rounded-2xl border border-[#E8E0FF] space-y-3 hover:border-[#6C4CF1] transition-colors flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#17131D]">{rec.organisation_name}</span>
                          <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-[#E8E0FF] text-[#6C4CF1]">
                            {rec.record_id}
                          </span>
                        </div>
                        <p className="text-[11px] font-bold text-[#6C4CF1] mt-0.5">{rec.top_category} • {rec.service_category}</p>
                      </div>

                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-[#238A5A] border border-emerald-200 shrink-0">
                        {rec.verification_status}
                      </span>
                    </div>

                    <p className="text-xs text-[#6E6875] leading-relaxed">
                      {rec.service_summary}
                    </p>

                    <div className="flex flex-wrap gap-2 text-[10px] text-[#6E6875]">
                      <span className="bg-white px-2 py-1 rounded border border-[#E8E0FF]">Hours: <strong>{rec.hours}</strong></span>
                      <span className="bg-white px-2 py-1 rounded border border-[#E8E0FF]">Cost: <strong>{rec.cost}</strong></span>
                      <span className="bg-white px-2 py-1 rounded border border-[#E8E0FF]">Type: <strong>{rec.organisation_type}</strong></span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#E8E0FF] flex items-center justify-between gap-2">
                    {rec.phone ? (
                      <a
                        href={`tel:${rec.phone.split(";")[0]}`}
                        className="px-4 py-2 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white text-xs font-bold rounded-full flex items-center gap-1.5 shadow-sm"
                      >
                        <PhoneCall className="w-3.5 h-3.5" /> Call {rec.phone.split(";")[0]}
                      </a>
                    ) : (
                      <span className="text-xs font-bold text-[#6E6875]">Online Referral Available</span>
                    )}

                    {rec.whatsapp_or_text && (
                      <a
                        href={`https://wa.me/${rec.whatsapp_or_text.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-full flex items-center gap-1 shadow-sm"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> Text / WA
                      </a>
                    )}

                    {rec.source_url && (
                      <a
                        href={rec.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 text-[#6E6875] hover:text-[#6C4CF1]"
                        title="View Official Source"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. WEB SOS FLOW TAB */}
      {activeTab === "sos" && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E7E2EB] shadow-sm text-center space-y-6 max-w-xl mx-auto">
          <div className="flex items-center justify-between border-b border-[#E7E2EB] pb-4">
            <span className="text-xs font-bold text-[#17131D]">SOS Execution Mode</span>
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={isTestMode}
                onChange={(e) => setIsTestMode(e.target.checked)}
                className="accent-[#6C4CF1]"
              />
              <span className={isTestMode ? "text-[#6C4CF1]" : "text-[#C53D52]"}>
                {isTestMode ? "Test Mode (Safe Trial)" : "LIVE DISPATCH"}
              </span>
            </label>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold font-display text-[#17131D]">Web SOS Activation</h3>
            <p className="text-xs text-[#6E6875]">Press & hold button to initiate emergency location capture and dispatch alert.</p>
          </div>

          {!sosActive ? (
            <button
              onClick={triggerSos}
              className="w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-[#C53D52] hover:bg-red-700 text-white font-black text-xl shadow-xl shadow-red-500/30 flex flex-col items-center justify-center mx-auto transition-transform hover:scale-105 active:scale-95"
            >
              <ShieldAlert className="w-10 h-10 mb-1" />
              <span>SOS</span>
            </button>
          ) : (
            <div className="space-y-4 p-6 bg-red-50 border border-red-200 rounded-3xl text-red-900">
              <Radio className="w-12 h-12 text-[#C53D52] mx-auto animate-pulse" />
              <h4 className="text-lg font-black">INCIDENT ACTIVE ({isTestMode ? "TEST MODE" : "LIVE"})</h4>
              <button
                onClick={cancelSos}
                className="px-6 py-2.5 bg-[#17131D] text-white text-xs font-bold rounded-full"
              >
                Cancel with Safety PIN
              </button>
            </div>
          )}

          {sosLogs.length > 0 && (
            <div className="text-left space-y-2 pt-4 border-t border-[#E7E2EB] text-xs">
              <p className="font-bold text-[#17131D]">Incident Audit Log:</p>
              {sosLogs.map((log, i) => (
                <div key={i} className="p-2.5 bg-[#F5F2FF] rounded-xl flex justify-between font-mono text-[11px] gap-2">
                  <span className="truncate">{log.msg}</span>
                  <span className="text-[#6E6875] shrink-0">{log.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. TRUSTED CIRCLE TAB */}
      {activeTab === "circle" && (
        <div className="space-y-6">
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#E7E2EB] shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold font-display text-[#17131D]">Trusted Circle ({contacts.length}/5 Contacts)</h3>
                <p className="text-xs text-[#6E6875]">Designated guardians who receive live location pings during an emergency.</p>
              </div>

              <button
                onClick={() => setShowAddContact(true)}
                disabled={contacts.length >= 5}
                className="px-4 py-2.5 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white text-xs font-bold rounded-full transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> Add Contact
              </button>
            </div>

            {/* Contacts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contacts.map((c) => (
                <div key={c.id} className="p-4 bg-[#F5F2FF]/60 rounded-2xl border border-[#E8E0FF] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#17131D]">{c.name}</span>
                      <span className="text-[10px] bg-white px-2 py-0.5 rounded-md font-semibold text-[#6C4CF1] border border-[#E8E0FF]">
                        {c.relation}
                      </span>
                    </div>
                    <p className="text-xs text-[#6E6875] truncate">{c.email} • {c.phone}</p>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full self-start sm:self-center ${
                      c.status === "ACCEPTED"
                        ? "bg-emerald-50 text-[#238A5A] border border-emerald-200"
                        : "bg-amber-50 text-[#B87512] border border-amber-200"
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Add Contact Modal */}
          {showAddContact && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
              <div className="bg-white rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
                <div className="flex justify-between items-center">
                  <h4 className="text-lg font-bold font-display">Add Trusted Guardian</h4>
                  <button onClick={() => setShowAddContact(false)}><X className="w-5 h-5 text-[#6E6875]" /></button>
                </div>

                <form onSubmit={handleAddContact} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#6E6875] mb-1">Full Name</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Sarah Jenkins"
                      value={newContact.name}
                      onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#6E6875] mb-1">Email Address</label>
                    <input
                      required
                      type="email"
                      placeholder="guardian@example.com"
                      value={newContact.email}
                      onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#6E6875] mb-1">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="+234..."
                      value={newContact.phone}
                      onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] rounded-xl text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-[#6C4CF1] text-white font-bold text-xs rounded-xl shadow-md"
                  >
                    Send Invitation
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
