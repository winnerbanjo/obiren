"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function HomepageFeatureSections() {
  const features = [
    {
      id: "cycle",
      eyebrow: "Understand your cycle",
      title: "Notice patterns. Prepare better. Ask better questions.",
      description: "Your menstrual cycle can reveal useful patterns about your health, but those patterns are often difficult to remember or explain during an appointment.\n\nObiren helps you build a consistent, private record of what you experience.",
      listTitle: "Track",
      list: [
        "Period start and end dates",
        "Flow intensity",
        "Pain level",
        "Mood and energy",
        "Sleep changes",
        "Discharge",
        "Medication",
        "Headaches and migraines",
        "Digestive changes",
        "Skin changes",
        "Personal notes"
      ],
      noticeTitle: "Learn from your history",
      noticeText: "Obiren uses your confirmed cycle history to estimate upcoming cycle dates and present a clear confidence level.\n\nThese estimates are informational only. They are not a diagnosis, a fertility guarantee or a substitute for professional medical advice.",
      buttonText: "Explore Cycle Tracking",
      buttonLink: "/features/cycle-tracking",
      bgColor: "bg-white",
      imageBg: "bg-[#F4F1FF]",
      reversed: false
    },
    {
      id: "pregnancy",
      eyebrow: "Support through every stage",
      title: "Pregnancy information that stays connected to your care",
      description: "Follow your pregnancy journey with practical weekly information, symptom records, appointment preparation and access to qualified maternal-health professionals.",
      listTitle: "Pregnancy tools",
      list: [
        "Gestational week and day",
        "Estimated due-date tracking",
        "Appointment reminders",
        "Symptom journaling",
        "Medication and supplement records",
        "Questions for your next appointment",
        "Kick-count support",
        "Contraction timing",
        "Important-document storage",
        "Postpartum planning"
      ],
      noticeTitle: "Safety-aware guidance",
      noticeText: "When symptoms could require urgent medical assessment, Obiren will direct you toward appropriate emergency or in-person care rather than attempting to provide a diagnosis.",
      buttonText: "Explore Pregnancy Support",
      buttonLink: "/features/pregnancy",
      bgColor: "bg-[#FBFAFD]",
      imageBg: "bg-emerald-50",
      reversed: true
    },
    {
      id: "safety",
      eyebrow: "Personal safety, built into the experience",
      title: "Help the people you trust find and support you",
      description: "Health and personal safety are often treated as unrelated problems. Women do not always experience them separately.\n\nObiren lets you create a Trusted Circle of people who should be contacted if you activate a personal safety alert.",
      listTitle: "Safety features",
      list: [
        "Trusted Circle: Add up to five trusted contacts and decide what information each person may receive.",
        "Hold-to-activate SOS: Press and hold the SOS control to reduce accidental activation and begin an emergency alert.",
        "Location sharing: Where you have granted permission and location is available, Obiren can include your latest coordinates in alerts sent to your Trusted Circle.",
        "Emergency directory: Find relevant emergency services, hospitals, crisis-support organisations and women’s assistance resources by country and location."
      ],
      noticeTitle: "Honest safety statement",
      noticeText: "Obiren does not guarantee police, ambulance or emergency-service dispatch. Alerts are sent to the contacts and channels shown before activation. Delivery depends on connectivity, device permissions and third-party communication providers.",
      buttonText: "Explore Obiren Safety",
      buttonLink: "/features/safety-sos",
      bgColor: "bg-white",
      imageBg: "bg-rose-50",
      reversed: false
    },
    {
      id: "vault",
      eyebrow: "Your records, organised",
      title: "Keep important health information within reach",
      description: "Store selected health documents so you can find them when preparing for an appointment, requesting a second opinion or continuing care with another provider.",
      listTitle: "Organise",
      list: [
        "Laboratory results",
        "Scan and imaging reports",
        "Prescriptions",
        "Referral letters",
        "Discharge summaries",
        "Consultation documents",
        "Insurance documents",
        "Personal care plans"
      ],
      noticeTitle: "Privacy language",
      noticeText: "Access to Health Vault records is protected through authenticated accounts, access controls, secure transmission and time-limited file links.\n\nObiren will not advertise a zero-knowledge or end-to-end encryption model unless the deployed system technically guarantees that Obiren cannot access or recover the encrypted content.",
      buttonText: "Learn About Health Vault",
      buttonLink: "/features/health-vault",
      bgColor: "bg-[#FBFAFD]",
      imageBg: "bg-teal-50",
      reversed: true
    }
  ];

  return (
    <>
      {features.map((feature, idx) => (
        <section key={feature.id} className={`py-24 ${feature.bgColor} relative overflow-hidden`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className={`grid grid-cols-1 lg:grid-cols-2 gap-16 items-center ${feature.reversed ? '' : ''}`}>
              
              {/* Copy Side */}
              <div className={`space-y-8 ${feature.reversed ? 'lg:order-2' : 'lg:order-1'}`}>
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-[#E8DFFF] rounded-full text-xs font-bold text-[#6D4AFF] shadow-sm">
                    <span className="uppercase tracking-wider">{feature.eyebrow}</span>
                  </div>
                  <h2 className="text-3xl sm:text-5xl font-extrabold text-[#171717] font-display tracking-tight leading-tight">
                    {feature.title}
                  </h2>
                  <div className="space-y-4 text-base text-[#666666] leading-relaxed whitespace-pre-wrap">
                    {feature.description}
                  </div>
                </div>

                <div className="pt-4 space-y-4 border-t border-[#E8DFFF]">
                  <h3 className="font-bold text-[#171717]">{feature.listTitle}</h3>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
                    {feature.list.map((item, i) => {
                      const split = item.indexOf(':');
                      if (split > -1) {
                        return (
                          <li key={i} className="flex items-start gap-3 sm:col-span-2">
                            <CheckCircle2 className="w-5 h-5 text-[#38B26C] shrink-0 mt-0.5" />
                            <span className="text-sm text-[#444444] leading-relaxed">
                              <span className="font-bold text-[#171717]">{item.substring(0, split + 1)}</span>
                              {item.substring(split + 1)}
                            </span>
                          </li>
                        );
                      }
                      return (
                        <li key={i} className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[#38B26C] shrink-0" />
                          <span className="text-sm text-[#444444] font-medium leading-tight">{item}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Important Notice */}
                <div className="bg-[#F4F1FF] p-6 rounded-2xl border border-[#E8DFFF] space-y-2">
                  <h4 className="text-sm font-bold text-[#6D4AFF]">{feature.noticeTitle}</h4>
                  <p className="text-xs text-[#666666] leading-relaxed whitespace-pre-wrap">{feature.noticeText}</p>
                </div>

                <div className="pt-4">
                  <Link
                    href={feature.buttonLink}
                    className="w-full sm:w-auto px-8 py-4 bg-[#6D4AFF] hover:bg-[#5B3DE0] text-white font-bold text-sm rounded-full shadow-xl shadow-[#6D4AFF]/30 transition-all inline-flex items-center justify-center gap-3 group"
                  >
                    <span>{feature.buttonText}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>

              {/* Graphic Side */}
              <div className={`${feature.reversed ? 'lg:order-1' : 'lg:order-2'}`}>
                <div className={`w-full aspect-square md:aspect-[4/3] lg:aspect-square ${feature.imageBg} rounded-[40px] border border-[#E8DFFF] shadow-2xl flex items-center justify-center p-8 relative overflow-hidden group`}>
                  {/* Decorative abstract elements */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/40 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/40 blur-3xl rounded-full -translate-x-1/2 translate-y-1/2" />
                  
                  {/* Placeholder for the actual app UI screenshots */}
                  <div className="w-full max-w-sm aspect-[9/19] bg-white rounded-[32px] border-4 border-white shadow-2xl overflow-hidden relative transform transition-transform duration-700 group-hover:scale-[1.02]">
                    <div className="w-full h-8 bg-gray-100 border-b border-gray-200 flex justify-center items-center">
                      <div className="w-20 h-4 bg-gray-200 rounded-full" />
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="w-full h-32 bg-gray-100 rounded-xl" />
                      <div className="w-3/4 h-4 bg-gray-100 rounded-full" />
                      <div className="w-1/2 h-4 bg-gray-100 rounded-full" />
                      <div className="w-full h-24 bg-gray-100 rounded-xl" />
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>
      ))}
    </>
  );
}
