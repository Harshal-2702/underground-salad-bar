import { motion } from "motion/react";

const categories = [
  { name: "Base", items: ["Rice", "Wrap"], color: "#E2BD87", bg: "#FAF5E4" },
  { name: "Protein", items: ["Chicken", "Paneer", "Soya Chunks"], color: "#B36235", bg: "#FDF4EC" },
  { name: "Veggies", items: ["Carrot", "Beetroot", "Broccoli", "Bell Pepper", "Lettuce", "Onion", "Baby Potato", "Corn"], color: "#1F3D2B", bg: "#EEF4EE" },
  { name: "Beans", items: ["Chickpeas", "Kidney Beans"], color: "#8B5E3C", bg: "#F7F0E8" },
  { name: "Dressing", items: ["Makhni", "Spinach", "Hung Curd Garlic", "Pesto", "Paprika", "Chipotle"], color: "#E98A15", bg: "#FDF5E8" },
];

export function BuildYourOwnSection() {
  return (
    <section id="build" className="py-20 sm:py-28 bg-[#F5EDD0]">
      <div className="max-w-screen-xl mx-auto px-6 sm:px-10 lg:px-14">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-14">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-0.5 bg-[#E98A15]" />
              <span className="font-['Sora'] text-[#B36235] text-sm font-semibold tracking-[0.2em] uppercase">The full menu</span>
            </div>
            <h2 className="text-[#1F3D2B]">
              Every ingredient.<br />Your call.
            </h2>
          </div>
          <p className="font-['Sora'] text-[#1A1209]/60 text-sm max-w-xs leading-relaxed">
            Mix and match from 5 categories. Over 120 combinations — and counting.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {categories.map((cat, i) => (
            <motion.div
              key={cat.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="rounded-2xl p-5"
              style={{ backgroundColor: cat.bg }}
            >
              <div className="w-8 h-1 rounded-full mb-3" style={{ backgroundColor: cat.color }} />
              <h4 className="mb-3" style={{ color: cat.color }}>{cat.name}</h4>
              <ul className="space-y-1.5">
                {cat.items.map(item => (
                  <li key={item} className="font-['Sora'] text-[#1A1209]/70 text-sm flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
