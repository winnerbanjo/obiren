"use client";

import { useState } from "react";
import {
  Stethoscope,
  Search,
  Star,
  Calendar,
  Clock,
  Video,
  MessageSquare,
  ShieldCheck,
  Award,
  MapPin,
  CheckCircle2,
  X,
  Plus,
} from "lucide-react";
import { getCountryConfig } from "@obiren/localization";

interface ProfessionalsViewProps {
  userProfile: any;
}

export default function ProfessionalsView({ userProfile }: ProfessionalsViewProps) {
  const countryConfig = getCountryConfig(userProfile?.countryCode || "NG");
  const currencySymbol = countryConfig.currency?.symbol || "₦";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("All");

  // Booking Modal State
  const [selectedDoctor, setSelectedDoctor] = useState<any | null>(null);
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("10:00 AM");
  const [consultationType, setConsultationType] = useState<"video" | "audio" | "clinic">("video");
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  const specialties = [
    "All",
    "Obstetricians & Gynecologists",
    "Maternal Nutritionists",
    "Postpartum Therapists",
    "PCOS & Reproductive Endocrinologists",
  ];

  const doctors = [
    {
      id: "doc-1",
      name: "Dr. Amina Bello",
      title: "Senior Consultant Obstetrician & Gynecologist",
      degrees: "MBBS, FWACS, FMCOG",
      hospital: "Apex Women's Hospital, Victoria Island",
      city: "Lagos, Nigeria",
      specialty: "Obstetricians & Gynecologists",
      rating: 4.9,
      reviewsCount: 128,
      experienceYears: 14,
      consultationFee: `${currencySymbol}25,000`,
      availableToday: true,
      bio: "Specializing in high-risk pregnancies, minimally invasive uterine fibroid management, and PCOS treatment.",
      nextSlot: "Today at 02:00 PM",
    },
    {
      id: "doc-2",
      name: "Dr. Sarah Jenkins",
      title: "Reproductive Endocrinologist & Fertility Specialist",
      degrees: "MD, MRCOG (UK)",
      hospital: "St. Jude Women's Health Center",
      city: "London, United Kingdom",
      specialty: "PCOS & Reproductive Endocrinologists",
      rating: 5.0,
      reviewsCount: 94,
      experienceYears: 16,
      consultationFee: `${currencySymbol}35,000`,
      availableToday: true,
      bio: "Expert in hormonal evaluation, ovulation induction protocols, and personalized fertility preservation.",
      nextSlot: "Today at 04:30 PM",
    },
    {
      id: "doc-3",
      name: "Grace Asante",
      title: "Licensed Maternal & Postpartum Therapist",
      degrees: "MSc Clinical Psychology, LMFT",
      hospital: "Maternal Wellness Institute",
      city: "Accra, Ghana",
      specialty: "Postpartum Therapists",
      rating: 4.8,
      reviewsCount: 76,
      experienceYears: 10,
      consultationFee: `${currencySymbol}18,000`,
      availableToday: false,
      bio: "Helping mothers navigate anxiety, postpartum depression, mood shifts, and maternal mental wellbeing.",
      nextSlot: "Tomorrow at 11:00 AM",
    },
    {
      id: "doc-4",
      name: "Khadijah Vance",
      title: "Clinical Maternal Nutritionist",
      degrees: "RD, RDN, MSc Nutrition",
      hospital: "African Maternal Care Initiative",
      city: "Abuja, Nigeria",
      specialty: "Maternal Nutritionists",
      rating: 4.9,
      reviewsCount: 112,
      experienceYears: 8,
      consultationFee: `${currencySymbol}15,000`,
      availableToday: true,
      bio: "Specialized nutritional plans for PCOS, gestational diabetes, and postpartum recovery using African diets.",
      nextSlot: "Today at 01:30 PM",
    },
  ];

  const filteredDoctors = doctors.filter((doc) => {
    const matchesSpec = selectedSpecialty === "All" || doc.specialty === selectedSpecialty;
    const matchesQuery =
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.hospital.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSpec && matchesQuery;
  });

  const handleConfirmBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setBookingConfirmed(true);
    setTimeout(() => {
      setBookingConfirmed(false);
      setSelectedDoctor(null);
      alert(`Consultation booked with ${selectedDoctor.name} on ${bookingDate} at ${selectedTimeSlot}. Confirmation code sent to your email.`);
    }, 1500);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#E7E2EB] shadow-sm">
        <div>
          <h2 className="text-2xl font-bold font-display text-[#17131D]">Verified Healthcare Professionals</h2>
          <p className="text-xs text-[#6E6875]">Consult licensed gynecologists, obstetricians & maternal specialists for {countryConfig.name} {countryConfig.flag}.</p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#918A98]" />
          <input
            type="text"
            placeholder="Search doctors, hospital..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] rounded-full text-xs font-medium focus:outline-none focus:border-[#6C4CF1]"
          />
        </div>
      </div>

      {/* Specialty Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
        {specialties.map((spec) => (
          <button
            key={spec}
            onClick={() => setSelectedSpecialty(spec)}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${
              selectedSpecialty === spec
                ? "bg-[#6C4CF1] text-white shadow-md shadow-[#6C4CF1]/20"
                : "bg-white text-[#6E6875] border border-[#E7E2EB] hover:bg-[#F5F2FF] hover:text-[#6C4CF1]"
            }`}
          >
            {spec}
          </button>
        ))}
      </div>

      {/* Doctors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredDoctors.map((doc) => (
          <div
            key={doc.id}
            className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E7E2EB] shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-6"
          >
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-[#F5F2FF] text-[#6C4CF1] border border-[#E8E0FF] flex items-center justify-center font-bold text-lg shrink-0">
                    <Stethoscope className="w-7 h-7 text-[#6C4CF1]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold font-display text-[#17131D]">{doc.name}</h3>
                      <ShieldCheck className="w-4 h-4 text-[#238A5A]" />
                    </div>
                    <p className="text-xs font-bold text-[#6C4CF1]">{doc.degrees}</p>
                    <p className="text-[11px] text-[#6E6875]">{doc.title}</p>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${
                    doc.availableToday
                      ? "bg-emerald-50 text-[#238A5A] border border-emerald-200"
                      : "bg-amber-50 text-[#B87512] border border-amber-200"
                  }`}
                >
                  {doc.availableToday ? "Available Today" : "Next Day Slot"}
                </span>
              </div>

              <p className="text-xs text-[#6E6875] leading-relaxed">
                {doc.bio}
              </p>

              <div className="p-3 bg-[#F5F2FF]/60 rounded-2xl border border-[#E8E0FF] grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#6E6875] block">Hospital Affiliation</span>
                  <span className="font-bold text-[#17131D] truncate block">{doc.hospital}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#6E6875] block">Rating & Experience</span>
                  <span className="font-bold text-[#17131D] flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> {doc.rating} ({doc.reviewsCount}) • {doc.experienceYears} yrs
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#E7E2EB] flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#6E6875] block">Consultation Fee</span>
                <span className="text-base font-extrabold text-[#17131D]">{doc.consultationFee}</span>
              </div>

              <button
                onClick={() => setSelectedDoctor(doc)}
                className="px-5 py-2.5 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white text-xs font-bold rounded-full shadow-md transition-all flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5" /> Book Session
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Booking Modal */}
      {selectedDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-lg space-y-6 shadow-2xl border border-[#E7E2EB]">
            <div className="flex justify-between items-center border-b border-[#E7E2EB] pb-3">
              <div>
                <h3 className="text-lg font-bold font-display text-[#17131D]">Book Consultation</h3>
                <p className="text-xs text-[#6E6875]">With {selectedDoctor.name} ({selectedDoctor.degrees})</p>
              </div>
              <button onClick={() => setSelectedDoctor(null)} className="p-2 text-[#6E6875] hover:bg-[#F5F2FF] rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmBooking} className="space-y-4">
              {/* Consultation Format */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#6E6875] mb-1.5">Consultation Format</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setConsultationType("video")}
                    className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      consultationType === "video" ? "bg-[#6C4CF1] text-white border-[#6C4CF1]" : "bg-[#F5F2FF] text-[#17131D] border-[#E8E0FF]"
                    }`}
                  >
                    <Video className="w-4 h-4" /> Video Call
                  </button>
                  <button
                    type="button"
                    onClick={() => setConsultationType("audio")}
                    className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      consultationType === "audio" ? "bg-[#6C4CF1] text-white border-[#6C4CF1]" : "bg-[#F5F2FF] text-[#17131D] border-[#E8E0FF]"
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" /> Audio Call
                  </button>
                  <button
                    type="button"
                    onClick={() => setConsultationType("clinic")}
                    className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      consultationType === "clinic" ? "bg-[#6C4CF1] text-[#6C4CF1] border-[#6C4CF1]" : "bg-[#F5F2FF] text-[#17131D] border-[#E8E0FF]"
                    }`}
                  >
                    <Stethoscope className="w-4 h-4" /> In-Clinic
                  </button>
                </div>
              </div>

              {/* Date Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#6E6875] mb-1">Preferred Date</label>
                <input
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#F5F2FF] border border-[#E8E0FF] rounded-xl text-xs font-bold"
                />
              </div>

              {/* Time Slots */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#6E6875] mb-1.5">Available Time Slot</label>
                <div className="grid grid-cols-4 gap-2">
                  {["09:00 AM", "10:00 AM", "01:30 PM", "04:00 PM"].map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedTimeSlot(slot)}
                      className={`py-2 text-[11px] font-bold rounded-xl border transition-all ${
                        selectedTimeSlot === slot
                          ? "bg-[#6C4CF1] text-white border-[#6C4CF1]"
                          : "bg-[#F5F2FF] text-[#17131D] border-[#E8E0FF]"
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-[#F5F2FF] rounded-2xl border border-[#E8E0FF] flex justify-between items-center text-xs">
                <span className="text-[#6E6875]">Total Fee Payable:</span>
                <span className="font-extrabold text-[#6C4CF1] text-base">{selectedDoctor.consultationFee}</span>
              </div>

              <button
                type="submit"
                disabled={bookingConfirmed}
                className="w-full py-3.5 bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white font-bold text-xs rounded-full shadow-md transition-all flex items-center justify-center gap-2"
              >
                {bookingConfirmed ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>Confirm & Reserve Appointment</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
