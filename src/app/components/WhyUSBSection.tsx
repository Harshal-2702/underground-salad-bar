import { motion } from "motion/react";
import { Zap, Sliders, Leaf, Clock } from "lucide-react";

const features = [
  {
    icon: Sliders,
    title: "Your Bowl, Your Rules",
    description: "120+ ingredient combinations. We just execute — you decide what goes in.",
  },
  {
    icon: Leaf,
    title: "Fresh, Not Frozen",
    description: "Everything is prepped morning of. No microwaves, no shortcuts.",
  },
  {
    icon: Zap,
    title: "Fuel That Works",
    description: "High-protein, macro-balanced bowls for office workers and students who can't afford an energy crash at 3pm.",
  },
  {
    icon: Clock,
    title: "Ready in Minutes",
    description: "Online order to door in under 30 minutes, or walk-in and build in real-time.",
  },
];

export function WhyUSBSection() {
  return (
    <section id="why" className="py-20 sm:py-28 bg-[#1F3D2B] overflow-hidden">
      <div className="max-w-screen-xl mx-auto px-6 sm:px-10 lg:px-14">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-0.5 bg-[#E98A15]" />
              <span className="font-['Sora'] text-[#E2BD87] text-sm font-semibold tracking-[0.2em] uppercase">Why USB</span>
            </div>
            <h2 className="text-[#FAF5E4] mb-6">
              Everyday food<br />
              <span className="text-[#E98A15]">that actually</span><br />
              works for you
            </h2>
            <p className="font-['Sora'] text-[#E2BD87]/70 leading-relaxed max-w-md">
              We built USB because we were tired of choosing between fast food that makes you feel bad and "healthy" food that tastes like cardboard. You shouldn't have to compromise.
            </p>

            <div className="mt-8 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-[#E2BD87]/20 border-2 border-[#E2BD87]/30">
                <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&auto=format" alt="Customer" className="w-full h-full object-cover" />
              </div>
              <div className="w-12 h-12 rounded-full overflow-hidden bg-[#E2BD87]/20 border-2 border-[#E2BD87]/30 -ml-3">
                <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&auto=format" alt="Customer" className="w-full h-full object-cover" />
              </div>
              <div className="w-12 h-12 rounded-full overflow-hidden bg-[#E2BD87]/20 border-2 border-[#E2BD87]/30 -ml-3">
                <img src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&auto=format" alt="Customer" className="w-full h-full object-cover" />
              </div>
              <div className="ml-2">
                <p className="font-['Anton'] text-[#E2BD87] text-lg">500+ bowls</p>
                <p className="font-['Sora'] text-[#FAF5E4]/50 text-xs">served this month</p>
              </div>
            </div>
          </div>

          {/* Right: Feature grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="bg-[#FAF5E4]/6 hover:bg-[#FAF5E4]/10 border border-[#FAF5E4]/10 rounded-2xl p-6 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-[#E98A15]/15 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-[#E98A15]" />
                </div>
                <h4 className="text-[#FAF5E4] mb-2">{f.title}</h4>
                <p className="font-['Sora'] text-[#E2BD87]/60 text-sm leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
