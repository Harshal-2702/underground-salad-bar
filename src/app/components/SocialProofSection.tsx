import { Star } from "lucide-react";
import { motion } from "motion/react";

const testimonials = [
  {
    name: "Priya S.",
    role: "Software Engineer, Hinjawadi",
    text: "Best lunch option near the office. The Continental Bowl is my daily fuel. Never going back to canteen food.",
    rating: 5,
    img: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&auto=format",
  },
  {
    name: "Rahul M.",
    role: "MBA Student, Pune",
    text: "Honestly didn't expect it to be this good. The Mexican Bowl hits different — smoky, spicy, filling. And it's actually affordable.",
    rating: 5,
    img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&auto=format",
  },
  {
    name: "Sneha K.",
    role: "Startup Founder, Koregaon Park",
    text: "Finally a bowl place that understands portion size AND taste. The Kimchi Bowl is wild. Come try it.",
    rating: 5,
    img: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&auto=format",
  },
];

export function SocialProofSection() {
  return (
    <section className="py-20 sm:py-28 bg-[#FAF5E4]">
      <div className="max-w-screen-xl mx-auto px-6 sm:px-10 lg:px-14">
        {/* Header */}
        <div className="mb-14">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-0.5 bg-[#E98A15]" />
            <span className="font-['Sora'] text-[#B36235] text-sm font-semibold tracking-[0.2em] uppercase">Real talk</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <h2 className="text-[#1F3D2B]">
              What the hustlers<br />are saying
            </h2>
            <div className="flex items-center gap-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-[#E98A15] text-[#E98A15]" />
              ))}
              <span className="font-['Sora'] text-[#1A1209]/60 text-sm ml-1">4.9 avg rating</span>
            </div>
          </div>
        </div>

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="bg-white rounded-2xl p-6 border border-[#1A1209]/6 hover:shadow-md transition-shadow"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(t.rating)].map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-[#E98A15] text-[#E98A15]" />
                ))}
              </div>
              <p className="font-['Sora'] text-[#1A1209]/80 text-sm leading-relaxed mb-6">
                "{t.text}"
              </p>
              <div className="flex items-center gap-3 pt-4 border-t border-[#1A1209]/6">
                <img src={t.img} alt={t.name} className="w-10 h-10 rounded-full object-cover" />
                <div>
                  <p className="font-['Sora'] font-semibold text-[#1F3D2B] text-sm">{t.name}</p>
                  <p className="font-['Sora'] text-[#1A1209]/40 text-xs">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
