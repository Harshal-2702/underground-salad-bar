import { motion } from "motion/react";
import { ArrowRight, MessageCircle } from "lucide-react";


interface HeroSectionProps {
  onBuildBowlClick: () => void;
}

const floatingIngredients = [
  { emoji: "🥬", x: "8%",  y: "18%", size: 40, delay: 0,    dur: 4.2, rotate: -15 },
  { emoji: "🍅", x: "72%", y: "10%", size: 36, delay: 0.6,  dur: 3.8, rotate: 12  },
  { emoji: "🌽", x: "82%", y: "65%", size: 38, delay: 1.1,  dur: 4.6, rotate: 20  },
  { emoji: "🥒", x: "5%",  y: "68%", size: 34, delay: 0.4,  dur: 3.5, rotate: -8  },
  { emoji: "🫑", x: "88%", y: "30%", size: 32, delay: 0.9,  dur: 4.0, rotate: 30  },
  { emoji: "🌿", x: "20%", y: "82%", size: 30, delay: 1.4,  dur: 3.6, rotate: -20 },
  { emoji: "🍋", x: "78%", y: "82%", size: 30, delay: 0.2,  dur: 4.4, rotate: 8   },
  { emoji: "🫘", x: "14%", y: "38%", size: 28, delay: 1.2,  dur: 3.9, rotate: 15  },
];

export function HeroSection({ onBuildBowlClick }: HeroSectionProps) {
  return (
    <section className="relative bg-[#1F3D2B] overflow-hidden min-h-[92vh] flex flex-col">
      {/* Subtle ambient glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `radial-gradient(ellipse at 65% 45%, rgba(233,138,21,0.12) 0%, transparent 55%),
                          radial-gradient(ellipse at 20% 60%, rgba(226,189,135,0.08) 0%, transparent 50%)`
      }} />

      {/* Floating ingredients — absolutely positioned, fullscreen layer */}
      {floatingIngredients.map((ing, i) => (
        <motion.span
          key={i}
          className="absolute select-none pointer-events-none"
          style={{ left: ing.x, top: ing.y, fontSize: ing.size, rotate: ing.rotate }}
          animate={{ y: [0, -12, 0], rotate: [ing.rotate, ing.rotate + 6, ing.rotate] }}
          transition={{ duration: ing.dur, delay: ing.delay, repeat: Infinity, ease: "easeInOut" }}
        >
          {ing.emoji}
        </motion.span>
      ))}

      <div className="relative flex-1 max-w-screen-xl mx-auto w-full px-6 sm:px-10 lg:px-14 py-16 lg:py-24 flex flex-col justify-center">
        {/* Tag line */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3 mb-8"
        >
          <div className="w-8 h-0.5 bg-[#E98A15]" />
          <span className="font-['Sora'] text-[#E2BD87] text-sm font-semibold tracking-[0.2em] uppercase">
            Pune's Freshest Bowl
          </span>
        </motion.div>

        {/* Main grid */}
        <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
          {/* Left: Text */}
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-[#FAF5E4] mb-2"
            >
              Build Your Bowl.
            </motion.h1>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-[#E98A15] mb-8"
            >
              Fuel Your Day.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="font-['Sora'] text-[#E2BD87]/80 text-lg lg:text-xl max-w-md leading-relaxed mb-10"
            >
              Customise your bowl with fresh bases, proteins, veggies and Indian-inspired dressings. Made to order, every time.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.45 }}
              className="flex flex-col sm:flex-row gap-4 mb-8"
            >
              <button
                onClick={onBuildBowlClick}
                className="group flex items-center justify-center gap-2.5 px-8 py-4 bg-[#E98A15] hover:bg-[#D07A0E] text-white rounded-full font-['Sora'] font-semibold tracking-wide transition-all text-base"
              >
                Build Your Bowl
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <a
                href="#signature"
                className="flex items-center justify-center gap-2 px-8 py-4 border border-[#E2BD87]/40 hover:border-[#E2BD87] text-[#E2BD87] rounded-full font-['Sora'] font-semibold tracking-wide transition-all text-base"
              >
                Explore Signature Bowls
              </a>
            </motion.div>

            <motion.a
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              href="https://wa.me/919999999999"
              className="inline-flex items-center gap-2 font-['Sora'] text-sm text-[#FAF5E4]/40 hover:text-[#25D366] transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Order on WhatsApp
            </motion.a>
          </div>

          {/* Right: Bowl — no card, blends naturally */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative flex items-center justify-center"
          >
            {/* Soft glow under bowl, no hard card */}
            <div className="absolute inset-8 rounded-full bg-[#E98A15]/10 blur-3xl" />
            <div className="absolute inset-4 rounded-full bg-[#E2BD87]/6 blur-2xl" />

            {/* Bowl image — circular mask, no rounding card */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="relative w-full max-w-sm lg:max-w-full aspect-square"
            >
              <img
                src="https://images.unsplash.com/photo-1597958792579-bd3517df6399?w=900&h=900&fit=crop&auto=format"
                alt="Fresh colourful salad bowl with vibrant vegetables"
                className="w-full h-full object-cover rounded-full"
                style={{ maskImage: "radial-gradient(ellipse 90% 90% at 50% 50%, black 60%, transparent 100%)", WebkitMaskImage: "radial-gradient(ellipse 90% 90% at 50% 50%, black 60%, transparent 100%)" }}
              />
            </motion.div>

            {/* Floating badge — 120+ combos */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              className="absolute left-0 lg:-left-6 top-1/3 bg-[#E2BD87] text-[#1A1209] rounded-2xl px-4 py-3 shadow-2xl"
            >
              <p className="font-['Anton'] text-2xl leading-none">120+</p>
              <p className="font-['Sora'] text-xs font-semibold mt-0.5">Combinations</p>
            </motion.div>

            {/* Starting price tag */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.85 }}
              className="absolute right-0 lg:-right-4 bottom-1/4 bg-[#FAF5E4]/10 backdrop-blur-md border border-[#E2BD87]/25 text-[#FAF5E4] rounded-2xl px-4 py-3 shadow-xl"
            >
              <p className="font-['Sora'] text-xs font-semibold text-[#E2BD87]">Fresh</p>
              <p className="font-['Anton'] text-2xl leading-none">Ingredients</p>
            </motion.div>
          </motion.div>
        </div>

        {/* Bottom stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="mt-16 lg:mt-20 grid grid-cols-3 gap-6 pt-10 border-t border-[#FAF5E4]/10 max-w-lg"
        >
          {[
            { num: "500+", label: "Happy customers" },
            { num: "5", label: "Dressing options" },
            { num: "100%", label: "Fresh daily" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="font-['Anton'] text-[#E98A15] text-2xl">{stat.num}</p>
              <p className="font-['Sora'] text-[#FAF5E4]/50 text-xs mt-0.5">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Bottom curve */}
      <div className="relative h-16">
        <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className="absolute bottom-0 w-full h-full" fill="none">
          <path d="M0 64 L0 30 Q360 0 720 20 Q1080 40 1440 15 L1440 64 Z" fill="#FAF5E4" />
        </svg>
      </div>
    </section>
  );
}
