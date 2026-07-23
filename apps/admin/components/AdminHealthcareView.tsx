"use client";

import { useState, useEffect } from "react";
import {
  Stethoscope,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  FileText,
  Eye,
  AlertTriangle,
  Clock,
  Building2,
  X,
  Activity,
  Baby,
  Calendar,
} from "lucide-react";

interface AdminHealthcareViewProps {
  selectedCountry: string;
  activeTabId?: string;
}

export default function AdminHealthcareView({ selectedCountry, activeTabId }: AdminHealthcareViewProps) {
  let defaultTab: "professionals" | "health_tracking" | "pregnancy" | "appointments" = "professionals";
  if (activeTabId === "health_tracking") defaultTab = "health_tracking";
  else if (activeTabId === "pregnancy") defaultTab = "pregnancy";
  else if (activeTabId === "appointments") defaultTab = "appointments";

  const [activeTab, setActiveTab] = useState<"professionals" | "health_tracking" | "pregnancy" | "appointments">(defaultTab);

  useEffect(() => {
    if (activeTabId === "professionals") setActiveTab("professionals");
    else if (activeTabId === "health_tracking") setActiveTab("health_tracking");
    else if (activeTabId === "pregnancy") setActiveTab("pregnancy");
    else if (activeTabId === "appointments") setActiveTab("appointments");
  }, [activeTabId]);

  const [stageFilter, setStageFilter] = useState("ALL");
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [actionReason, setActionReason] = useState("");

  const [applications, setApplications] = useState([
    {
      id: "app-101",
      name: "Dr. Amina Bello",
      country: "NG",
      flag: "🇳🇬",
      specialty: "Obstetrics & Gynecology",
      degrees: "MBBS, FWACS",
      licenceNumber: "MDCN/2012/8821",
      authority: "Medical & Dental Council of Nigeria",
      expiryDate: "2028-12-31",
      stage: "UNDER_REVIEW",
      riskFlag: false,
      appliedDate: "2026-07-10",
      documents: ["MDCN Practicing Licence 2026.pdf", "MBBS Certificate.pdf", "National ID.png"],
    },
    {
      id: "app-102",
      name: "Dr. Sarah Jenkins",
      country: "GB",
      flag: "🇬🇧",
      specialty: "Reproductive Endocrinology",
      degrees: "MD, MRCOG (UK)",
      licenceNumber: "GMC-771920",
      authority: "General Medical Council UK",
      expiryDate: "2027-09-30",
      stage: "VERIFIED",
      riskFlag: false,
      appliedDate: "2026-06-22",
      documents: ["GMC Registration 2026.pdf", "MRCOG Diploma.pdf"],
    },
    {
      id: "app-103",
      name: "Khadijah Vance",
      country: "NG",
      flag: "🇳🇬",
      specialty: "Maternal Nutrition",
      degrees: "RDN, MSc Nutrition",
      licenceNumber: "DAN/2018/4412",
      authority: "Dietitians Association of Nigeria",
      expiryDate: "2026-11-30",
      stage: "UNDER_REVIEW",
      riskFlag: false,
      appliedDate: "2026-07-15",
      documents: ["DAN Certification.pdf", "MSc Certificate.pdf"],
    },
    {
      id: "app-104",
      name: "Dr. John Doe",
      country: "US",
      flag: "🇺🇸",
      specialty: "Gynecology",
      degrees: "MD",
      licenceNumber: "USMLE-99120",
      authority: "State Medical Board",
      expiryDate: "2025-01-01",
      stage: "REJECTED",
      riskFlag: true,
      appliedDate: "2026-05-10",
      documents: ["Expired Licence 2024.pdf"],
    },
  ]);

  const filteredApps = applications.filter((app) => {
    const matchesCountry = selectedCountry === "ALL" || app.country === selectedCountry;
    const matchesStage = stageFilter === "ALL" || app.stage === stageFilter;
    return matchesCountry && matchesStage;
  });

  const handleApprove = () => {
    if (!actionReason) {
      alert("Please provide a verification note/reason.");
      return;
    }
    setApplications((prev) =>
      prev.map((a) => (a.id === selectedApp.id ? { ...a, stage: "VERIFIED" } : a))
    );
    alert(`Verification Approved for ${selectedApp.name}. Audit Log generated.`);
    setSelectedApp(null);
  };

  const handleReject = () => {
    if (!actionReason) {
      alert("Please provide a rejection reason.");
      return;
    }
    setApplications((prev) =>
      prev.map((a) => (a.id === selectedApp.id ? { ...a, stage: "REJECTED" } : a))
    );
    alert(`Verification Rejected for ${selectedApp.name}. Audit Log generated.`);
    setSelectedApp(null);
  };

  // Mock Pregnancy CMS
  const pregnancyContent = [
    { week: 4, title: "Your baby is the size of a poppy seed", status: "PUBLISHED" },
    { week: 12, title: "End of the first trimester milestones", status: "PUBLISHED" },
    { week: 20, title: "Halfway there: Anatomy scan time", status: "DRAFT" },
  ];

  // Mock Appointments
  const appointments = [
    { id: "APT-882", patient: "Amara Okafor", doctor: "Dr. Amina Bello", type: "Video Consult", time: "Today, 14:00", status: "UPCOMING" },
    { id: "APT-883", patient: "Chloe Smith", doctor: "Dr. Sarah Jenkins", type: "Chat Consult", time: "Today, 15:30", status: "IN_PROGRESS" },
    { id: "APT-884", patient: "Ella Vance", doctor: "Khadijah Vance", type: "Nutrition Plan", time: "Tomorrow, 09:00", status: "SCHEDULED" },
  ];

  // Mock Health Config
  const healthConfig = [
    { metric: "Cycle Deviation Threshold", value: "±5 days", description: "Triggers irregularity alert to user." },
    { metric: "Fetal Kick Count Minimum", value: "10 per 2 hours", description: "Standard clinical threshold for kick tracker." },
    { metric: "Temperature Spike Threshold", value: "38.0°C (100.4°F)", description: "Triggers fever warning in symptom log." },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E7E2EB] pb-4">
        <button
          onClick={() => setActiveTab("professionals")}
          className={`px-4 py-2 text-xs font-bold rounded-full transition-colors flex items-center gap-1.5 ${
            activeTab === "professionals" ? "bg-[#17131D] text-white shadow-md" : "text-[#6E6875] hover:bg-[#F5F2FF]"
          }`}
        >
          <Stethoscope className="w-3.5 h-3.5" />
          Doctors Verification
        </button>
        <button
          onClick={() => setActiveTab("health_tracking")}
          className={`px-4 py-2 text-xs font-bold rounded-full transition-colors flex items-center gap-1.5 ${
            activeTab === "health_tracking" ? "bg-[#17131D] text-white shadow-md" : "text-[#6E6875] hover:bg-[#F5F2FF]"
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Health Config
        </button>
        <button
          onClick={() => setActiveTab("pregnancy")}
          className={`px-4 py-2 text-xs font-bold rounded-full transition-colors flex items-center gap-1.5 ${
            activeTab === "pregnancy" ? "bg-[#17131D] text-white shadow-md" : "text-[#6E6875] hover:bg-[#F5F2FF]"
          }`}
        >
          <Baby className="w-3.5 h-3.5" />
          Pregnancy CMS
        </button>
        <button
          onClick={() => setActiveTab("appointments")}
          className={`px-4 py-2 text-xs font-bold rounded-full transition-colors flex items-center gap-1.5 ${
            activeTab === "appointments" ? "bg-[#17131D] text-white shadow-md" : "text-[#6E6875] hover:bg-[#F5F2FF]"
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          Appointments
        </button>
      </div>

      {activeTab === "professionals" && (
        <>
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm">
            <div>
              <h2 className="text-2xl font-bold font-display text-[#17131D]">Healthcare Professional Verification</h2>
              <p className="text-xs text-[#6E6875]">Verify medical licences, degrees, and identity documents for doctors in UK, US, Nigeria & Ghana.</p>
            </div>

            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="px-4 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] rounded-full text-xs font-bold text-[#17131D] focus:outline-none"
            >
              <option value="ALL">All Verification Stages</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="VERIFIED">Verified</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Applications Table */}
          <div className="bg-white rounded-3xl border border-[#E7E2EB] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F5F2FF]/60 border-b border-[#E7E2EB] text-[#6E6875] uppercase text-[10px] font-bold tracking-wider">
                    <th className="py-4 px-4">Applicant Doctor</th>
                    <th className="py-4 px-4">Market</th>
                    <th className="py-4 px-4">Specialty & Degrees</th>
                    <th className="py-4 px-4">Licence Number</th>
                    <th className="py-4 px-4">Expiry Date</th>
                    <th className="py-4 px-4">Stage</th>
                    <th className="py-4 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E2EB]">
                  {filteredApps.map((app) => (
                    <tr key={app.id} className="hover:bg-[#F5F2FF]/30 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-[#17131D]">{app.name}</td>

                      <td className="py-3.5 px-4 font-bold text-[#17131D]">
                        <span className="text-base mr-1">{app.flag}</span>
                        <span>{app.country}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#6C4CF1]">{app.specialty}</div>
                        <div className="text-[11px] text-[#6E6875]">{app.degrees}</div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-[#17131D]">{app.licenceNumber}</td>
                      <td className="py-3.5 px-4 text-[#6E6875]">{app.expiryDate}</td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                            app.stage === "VERIFIED"
                              ? "bg-emerald-50 text-[#238A5A] border border-emerald-200"
                              : app.stage === "UNDER_REVIEW"
                              ? "bg-amber-50 text-[#B87512] border border-amber-200"
                              : "bg-red-50 text-[#C53D52] border border-red-200"
                          }`}
                        >
                          {app.stage}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedApp(app);
                            setActionReason("");
                          }}
                          className="px-3.5 py-1.5 bg-[#6C4CF1] text-white font-bold text-[11px] rounded-lg shadow-sm hover:bg-[#5B3DE0]"
                        >
                          Inspect Documents
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === "health_tracking" && (
        <div className="bg-white rounded-3xl border border-[#E7E2EB] shadow-sm overflow-hidden p-6 space-y-6">
          <div>
            <h2 className="text-2xl font-bold font-display text-[#17131D]">Algorithmic Health Config</h2>
            <p className="text-xs text-[#6E6875]">Configure the clinical thresholds and prediction parameters used by the platform.</p>
          </div>
          
          <div className="space-y-4">
            {healthConfig.map((c, i) => (
              <div key={i} className="p-4 bg-[#F5F2FF]/60 rounded-2xl border border-[#E8E0FF] flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-[#17131D] text-sm">{c.metric}</h4>
                  <p className="text-xs text-[#6E6875] mt-1">{c.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono font-bold text-[#6D4AFF] bg-white px-3 py-1.5 rounded-lg border border-[#E8E0FF]">{c.value}</span>
                  <button className="px-3 py-1.5 text-xs font-bold text-[#17131D] bg-[#E8E0FF] rounded-lg hover:bg-[#D8CCFF]">Edit</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "pregnancy" && (
        <div className="bg-white rounded-3xl border border-[#E7E2EB] shadow-sm overflow-hidden p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold font-display text-[#17131D]">Pregnancy Companion CMS</h2>
              <p className="text-xs text-[#6E6875]">Manage weekly milestones, baby sizing, and stage-specific guidance.</p>
            </div>
            <button className="px-4 py-2 bg-[#6C4CF1] text-white text-xs font-bold rounded-full">Add Week Content</button>
          </div>
          
          <div className="space-y-3">
            {pregnancyContent.map((p, i) => (
              <div key={i} className="p-4 bg-white rounded-2xl border border-[#E8E0FF] flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center font-bold text-xs">W{p.week}</div>
                  <h4 className="font-bold text-[#17131D] text-sm">{p.title}</h4>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${p.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>{p.status}</span>
                  <button className="text-xs font-bold text-[#6C4CF1]">Edit</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "appointments" && (
        <div className="bg-white rounded-3xl border border-[#E7E2EB] shadow-sm overflow-hidden p-6 space-y-6">
          <div>
            <h2 className="text-2xl font-bold font-display text-[#17131D]">Telehealth Appointments Master Schedule</h2>
            <p className="text-xs text-[#6E6875]">Global overview of all specialist consultations.</p>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {appointments.map((a, i) => (
              <div key={i} className="p-4 bg-white rounded-2xl border border-[#E8E0FF] flex justify-between items-center hover:border-[#6C4CF1] transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-[#F5F2FF] rounded-lg text-[#6D4AFF]">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#17131D] text-sm">{a.patient} <span className="text-[#6E6875] font-normal mx-1">with</span> {a.doctor}</h4>
                    <p className="text-xs text-[#6E6875] mt-0.5">{a.type} • {a.time}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${a.status === "IN_PROGRESS" ? "bg-rose-50 text-rose-600 animate-pulse" : a.status === "UPCOMING" ? "bg-[#F5F2FF] text-[#6C4CF1]" : "bg-gray-100 text-gray-600"}`}>{a.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verification Inspection Modal */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-xl space-y-6 shadow-2xl border border-[#E7E2EB]">
            <div className="flex justify-between items-center border-b border-[#E7E2EB] pb-3">
              <div>
                <h3 className="text-xl font-bold font-display text-[#17131D]">{selectedApp.name}</h3>
                <p className="text-xs text-[#6E6875]">{selectedApp.degrees} • {selectedApp.flag} {selectedApp.country} Market</p>
              </div>
              <button onClick={() => setSelectedApp(null)} className="p-2 text-[#6E6875] hover:bg-[#F5F2FF] rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-[#F5F2FF] rounded-2xl grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#6E6875] block">Licence Authority</span>
                  <span className="font-bold text-[#17131D]">{selectedApp.authority}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#6E6875] block">Licence Number</span>
                  <span className="font-mono font-bold text-[#6C4CF1]">{selectedApp.licenceNumber}</span>
                </div>
              </div>

              <div>
                <span className="font-bold text-[#17131D] block mb-1">Submitted Medical Credentials Documents:</span>
                <div className="space-y-1.5">
                  {selectedApp.documents.map((doc: string, i: number) => (
                    <div key={i} className="p-3 bg-[#F5F2FF]/60 rounded-xl border border-[#E8E0FF] flex justify-between items-center">
                      <span className="font-medium text-[#17131D]">{doc}</span>
                      <span className="text-[10px] font-bold text-[#238A5A] bg-emerald-50 px-2 py-0.5 rounded">Verified Signature</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#6E6875]">Verification Audit Note (Required)</label>
                <input
                  type="text"
                  placeholder="e.g. Verified active licence status directly on GMC/MDCN portal..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F5F2FF] border border-[#E8E0FF] rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#E7E2EB] flex justify-end gap-3">
              <button
                onClick={handleReject}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-full shadow-md"
              >
                Reject Application
              </button>

              <button
                onClick={handleApprove}
                className="px-5 py-2.5 bg-[#238A5A] hover:bg-emerald-700 text-white text-xs font-bold rounded-full shadow-md"
              >
                Approve Doctor Verification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
