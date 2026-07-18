import { motion } from "motion/react";
import { Check, ArrowRight } from "lucide-react";

const plans = [
  {
    meals: 26,
    price: 5199,
    pricePerMeal: Math.round(5199 / 26),
    color: "#1F3D2B",
    textAccent: "#E2BD87",
    bgCard: "#1F3D2B",
    tag: "Best Value",
    tagBg: "#E98A15",
    perks: [
      "26 meals per month",
      "Replace 2 meals with Exotic Bowls",
      "OR get 3 extra topping portions",
      "Priority delivery",
      "Dedicated support line",
    ],
    cta: "Start 26-Meal Plan",
    popular: true,
  },
  {
    meals: 14,
    price: 2950,
    pricePerMeal: Math.round(2950 / 14),
    color: "#FAF5E4",
    textAccent: "#E98A15",
    bgCard: "#FAF5E4",
    tag: "Starter",
    tagBg: "#B36235",
    perks: [
      "18 meals per month",
      "Replace 1 meal with Exotic Bowl",
      "OR get 2 extra topping portions",
      "Standard delivery",
      "WhatsApp support line",
    ],
    cta: "Start 18-Meal Plan",
    popular: false,
  },
];

interface SubscriptionSectionProps {
  onAddSubscription: (plan: {
    id: string;
    name: string;
    price: number;
  }) => void;
}

export function SubscriptionSection({
  onAddSubscription,
}: SubscriptionSectionProps) {
  return (
    <section className="py-20 sm:py-28 bg-[#F5EDD0]">
      <div className="max-w-screen-xl mx-auto px-6 sm:px-10 lg:px-14">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-14">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-0.5 bg-[#E98A15]" />
              <span className="font-['Sora'] text-[#B36235] text-sm font-semibold tracking-[0.2em] uppercase">Meal Plans</span>
            </div>
            <h2 className="text-[#1F3D2B]">
              Subscribe & save.<br />
              <span className="text-[#B36235]">Eat better, every day.</span>
            </h2>
          </div>
          <p className="font-['Sora'] text-[#1A1209]/60 text-base max-w-sm leading-relaxed">
            Commit to fresh, skip the daily decision fatigue. Swap for exotic bowls or load up on extra toppings — your call.
          </p>
        </div>

        {/* Plans */}
        <div className="grid sm:grid-cols-2 gap-6 max-w-3xl">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.meals}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.12 }}
              className={`relative rounded-3xl p-7 flex flex-col ${plan.popular ? 'shadow-2xl' : 'border border-[#1A1209]/10 shadow-md'}`}
              style={{ backgroundColor: plan.bgCard }}
            >
              {/* Tag */}
              <span
                className="absolute -top-3 left-6 px-4 py-1 rounded-full font-['Sora'] text-xs font-bold text-white"
                style={{ backgroundColor: plan.tagBg }}
              >
                {plan.tag}
              </span>

              {/* Meal count */}
              <div className="mb-5 pt-2">
                <p className="font-['Anton'] leading-none" style={{ fontSize: '3.5rem', color: plan.textAccent }}>
                  {plan.meals}
                </p>
                <p className={`font-['Sora'] text-sm font-semibold tracking-widest uppercase ${plan.popular ? 'text-[#FAF5E4]/60' : 'text-[#1A1209]/50'}`}>
                  Meals / month
                </p>
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-end gap-2">
                  <span className="font-['Anton'] text-4xl" style={{ color: plan.popular ? '#FAF5E4' : '#1F3D2B' }}>
                    ₹{plan.price.toLocaleString('en-IN')}
                  </span>
                  <span className={`font-['Sora'] text-sm mb-1 ${plan.popular ? 'text-[#FAF5E4]/50' : 'text-[#1A1209]/40'}`}>/month</span>
                </div>
                <p className={`font-['Sora'] text-sm font-semibold ${plan.popular ? 'text-[#E2BD87]' : 'text-[#B36235]'}`}>
                  ₹{plan.pricePerMeal} per meal
                </p>
              </div>

              {/* Perks */}
              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.perks.map(perk => (
                  <li key={perk} className="flex items-start gap-2.5">
                    <Check
                      className="w-4 h-4 mt-0.5 shrink-0"
                      style={{ color: plan.popular ? '#E98A15' : '#1F3D2B' }}
                    />
                    <span className={`font-['Sora'] text-sm ${plan.popular ? 'text-[#FAF5E4]/80' : 'text-[#1A1209]/70'}`}>
                      {perk}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
  onClick={() =>
    onAddSubscription({
      id: crypto.randomUUID(),
      name: `${plan.meals} Meal Plan`,
      price: plan.price,
    })
  }
                className="flex items-center justify-center gap-2 w-full py-4 rounded-full font-['Sora'] font-semibold tracking-wide transition-all group"
                style={{
                  backgroundColor: plan.popular ? '#E98A15' : '#1F3D2B',
                  color: plan.popular ? '#fff' : '#E2BD87',
                }}
              >
                {plan.cta}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          ))}
        </div>

        <p className="font-['Sora'] text-[#1A1209]/40 text-sm mt-8">
          All plans auto-renew monthly. Cancel anytime. Delivery within Pune only.
        </p>
      </div>
    </section>
  );
}
