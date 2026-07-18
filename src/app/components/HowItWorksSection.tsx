import { motion } from "motion/react";

interface HowItWorksSectionProps {
  onBuildBowlClick: () => void;
}

const steps = [
  {
    number: "01",
    title: "Choose Base",
    description: "Rice or Wrap — your foundation",
    detail: "Rice or Wheat wrap to hold it all together.",
    color: "#1F3D2B",
    img: "https://images.unsplash.com/photo-1579113800032-c38bd7635818?w=400&h=400&fit=crop&auto=format",
  },
  {
    number: "02",
    title: "Pick Protein",
    description: "Chicken, Paneer or Soya",
    detail: "Grilled fresh daily. No compromises on quality.",
    color: "#B36235",
    img: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400&h=400&fit=crop&auto=format",
  },
  {
    number: "03",
    title: "Load Veggies",
    description: "Pick as many as you like",
    detail: "Carrot, beetroot, pickled onion, broccoli, bell peppers, baby potato, beans, lettuce — the more the merrier.",
    color: "#1F3D2B",
    img: "https://images.unsplash.com/photo-1590779033100-9f60a05a013d?w=400&h=400&fit=crop&auto=format",
  },
  {
    number: "04",
    title: "Pick Dressing",
    description: "Indian-inspired signature sauces",
    detail: "Hung Curd Garlic, Chipotle, Paprika, Pesto, Makhni or Spinach",
    color: "#E98A15",
    img: "https://images.unsplash.com/photo-1543364195-bfe6e4932397?w=400&h=400&fit=crop&auto=format",
  },
];

export function HowItWorksSection({ onBuildBowlClick }: HowItWorksSectionProps) {
  return (
    <section className="py-20 sm:py-28 bg-[#FAF5E4]">
      <div className="max-w-screen-xl mx-auto px-6 sm:px-10 lg:px-14">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-16">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-0.5 bg-[#E98A15]" />
              <span className="font-['Sora'] text-[#B36235] text-sm font-semibold tracking-[0.2em] uppercase">How it works</span>
            </div>
            <h2 className="text-[#1F3D2B]">
              Four steps to<br />your perfect bowl
            </h2>
          </div>
          <button
            onClick={onBuildBowlClick}
            className="self-start lg:self-auto px-6 py-3 bg-[#1F3D2B] hover:bg-[#162d1f] text-[#E2BD87] rounded-full font-['Sora'] text-sm font-semibold tracking-wide transition-all"
          >
            Start Building →
          </button>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              className="group"
            >
              {/* Image */}
              <div className="relative rounded-2xl overflow-hidden mb-5 aspect-[4/3] bg-[#F0E8D0]">
                <img
                  src={step.img}
                  alt={step.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                <div
                  className="absolute top-3 left-3 w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: step.color }}
                >
                  <span className="font-['Anton'] text-white text-sm">{step.number}</span>
                </div>
              </div>

              <h4 className="text-[#1F3D2B] mb-1">{step.title}</h4>
              <p className="font-['Sora'] text-[#B36235] text-sm font-semibold mb-2">{step.description}</p>
              <p className="font-['Sora'] text-[#1A1209]/60 text-sm leading-relaxed">{step.detail}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
