import { ArrowRight, MessageCircle, Instagram } from "lucide-react";
import { motion } from "motion/react";

interface OrderingCTASectionProps {
  onBuildBowlClick: () => void;
}

export function OrderingCTASection({ onBuildBowlClick }: OrderingCTASectionProps) {
  return (
    <section id="order" className="py-20 sm:py-28 bg-[#E2BD87]">
      <div className="max-w-4xl mx-auto px-5 sm:px-8 lg:px-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-8 h-0.5 bg-[#1F3D2B]" />
            <span className="font-['Sora'] text-[#1F3D2B] text-sm font-semibold tracking-[0.2em] uppercase">Order Now</span>
            <div className="w-8 h-0.5 bg-[#1F3D2B]" />
          </div>

          <h2 className="text-[#1F3D2B] mb-4">
            Hungry?<br />
            Let's fix that.
          </h2>
          <p className="font-['Sora'] text-[#1A1209]/70 text-lg mb-10 max-w-md mx-auto leading-relaxed">
            Build your own from scratch, or grab a signature bowl and go.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <button
              onClick={onBuildBowlClick}
              className="group flex items-center justify-center gap-2.5 px-8 py-4 bg-[#1F3D2B] hover:bg-[#162d1f] text-[#E2BD87] rounded-full font-['Sora'] font-semibold tracking-wide transition-all"
            >
              Build Your Bowl
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <a
              href="https://wa.me/+918208707976?text=Hi%20Underground%20Salad%20Bar,%20I%20want%20to%20place%20an%20order."
              className="flex items-center justify-center gap-2.5 px-8 py-4 bg-white/50 hover:bg-white/80 text-[#1A1209] rounded-full font-['Sora'] font-semibold tracking-wide transition-all border border-[#1A1209]/10"
            >
              <MessageCircle className="w-5 h-5" />
              Order on WhatsApp
            </a>
          </div>

          <p className="font-['Sora'] text-[#1A1209]/50 text-sm mb-10">
            Free delivery on orders above ₹300 · Pune only
          </p>

          {/* Social order buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <a href="https://zomato.com" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-6 py-3.5 bg-[#CB202D] hover:bg-[#b01c27] text-white rounded-full font-['Sora'] font-semibold text-sm tracking-wide transition-all shadow-md">
              <span>🍽</span> Order on Zomato
            </a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-full font-['Sora'] font-semibold text-sm tracking-wide transition-opacity hover:opacity-90 text-white shadow-md"
              style={{ background: 'linear-gradient(135deg, #f9ce34, #ee2a7b, #6228d7)' }}>
              <Instagram className="w-4 h-4" /> Follow us on Instagram
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
