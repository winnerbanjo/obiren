"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, HelpCircle } from "lucide-react";

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "Is Obiren free to use?",
      answer:
        "Yes! Obiren offers a rich free plan that includes fundamental cycle tracking, emergency Silent SOS, and basic health vault storage. Premium features such as unlimited direct video consultations with gynecologists and advanced AI health analytics will be available via affordable membership plans.",
    },
    {
      question: "When will Obiren launch?",
      answer:
        "Obiren is scheduled to launch early access in Q4 2026. Waitlist members will be invited in rolling batches based on priority signup rank.",
    },
    {
      question: "Which countries will be supported at launch?",
      answer:
        "Our initial launch markets are the United Kingdom 🇬🇧, United States 🇺🇸, Nigeria 🇳🇬, and Ghana 🇬🇭. We are actively expanding partnerships to support additional African and European nations in subsequent releases.",
    },
    {
      question: "Can I consult licensed doctors on Obiren?",
      answer:
        "Absolutely. Every doctor, obstetrician, and gynecologist on Obiren is thoroughly background-checked, credential-verified, and licensed by local regulatory medical bodies in your home country.",
    },
    {
      question: "How secure is my health data?",
      answer:
        "Your health data is protected with 256-bit zero-knowledge encryption (AES-256). We strictly adhere to NDPR (Nigeria Data Protection Regulation), GDPR (UK/EU), and HIPAA compliance standards. We will never sell or share your data.",
    },
    {
      question: "How does Trusted Circle work?",
      answer:
        "Trusted Circle allows you to designate up to 5 trusted family members or close friends. When you activate live location sharing or trigger Silent SOS, your circle immediately receives an emergency notification with your live GPS coordinates, battery percentage, and direct emergency dial options.",
    },
  ];

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-24 bg-white relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#F4F1FF] text-[#6D4AFF] rounded-full text-xs font-bold uppercase tracking-wider border border-[#E8DFFF]">
            <HelpCircle className="w-4 h-4" /> Got Questions?
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#171717] font-display tracking-tight">
            Frequently asked <span className="purple-gradient-text">questions.</span>
          </h2>
          <p className="text-base text-[#666666]">
            Everything you need to know about Obiren, our security, and early access.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={faq.question}
                className="bg-white rounded-2xl border border-[#E8DFFF] overflow-hidden transition-all shadow-sm hover:border-[#6D4AFF]/40"
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 font-bold text-base sm:text-lg text-[#171717] font-display focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <span>{faq.question}</span>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      isOpen ? "bg-[#6D4AFF] text-white" : "bg-[#F4F1FF] text-[#6D4AFF]"
                    }`}
                  >
                    {isOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="px-6 pb-6 text-sm text-[#666666] leading-relaxed border-t border-[#F4F1FF] pt-4">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
