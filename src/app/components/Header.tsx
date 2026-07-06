import { useState } from "react";
import { ShoppingCart, Menu, X, Instagram } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface HeaderProps {
  currentPage: "home" | "about";
  onNavigate: (page: "home" | "about") => void;
  cartItemCount: number;
  onCartClick: () => void;
}

export function Header({ currentPage, onNavigate, cartItemCount, onCartClick }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[#FAF5E4]/96 backdrop-blur-md border-b border-[#1A1209]/8">
      <div className="max-w-screen-xl mx-auto px-6 sm:px-10 lg:px-14">
        <div className="flex items-center justify-between h-20 lg:h-22">
          {/* Logo */}
          <button
            onClick={() => { onNavigate("home"); setMobileOpen(false); }}
            className="flex items-center gap-3.5 group"
          >
            <div className="w-11 h-11 rounded-xl bg-[#1F3D2B] flex items-center justify-center shadow-sm">
              <span className="text-[#E2BD87] font-['Anton'] text-base tracking-wider">USB</span>
            </div>
            <div className="hidden sm:block">
              <span className="font-['Anton'] text-[#1F3D2B] text-2xl tracking-wide uppercase leading-none block">
                Underground
              </span>
              <span className="font-['Sora'] text-[#B36235] text-xs block leading-none mt-0.5 tracking-[0.2em] uppercase font-semibold">
                Salad Bar · Pune
              </span>
            </div>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-10">
            {[
              { label: "Menu", href: "#signature" },
              { label: "Build Your Bowl", href: "#build" },
              { label: "Why USB", href: "#why" },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="font-['Sora'] text-[15px] font-semibold text-[#1A1209]/70 hover:text-[#1F3D2B] tracking-wide transition-colors"
              >
                {item.label}
              </a>
            ))}
            <button
              onClick={() => onNavigate("about")}
              className={`font-['Sora'] text-[15px] font-semibold tracking-wide transition-colors ${
                currentPage === "about" ? "text-[#1F3D2B]" : "text-[#1A1209]/70 hover:text-[#1F3D2B]"
              }`}
            >
              About
            </button>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Zomato */}
            <a
              href="https://zomato.com"
              target="_blank"
              rel="noopener noreferrer"
              title="Order on Zomato"
              className="hidden md:flex items-center gap-1.5 px-3.5 py-2 bg-[#CB202D] hover:bg-[#b01c27] text-white rounded-full transition-all font-['Sora'] text-xs font-bold tracking-wide"
            >
              <span>🍽</span> Zomato
            </a>
            {/* Instagram */}
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              title="Follow on Instagram"
              className="hidden md:flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white hover:opacity-90 transition-all"
            >
              <Instagram className="w-4 h-4" />
            </a>

            <a
              href="#order"
              className="hidden lg:flex items-center gap-2 px-5 py-2.5 bg-[#E98A15] hover:bg-[#D07A0E] text-white rounded-full transition-all font-['Sora'] text-[15px] font-semibold tracking-wide"
            >
              Order Now
            </a>

            <button
              onClick={onCartClick}
              className="relative p-2.5 text-[#1F3D2B] hover:bg-[#1F3D2B]/8 rounded-xl transition-colors"
            >
              <ShoppingCart className="w-6 h-6" />
              {cartItemCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 bg-[#E98A15] text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold"
                >
                  {cartItemCount}
                </motion.span>
              )}
            </button>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2.5 text-[#1F3D2B] hover:bg-[#1F3D2B]/8 rounded-xl transition-colors"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden overflow-hidden border-t border-[#1A1209]/8 bg-[#FAF5E4]"
          >
            <div className="px-6 py-5 space-y-1">
              {[
                { label: "Menu", href: "#signature" },
                { label: "Build Your Bowl", href: "#build" },
                { label: "Why USB", href: "#why" },
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 rounded-xl font-['Sora'] text-[15px] font-semibold text-[#1A1209]/80 hover:bg-[#1F3D2B]/6 hover:text-[#1F3D2B] transition-colors"
                >
                  {item.label}
                </a>
              ))}
              <button
                onClick={() => { onNavigate("about"); setMobileOpen(false); }}
                className="block w-full text-left px-4 py-3 rounded-xl font-['Sora'] text-[15px] font-semibold text-[#1A1209]/80 hover:bg-[#1F3D2B]/6 hover:text-[#1F3D2B] transition-colors"
              >
                About
              </button>
              {/* Social links mobile */}
              <div className="flex gap-3 px-4 py-2">
                <a href="https://zomato.com" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#CB202D] text-white rounded-full font-['Sora'] text-xs font-bold">
                  🍽 Zomato
                </a>
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white font-['Sora'] text-xs font-bold">
                  <Instagram className="w-3.5 h-3.5" /> Instagram
                </a>
              </div>
              <div className="pt-3">
                <a
                  href="#order"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center px-5 py-3.5 bg-[#E98A15] text-white rounded-full font-['Sora'] text-[15px] font-semibold tracking-wide"
                >
                  Order Now
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
