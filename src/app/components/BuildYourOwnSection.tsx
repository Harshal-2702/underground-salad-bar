import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { API_URL } from "../config";

type MenuCategory = { id: string; name: string; items: string[] };
const CATEGORY_STYLE: Record<string, { color: string; bg: string }> = {
  base: { color: "#E2BD87", bg: "#FAF5E4" },
  protein: { color: "#B36235", bg: "#FDF4EC" },
  veggies: { color: "#1F3D2B", bg: "#EEF4EE" },
  beans: { color: "#8B5E3C", bg: "#F7F0E8" },
  dressing: { color: "#E98A15", bg: "#FDF5E8" },
};

export function BuildYourOwnSection() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(API_URL + "/menu")
      .then(async (response) => { if (!response.ok) throw new Error("Unable to load the current menu."); return response.json(); })
      .then((catalogue) => {
        if (!active) return;
        if (!Array.isArray(catalogue.categories)) throw new Error("The current menu is unavailable.");
        setCategories(catalogue.categories);
      })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Unable to load the current menu."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <section id="build" className="py-20 sm:py-28 bg-[#F5EDD0]">
      <div className="max-w-screen-xl mx-auto px-6 sm:px-10 lg:px-14">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-14">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-0.5 bg-[#E98A15]" />
              <span className="font-['Sora'] text-[#B36235] text-sm font-semibold tracking-[0.2em] uppercase">The full menu</span>
            </div>
            <h2 className="text-[#1F3D2B]">Every ingredient.<br/>Your call.</h2>
          </div>
          <p className="font-['Sora'] text-[#1A1209]/60 text-sm max-w-xs leading-relaxed">
            Mix and match from our current ingredient categories and have as many combinations as you like.
          </p>
        </div>

        {loading && <p className="font-['Sora'] text-sm text-[#1F3D2B]/60">Loading the current menu…</p>}
        {error && <p role="alert" className="font-['Sora'] text-sm text-red-700">{error}</p>}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {categories.map((cat, i) => {
            const style = CATEGORY_STYLE[cat.id] ?? { color: "#1F3D2B", bg: "#EEF4EE" };
            return (
              <motion.div key={cat.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="rounded-2xl p-5" style={{ backgroundColor: style.bg }}>
                <div className="w-8 h-1 rounded-full mb-3" style={{ backgroundColor: style.color }}/>
                <h4 className="mb-3" style={{ color: style.color }}>{cat.name}</h4>
                <ul className="space-y-1.5">{cat.items.map(item => (
                  <li key={item} className="font-['Sora'] text-[#1A1209]/70 text-sm flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: style.color }}/>{item}
                  </li>
                ))}</ul>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
