"use client";

import { motion } from "framer-motion";
import { Star, Quote, CheckCircle } from "lucide-react";

export default function Testimonials() {
  const testimonials = [
    {
      name: "Dr. Funmi Adebayo",
      role: "Maternal Health Advocate",
      location: "Lagos, Nigeria 🇳🇬",
      quote:
        "Obiren finally brings everything a woman needs into one app. Having verified gynecologists and Silent SOS in the same place makes managing health feel simple and reassuring.",
      rating: 5,
    },
    {
      name: "Eleanor Vance",
      role: "Early Access Beta Tester",
      location: "London, United Kingdom 🇬🇧",
      quote:
        "The cycle tracking is remarkably accurate, and knowing my trusted circle gets notified with a live trail if I ever feel unsafe walking home is completely priceless.",
      rating: 5,
    },
    {
      name: "Akosua Mensah",
      role: "Mother of Two",
      location: "Accra, Ghana 🇬🇭",
      quote:
        "Keeping all ultrasound scans, prescriptions, and prenatal logs in the Health Vault saved me so much hassle during doctor appointments. A total game changer for women.",
      rating: 5,
    },
  ];

  return (
    <section className="py-24 bg-[#F4F1FF]/50 border-y border-[#E8DFFF] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center space-y-4 max-w-2xl mx-auto mb-16">
          <p className="text-xs uppercase font-bold tracking-widest text-[#6D4AFF]">
            Community Voices
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#171717] font-display tracking-tight">
            Made for <span className="purple-gradient-text">real women.</span>
          </h2>
          <p className="text-base text-[#666666]">
            Hear from women across our launch markets who are shaping the future of Obiren.
          </p>
        </div>

        {/* Testimonial Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t, idx) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="p-8 bg-white rounded-3xl border border-[#E8DFFF] shadow-lg shadow-[#6D4AFF]/5 hover:shadow-xl transition-all flex flex-col justify-between space-y-6 relative group"
            >
              <Quote className="w-10 h-10 text-[#E8DFFF] group-hover:text-[#6D4AFF]/20 transition-colors absolute top-6 right-6" />

              <div className="space-y-4 relative z-10">
                {/* Rating Stars */}
                <div className="flex gap-1 text-amber-400">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400" />
                  ))}
                </div>

                <p className="text-sm text-[#171717] leading-relaxed font-medium italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
              </div>

              <div className="pt-4 border-t border-[#E8DFFF] flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-[#171717] font-display flex items-center gap-1.5">
                    <span>{t.name}</span>
                    <CheckCircle className="w-3.5 h-3.5 text-[#38B26C]" />
                  </h4>
                  <p className="text-xs text-[#666666]">{t.role}</p>
                </div>
                <span className="text-xs font-semibold text-[#6D4AFF] bg-[#F4F1FF] px-2.5 py-1 rounded-full">
                  {t.location}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
