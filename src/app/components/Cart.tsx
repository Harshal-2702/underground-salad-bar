import { useState } from 'react';
import { X, Trash2, Plus, ArrowRight, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Bowl, BowlItem } from "./BowlBuilder";
export const API_URL = "https://usb-api.onrender.com";

interface CartProps {

  isOpen: boolean;

  onClose: () => void;

  bowls: Bowl[];

  updateBowls: (
    updater: (prev: Bowl[]) => Bowl[]
  ) => void;

  onRemoveBowl: (id: string) => void;

  onBuildAnother: () => void;

}
type CartView = 'cart' | 'checkout' | 'success';

const DELIVERY_AREAS = [
  { name: "Shivajinagar", deliveryCharge: 0 },
  { name: "Aundh", deliveryCharge: 0 },
  { name: "Baner", deliveryCharge: 0 },
  { name: "Balewadi", deliveryCharge: 0 },
  { name: "Pashan", deliveryCharge: 0 },
  { name: "Pimple Saudagar", deliveryCharge: 0 },
  { name: "Pimple Nilakh", deliveryCharge: 0 },
  { name: "Bopodi", deliveryCharge: 0 },
  { name: "Pune University", deliveryCharge: 0 },
  { name: "Camp", deliveryCharge: 50 },
  { name: "Sus Road", deliveryCharge: 50 },
  { name: "Wakad", deliveryCharge: 50 },
  { name: "Khadki", deliveryCharge: 50 },
  { name: "Wakdewadi", deliveryCharge: 50 },

  { name: "Other", deliveryCharge: 60 },
];

export function Cart({

isOpen,

onClose,

bowls,

updateBowls,

onRemoveBowl,

onBuildAnother,

}: CartProps){
  const [view, setView] = useState<CartView>('cart');
  const [form, setForm] = useState({ name: '', phone: '', address: '', area: '', city: 'Pune' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const grandTotal = bowls.reduce((sum, bowl) => sum + bowl.total, 0);

// Find selected area's delivery charge
const selectedArea = DELIVERY_AREAS.find(
  area => area.name === form.area
);

const deliveryCharge = selectedArea?.deliveryCharge ?? 0;

const finalTotal = grandTotal + deliveryCharge;

const recalculateTotal = (items: BowlItem[]) => {
  return items.reduce(
    (sum, item) => sum + item.price * item.scoops,
    0
  );
};

const increaseScoops = (bowlId: string, itemId: string) => {
  updateBowls(prev =>
    prev.map(bowl => {
      if (bowl.id !== bowlId) return bowl;

      const items = bowl.items.map(item =>
        item.id === itemId
          ? { ...item, scoops: item.scoops + 1 }
          : item
      );

      return {
        ...bowl,
        items,
        total: recalculateTotal(items),
      };
    })
  );
};

const decreaseScoops = (bowlId: string, itemId: string) => {
  updateBowls(prev =>
    prev
      .map(bowl => {
        if (bowl.id !== bowlId) return bowl;

        const items = bowl.items
          .map(item => {
            if (item.id !== itemId) return item;

            if (item.scoops === 1) {
              return null;
            }

            return {
              ...item,
              scoops: item.scoops - 1,
            };
          })
          .filter(Boolean) as BowlItem[];

        return {
          ...bowl,
          items,
          total: recalculateTotal(items),
        };
      })
      .filter(bowl => bowl.items.length > 0)
  );
};

const deleteIngredient = (bowlId: string, itemId: string) => {
  updateBowls(prev =>
    prev
      .map(bowl => {
        if (bowl.id !== bowlId) return bowl;

        const items = bowl.items.filter(
          item => item.id !== itemId
        );

        return {
          ...bowl,
          items,
          total: recalculateTotal(items),
        };
      })
      .filter(bowl => bowl.items.length > 0)
  );
};

  const handleClose = () => {
    setView('cart');
    setErrors({});
    onClose();
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!/^[6-9]\d{9}$/.test(form.phone)) e.phone = 'Enter a valid 10-digit phone number';
    if (!form.address.trim()) e.address = 'Address is required';
    if (!form.area) e.area = 'Please select your area';
    return e;
  };

  const handlePlaceOrder = async () => {
  const e = validate();

  if (Object.keys(e).length > 0) {
    setErrors(e);
    return;
  }

  try {
    const response = await fetch(`${API_URL}/orders`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

body: JSON.stringify({
  customerName: form.name,
  phone: form.phone,
  address: form.address,
  area: form.area,
  city: form.city,
  total: grandTotal,

  bowls: bowls.map((bowl) => ({
    name: "Build Your Own Bowl",
    quantity: 1,
    price: bowl.total,

    details: bowl.items
      .map((item) => {
        let text = `${item.category.toUpperCase()}: ${item.name}`;

        if (item.scoops > 1) {
          text += ` x${item.scoops}`;
        }

        if (item.veggieSelection?.length) {
          text += ` (${item.veggieSelection.join(", ")})`;
        }

        return text;
      })
      .join("\n"),
  })),
})
    });

    if (!response.ok) {
      throw new Error("Failed to create order");
    }

    setView("success");

  } catch (err) {
    console.error(err);
    alert("Unable to place order.");
  }
};

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop — always present when cart is open */}
      <motion.div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={handleClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      <motion.div
        className="fixed right-0 top-0 bottom-0 w-full sm:w-[460px] bg-[#FAF5E4] shadow-2xl z-50 flex flex-col"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      >
        {/* ── CART VIEW ── */}
        <AnimatePresence mode="wait">
          {view === 'cart' && (
            <motion.div key="cart" className="flex flex-col h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Header */}
              <div className="bg-[#1F3D2B] px-6 py-5 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-[#FAF5E4] text-xl">Your Cart</h3>
                  <p className="font-['Sora'] text-[#E2BD87]/60 text-xs mt-0.5">{bowls.length} bowl{bowls.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={handleClose} className="p-2 rounded-xl hover:bg-white/10 text-[#FAF5E4]/60 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Items */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {bowls.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="text-5xl mb-4">🥗</div>
                    <p className="font-['Sora'] text-[#1A1209]/50 text-sm mb-6">Your cart is empty</p>
                    <button
                      onClick={() => { handleClose(); onBuildAnother(); }}
                      className="px-6 py-3 bg-[#1F3D2B] text-[#E2BD87] rounded-full font-['Sora'] text-sm font-semibold"
                    >
                      Build Your First Bowl
                    </button>
                  </div>
                ) : (
                  <AnimatePresence>
                    {bowls.map((bowl, index) => (
                      <motion.div
                        key={bowl.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -80 }}
                        className="bg-white rounded-2xl border border-[#1A1209]/6 p-4"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <span className="font-['Anton'] text-[#1F3D2B] text-lg">Bowl #{index + 1}</span>
                          <button
                            onClick={() => onRemoveBowl(bowl.id)}
                            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-[#1A1209]/40 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="space-y-1.5 mb-3">
                          {bowl.items.map((item) => (
<div
  key={item.id}
  className="flex items-center justify-between py-1"
>
  <div className="text-sm">
    {item.name}
  </div>

  <div className="flex items-center gap-2">

    <button
      onClick={() =>
        decreaseScoops(bowl.id, item.id)
      }
      className="w-6 h-6 rounded-full border"
    >
      -
    </button>

    <span className="text-sm">
      {item.scoops}
    </span>

    <button
      onClick={() =>
        increaseScoops(bowl.id, item.id)
      }
      className="w-6 h-6 rounded-full border"
    >
      +
    </button>

    <button
      onClick={() =>
        deleteIngredient(bowl.id, item.id)
      }
      className="text-red-500 ml-2"
    >
      ✕
    </button>

  </div>
</div>
))}
                        </div>
                        <div className="pt-3 border-t border-[#1A1209]/8 flex justify-between items-center">
                          <span className="font-['Sora'] text-[#1A1209]/50 text-xs">Bowl total</span>
                          <span className="font-['Anton'] text-[#1F3D2B] text-xl">₹{bowl.total}</span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>

              {/* Footer */}
              {bowls.length > 0 && (
                <div className="shrink-0 border-t border-[#1A1209]/8 p-5 bg-white/60">
                  <div className="flex justify-between items-end mb-5">
                    <div>
                      <p className="font-['Sora'] text-[#1A1209]/50 text-xs mb-0.5">Grand Total</p>
                      <span className="font-['Anton'] text-[#1F3D2B] text-3xl">₹{grandTotal}</span>
                    </div>
                    <button
                      onClick={() => { handleClose(); onBuildAnother(); }}
                      className="flex items-center gap-1.5 px-4 py-2.5 border border-[#1F3D2B]/30 rounded-full font-['Sora'] text-xs font-semibold text-[#1F3D2B] hover:bg-[#1F3D2B]/5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add bowl
                    </button>
                  </div>
                  <button
                    onClick={() => setView('checkout')}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-[#E98A15] hover:bg-[#D07A0E] text-white rounded-full font-['Sora'] font-semibold tracking-wide transition-colors"
                  >
                    Proceed to Checkout
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* ── CHECKOUT VIEW ── */}
          {view === 'checkout' && (
            <motion.div key="checkout" className="flex flex-col h-full" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <div className="bg-[#1F3D2B] px-6 py-5 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-[#FAF5E4] text-xl">Delivery Details</h3>
                  <p className="font-['Sora'] text-[#E2BD87]/60 text-xs mt-0.5">Grand Total · ₹{grandTotal}</p>
                </div>
                <button onClick={handleClose} className="p-2 rounded-xl hover:bg-white/10 text-[#FAF5E4]/60 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                <button
                  onClick={() => setView('cart')}
                  className="flex items-center gap-2 font-['Sora'] text-sm text-[#1A1209]/50 hover:text-[#1F3D2B] mb-5 transition-colors"
                >
                  ← Back to cart
                </button>

                <div className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="font-['Sora'] text-sm font-semibold text-[#1F3D2B] block mb-1.5">Full Name *</label>
                    <input
                      type="text"
                      placeholder="Rahul Sharma"
                      value={form.name}
                      onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(err => ({ ...err, name: '' })); }}
                      className={`w-full px-4 py-3 rounded-xl border font-['Sora'] text-sm bg-white outline-none transition-colors ${errors.name ? 'border-red-400' : 'border-[#1A1209]/15 focus:border-[#1F3D2B]'}`}
                    />
                    {errors.name && <p className="font-['Sora'] text-red-500 text-xs mt-1">{errors.name}</p>}
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="font-['Sora'] text-sm font-semibold text-[#1F3D2B] block mb-1.5">Phone Number *</label>
                    <input
                      type="tel"
                      placeholder="9876543210"
                      value={form.phone}
                      onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setErrors(err => ({ ...err, phone: '' })); }}
                      maxLength={10}
                      className={`w-full px-4 py-3 rounded-xl border font-['Sora'] text-sm bg-white outline-none transition-colors ${errors.phone ? 'border-red-400' : 'border-[#1A1209]/15 focus:border-[#1F3D2B]'}`}
                    />
                    {errors.phone && <p className="font-['Sora'] text-red-500 text-xs mt-1">{errors.phone}</p>}
                  </div>

                  {/* Address */}
                  <div>
                    <label className="font-['Sora'] text-sm font-semibold text-[#1F3D2B] block mb-1.5">Flat / Building / Street *</label>
                    <textarea
                      rows={2}
                      placeholder="Flat 4B, Green Tower, MG Road"
                      value={form.address}
                      onChange={e => { setForm(f => ({ ...f, address: e.target.value })); setErrors(err => ({ ...err, address: '' })); }}
                      className={`w-full px-4 py-3 rounded-xl border font-['Sora'] text-sm bg-white outline-none transition-colors resize-none ${errors.address ? 'border-red-400' : 'border-[#1A1209]/15 focus:border-[#1F3D2B]'}`}
                    />
                    {errors.address && <p className="font-['Sora'] text-red-500 text-xs mt-1">{errors.address}</p>}
                  </div>

                  {/* Area */}
                  <div>
                    <label className="font-['Sora'] text-sm font-semibold text-[#1F3D2B] block mb-1.5">Area *</label>
                    <select
                      value={form.area}
                      onChange={e => { setForm(f => ({ ...f, area: e.target.value })); setErrors(err => ({ ...err, area: '' })); }}
                      className={`w-full px-4 py-3 rounded-xl border font-['Sora'] text-sm bg-white outline-none transition-colors ${errors.area ? 'border-red-400' : 'border-[#1A1209]/15 focus:border-[#1F3D2B]'}`}
                    >
                      <option value="">Select your area</option>
                     {DELIVERY_AREAS.map(area => (
                      <option key={area.name} value={area.name}>
                      {area.name}
                      </option>
                      ))}
                    </select>
                    {errors.area && <p className="font-['Sora'] text-red-500 text-xs mt-1">{errors.area}</p>}
                  </div>

                  {/* City — locked to Pune */}
                  <div>
                    <label className="font-['Sora'] text-sm font-semibold text-[#1F3D2B] block mb-1.5">City</label>
                    <input
                      type="text"
                      value="Pune"
                      readOnly
                      className="w-full px-4 py-3 rounded-xl border border-[#1A1209]/10 font-['Sora'] text-sm bg-[#F0E8D0] text-[#1A1209]/50 cursor-not-allowed"
                    />
                  </div>

                  {/* Order summary mini */}
                  <div className="bg-white rounded-2xl border border-[#1A1209]/8 p-4">
                    <p className="font-['Sora'] text-xs font-semibold text-[#1A1209]/50 uppercase tracking-wider mb-2">Order Summary</p>
                    <div className="flex justify-between">
                      <span className="font-['Sora'] text-sm text-[#1A1209]/70">{bowls.length} bowl{bowls.length !== 1 ? 's' : ''}</span>
                      <span className="font-['Anton'] text-[#1F3D2B]">₹{grandTotal}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="font-['Sora'] text-sm text-[#1A1209]/50">Delivery</span>
                      <span className="font-['Sora'] text-sm text-[#1F3D2B] font-semibold">{deliveryCharge === 0 ? "FREE" : `₹${deliveryCharge}`}</span>
                    </div>
                    <div className="pt-2 mt-2 border-t border-[#1A1209]/8 flex justify-between">
                      <span className="font-['Sora'] text-sm font-semibold text-[#1A1209]">Total</span>
                      <span className="font-['Anton'] text-[#E98A15] text-xl">₹{finalTotal}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="shrink-0 p-5 border-t border-[#1A1209]/8 bg-white/60">
                <button
                  onClick={handlePlaceOrder}
                  className="w-full py-4 bg-[#1F3D2B] hover:bg-[#162d1f] text-[#E2BD87] rounded-full font-['Sora'] font-semibold tracking-wide transition-colors"
                >
                  Place Order · ₹{finalTotal}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── SUCCESS VIEW ── */}
          {view === 'success' && (
            <motion.div key="success" className="flex flex-col h-full items-center justify-center p-8 text-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.1 }}
                className="w-20 h-20 rounded-full bg-[#1F3D2B] flex items-center justify-center mb-6 shadow-xl"
              >
                <CheckCircle2 className="w-10 h-10 text-[#E2BD87]" />
              </motion.div>
              <h3 className="text-[#1F3D2B] mb-3 text-2xl">Congratulations!</h3>
              <p className="font-['Anton'] text-[#E98A15] text-xl mb-3">Your order has been placed.</p>
              <p className="font-['Sora'] text-[#1A1209]/60 text-sm mb-2 leading-relaxed">
                Hi {form.name || 'there'}! We'll call you at {form.phone || 'your number'} once your bowl is on the way.
              </p>
              <p className="font-['Sora'] text-[#1A1209]/40 text-xs mb-10">
                Estimated delivery: 25–35 minutes to {form.area || 'your area'}, Pune
              </p>
              <div className="text-4xl mb-6">🥗🎉</div>
              <button
                onClick={handleClose}
                className="px-8 py-3.5 bg-[#E98A15] hover:bg-[#D07A0E] text-white rounded-full font-['Sora'] font-semibold tracking-wide transition-colors"
              >
                Back to Home
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );

 
  
}
