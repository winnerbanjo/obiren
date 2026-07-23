"use client";

import { motion } from "framer-motion";

export default function ConditionsSection() {
  const conditions = [
    {
      title: "Menstrual Health",
      description: "Track irregular, painful or heavy periods and prepare clearer information for a clinician.",
    },
    {
      title: "Fibroids",
      description: "Record bleeding, pain, pressure, medication and treatment history while learning when specialist assessment may be needed.",
    },
    {
      title: "PCOS",
      description: "Track symptoms, cycle changes, treatment plans and lifestyle factors without reducing PCOS to weight alone.",
    },
    {
      title: "Endometriosis",
      description: "Build a longitudinal record of pain, bleeding, fatigue and the effect symptoms have on daily life.",
    },
    {
      title: "Fertility and Preconception",
      description: "Prepare informed questions and organise relevant cycle, test and treatment information.",
    },
    {
      title: "Pregnancy and Postpartum",
      description: "Access practical support from early pregnancy through birth preparation and postpartum recovery.",
    },
    {
      title: "Sexual and Reproductive Health",
      description: "Seek confidential guidance about contraception, infections, sexual wellbeing and reproductive concerns.",
    },
    {
      title: "Menopause",
      description: "Understand and record symptoms such as hot flushes, sleep disruption, mood changes and cycle transitions.",
    }
  ];

  return (
    <section className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-2xl mx-auto space-y-6 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F4F1FF] border border-[#E8DFFF] rounded-full text-xs font-bold text-[#6D4AFF]">
            <span className="uppercase tracking-wider">Care that reflects real women’s lives</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-[#171717] font-display tracking-tight leading-tight">
            Support across conditions, questions and life stages
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {conditions.map((condition, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.05 }}
              className="p-6 rounded-[24px] border border-[#E8DFFF] bg-[#FBFAFD] hover:bg-white hover:border-[#6D4AFF]/40 hover:shadow-lg transition-all"
            >
              <h3 className="text-lg font-bold text-[#171717] mb-3">{condition.title}</h3>
              <p className="text-sm text-[#666666] leading-relaxed">
                {condition.description}
              </p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
