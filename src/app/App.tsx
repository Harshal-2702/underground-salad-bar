import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { HomePage } from "./components/HomePage";
import { AboutPage } from "./components/AboutPage";
import { BowlBuilder, Bowl } from "./components/BowlBuilder";
import { Cart } from "./components/Cart";
import { WhatsAppButton } from "./components/WhatsAppButton";
import { ShoppingCart } from "lucide-react";

type Page = "home" | "about";

// Lock / unlock body scroll when any modal is open
function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (locked) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [locked]);
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("home");
  const [isBowlBuilderOpen, setIsBowlBuilderOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

const [cartBowls, setCartBowls] = useState<Bowl[]>([]);

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
}

const [subscriptions, setSubscriptions] = useState<SubscriptionPlan[]>([]);

  const anyModalOpen = isBowlBuilderOpen || isCartOpen;
  useBodyScrollLock(anyModalOpen);

  const handleAddToCart = useCallback((bowl: Bowl) => {
    setCartBowls(prev => [...prev, bowl]);
  }, []);
  const handleAddSubscription = useCallback((subscription: {
  id: string;
  name: string;
  price: number;
}) => {
  const subscriptionItem: Bowl = {
    id: subscription.id,
    total: subscription.price,
    items: [
      {
        id: subscription.id,
        name: subscription.name,
        price: subscription.price,
        scoops: 1,
        category: "subscription",
      } as any,
    ],
  };

  setCartBowls(prev => [...prev, subscriptionItem]);
  setIsCartOpen(true);
}, []);

  const handleRemoveBowl = useCallback((bowlId: string) => {
    setCartBowls(prev => prev.filter((bowl) => bowl.id !== bowlId));
  }, []);

  const closeBowlBuilder = useCallback(() => setIsBowlBuilderOpen(false), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  const handleBuildBowlClick = useCallback(() => {
    setIsCartOpen(false);
    setIsBowlBuilderOpen(true);
  }, []);

  // Global escape key handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isBowlBuilderOpen) setIsBowlBuilderOpen(false);
        else if (isCartOpen) setIsCartOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isBowlBuilderOpen, isCartOpen]);

  return (
    <div className="min-h-screen bg-[#FAF5E4] flex flex-col">
      <Header
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        cartItemCount={cartBowls.length}
        onCartClick={() => setIsCartOpen(true)}
      />

      <main className="flex-1">
        <AnimatePresence mode="wait">
          {currentPage === "home" ? (
            <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <HomePage
  onBuildBowlClick={handleBuildBowlClick}
  onAddToCart={handleAddToCart}
  onAddSubscription={handleAddSubscription}
/>
              
            </motion.div>
          ) : (
            <motion.div key="about" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <AboutPage />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Footer />

      <WhatsAppButton />

      {/* Bowl Builder Modal */}
      <AnimatePresence>
        {isBowlBuilderOpen && (
          <BowlBuilder
            isOpen={isBowlBuilderOpen}
            onClose={closeBowlBuilder}
            onAddToCart={handleAddToCart}
          />
        )}
      </AnimatePresence>

      {/* Cart Side Panel */}
      <AnimatePresence>
        {isCartOpen && (
          <Cart
            isOpen={isCartOpen}
            onClose={closeCart}
            bowls={cartBowls}
            onRemoveBowl={handleRemoveBowl}
            onBuildAnother={handleBuildBowlClick}
          />
        )}
      </AnimatePresence>

      {/* Mobile Floating Cart Button */}
      <AnimatePresence>
        {cartBowls.length > 0 && !isCartOpen && !isBowlBuilderOpen && (
          <motion.button
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsCartOpen(true)}
            className="fixed bottom-24 left-5 z-30 bg-[#1F3D2B] hover:bg-[#162d1f] text-white p-4 rounded-full shadow-2xl transition-all lg:hidden"
          >
            <ShoppingCart className="w-6 h-6" />
            <motion.span
              className="absolute -top-2 -right-2 bg-[#E98A15] text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-lg"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring" }}
            >
              {cartBowls.length}
            </motion.span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
