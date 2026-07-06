import { Instagram } from 'lucide-react';
import { MessageCircle } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-[#1F3D2B] text-white py-12 sm:py-16">
      <div className="max-w-screen-xl mx-auto px-6 sm:px-10 lg:px-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-[#E2BD87] flex items-center justify-center">
                <span className="font-['Anton'] text-[#1F3D2B] text-sm">USB</span>
              </div>
              <div>
                <p className="font-['Anton'] text-[#FAF5E4] text-lg uppercase tracking-wide leading-none">Underground</p>
                <p className="font-['Sora'] text-[#E2BD87] text-xs tracking-widest uppercase leading-none mt-0.5">Salad Bar</p>
              </div>
            </div>
            <p className="font-['Sora'] text-[#FAF5E4]/50 text-sm leading-relaxed max-w-xs">
              Build-your-own bowls with Indian-inspired flavours. Fresh. Fast. Affordable. Pune-born.
            </p>
          </div>

          {/* Links */}
          <div>
            <p className="font-['Sora'] text-[#E2BD87] text-xs font-semibold tracking-widest uppercase mb-4">Menu</p>
            <div className="space-y-2.5">
              {['Signature Bowls', 'Build Your Bowl', 'Why USB', 'About Us'].map(item => (
                <a key={item} href="#" className="block font-['Sora'] text-[#FAF5E4]/60 text-sm hover:text-[#E2BD87] transition-colors">
                  {item}
                </a>
              ))}
            </div>
          </div>

          {/* Contact + Social */}
          <div>
            <p className="font-['Sora'] text-[#E2BD87] text-xs font-semibold tracking-widest uppercase mb-4">Order &amp; Follow</p>
            <div className="space-y-3">
              <p className="font-['Sora'] text-[#FAF5E4]/60 text-sm">📍 Delivering across Pune</p>
              <a href="https://wa.me/919999999999"
                className="inline-flex items-center gap-2 font-['Sora'] text-[#FAF5E4]/60 text-sm hover:text-[#25D366] transition-colors">
                <MessageCircle className="w-4 h-4" />
                WhatsApp us
              </a>
            </div>

            {/* Prominent social buttons */}
            <div className="flex flex-col gap-2.5 mt-5">
              <a href="https://zomato.com" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 bg-[#CB202D] hover:bg-[#b01c27] text-white rounded-xl font-['Sora'] text-sm font-semibold transition-colors">
                <span className="text-lg">🍽</span>
                <span>Order on Zomato</span>
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 rounded-xl font-['Sora'] text-sm font-semibold transition-opacity hover:opacity-90 text-white"
                style={{ background: 'linear-gradient(135deg, #f9ce34, #ee2a7b, #6228d7)' }}>
                <Instagram className="w-4 h-4" />
                <span>Follow @undergroundsaladbarpune</span>
              </a>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-['Sora'] text-[#FAF5E4]/30 text-xs">
            © 2026 Underground Salad Bar. All rights reserved.
          </p>
          <p className="font-['Sora'] text-[#FAF5E4]/30 text-xs">
            Made with 🥗 in Pune
          </p>
        </div>
      </div>
    </footer>
  );
}
