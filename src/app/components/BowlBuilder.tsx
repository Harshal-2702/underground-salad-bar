import { useState } from 'react';
import { Plus, Minus, X, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface BowlItem {
  id: string;
  name: string;
  category: string;
  price: number;
  scoops: number;
  veggieSelection?: string[];
}

export interface Bowl {
  id: string;
  items: BowlItem[];
  total: number;
}

interface BowlBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (bowl: Bowl) => void;
}

// Ingredient thumbnails — Unsplash macro shots
/*
const INGREDIENT_IMGS: Record<string, string> = {
  Rice:             'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=120&h=120&fit=crop&auto=format',
  Wrap:             'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=120&h=120&fit=crop&auto=format',
  Chicken:          'https://images.unsplash.com/photo-1604503468506-a8da13d11d36?w=120&h=120&fit=crop&auto=format',
  Paneer:           'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=120&h=120&fit=crop&auto=format',
  'Soya Chunks':    'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=120&h=120&fit=crop&auto=format',
  Carrot:           'https://images.unsplash.com/photo-1590779033100-9f60a05a013d?w=120&h=120&fit=crop&auto=format',
  Beetroot:         'https://images.unsplash.com/photo-1595855759920-86582396756a?w=120&h=120&fit=crop&auto=format',
  'Baby Potato':    'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=120&h=120&fit=crop&auto=format',
  Broccoli:         'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=120&h=120&fit=crop&auto=format',
  'Bell Pepper':    'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=120&h=120&fit=crop&auto=format',
  Lettuce:          'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=120&h=120&fit=crop&auto=format',
  Onion:            'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=120&h=120&fit=crop&auto=format',
  Corn:             'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=120&h=120&fit=crop&auto=format',
  Chickpeas:        'https://images.unsplash.com/photo-1515543904379-3d757afe72e4?w=120&h=120&fit=crop&auto=format',
  'Kidney Beans':   'https://images.unsplash.com/photo-1515543904379-3d757afe72e4?w=120&h=120&fit=crop&auto=format',
  Makhni:           'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=120&h=120&fit=crop&auto=format',
  Spinach:          'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=120&h=120&fit=crop&auto=format',
  'Hung Curd Garlic': 'https://images.unsplash.com/photo-1571997478779-2adcbbe9ab2f?w=120&h=120&fit=crop&auto=format',
  Pesto:            'https://images.unsplash.com/photo-1534939561126-855b8675edd7?w=120&h=120&fit=crop&auto=format',
  Paprika:          'https://images.unsplash.com/photo-1506368083636-6defb67639a7?w=120&h=120&fit=crop&auto=format',
  Chipotle:         'https://images.unsplash.com/photo-1625944525533-473f1a3d54e7?w=120&h=120&fit=crop&auto=format',
};
*/

// Bowl layer colors for realistic stacking
const LAYER_COLORS = {
  base:    { color: '#D4A574', label: '🌾 Base' },
  protein: { color: '#8B5E3C', label: '🔥 Protein' },
  veggies: { color: '#4CAF50', label: '🥬 Veggies' },
  beans:   { color: '#795548', label: '🫘 Beans' },
  dressing:{ color: '#FF8C00', label: '✨ Dressing' },
};

const categories = [
  { id: 'base',     name: 'Base',     subtitle: 'Your foundation',        pricePerScoop: 40,  items: ['Rice', 'Wrap'],                                                             note: null },
  { id: 'protein',  name: 'Protein',  subtitle: 'Fresh-grilled daily',    pricePerScoop: 59,  items: ['Chicken', 'Paneer', 'Soya Chunks'],                                         note: null },
  { id: 'veggies',  name: 'Veggies',  subtitle: 'Pick as many as you like', pricePerScoop: 40, items: ['Carrot', 'Beetroot', 'Baby Potato', 'Broccoli', 'Bell Pepper', 'Lettuce', 'Onion', 'Corn'], note: 'Unlimited variety per scoop' },
  { id: 'beans',    name: 'Beans',    subtitle: 'Extra protein & fibre',   pricePerScoop: 30,  items: ['Chickpeas', 'Kidney Beans'],                                                note: null },
  { id: 'dressing', name: 'Dressing', subtitle: 'The magic touch',         pricePerScoop: 50,  items: ['Makhni', 'Spinach', 'Hung Curd Garlic', 'Pesto', 'Paprika', 'Chipotle'], note: null },
];

// Visual bowl preview
function RealisticBowlPreview({ selectedItems, selectedVeggies, veggieScoops }: {
  selectedItems: BowlItem[];
  selectedVeggies: string[];
  veggieScoops: number;
}) {
  const hasBase    = selectedItems.some(i => i.category === 'base');
  const proteins   = selectedItems.filter(i => i.category === 'protein');
  const hasVeggies = selectedVeggies.length > 0 || veggieScoops > 0;
  const hasBeans   = selectedItems.some(i => i.category === 'beans');
  const hasDressing= selectedItems.some(i => i.category === 'dressing');
  const isEmpty    = !hasBase && proteins.length === 0 && !hasVeggies && !hasBeans && !hasDressing;

  return (
    <div className="relative w-44 h-44 mx-auto select-none">
      {/* Bowl shadow */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-36 h-5 bg-black/12 rounded-full blur-lg" />

      {/* Bowl background shell */}
      <div className="absolute inset-0 rounded-full bg-[#E8DDD0] border-4 border-[#C9B89A] overflow-hidden shadow-inner">
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl opacity-20">🍽️</span>
          </div>
        )}

        {/* BASE layer — rice/wrap fills bottom */}
        {hasBase && (
          <motion.div
            initial={{ scaleY: 0, originY: 1 }}
            animate={{ scaleY: 1 }}
            className="absolute bottom-0 left-0 right-0 h-[55%] rounded-b-full"
            style={{ background: 'linear-gradient(180deg, #f0c870 0%, #c8913a 100%)' }}
          />
        )}

        {/* PROTEIN — scoop-shaped blobs mid-bowl */}
        {proteins.map((p, pi) => (
          <motion.div
            key={p.id}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: pi * 0.1 }}
            className="absolute w-14 h-14 rounded-full opacity-90"
            style={{
              background: pi === 0 ? 'radial-gradient(circle, #a0522d, #6B3A1F)' : 'radial-gradient(circle, #e8d5b7, #c4a070)',
              top: `${28 + pi * 8}%`,
              left: `${18 + pi * 22}%`,
            }}
          />
        ))}

        {/* VEGGIES — colourful scattered spots */}
        {hasVeggies && selectedVeggies.slice(0, 6).map((v, vi) => {
          const colours = ['#4CAF50','#F44336','#FF9800','#9C27B0','#2196F3','#FFEB3B'];
          return (
            <motion.div
              key={v}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.9 }}
              transition={{ delay: vi * 0.05 }}
              className="absolute rounded-full"
              style={{
                width: 18 + (vi % 3) * 4,
                height: 18 + (vi % 3) * 4,
                backgroundColor: colours[vi % colours.length],
                top: `${15 + (vi * 13) % 55}%`,
                left: `${10 + (vi * 17) % 70}%`,
              }}
            />
          );
        })}

        {/* BEANS — small dark oval clusters */}
        {hasBeans && [0,1,2,3].map(bi => (
          <motion.div
            key={bi}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: bi * 0.07 }}
            className="absolute rounded-full bg-[#5D4037]"
            style={{ width: 12, height: 10, top: `${52 + bi * 7}%`, left: `${55 + (bi % 2) * 12}%` }}
          />
        ))}

        {/* DRESSING — translucent drizzle */}
        {hasDressing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 rounded-full"
            style={{ background: 'radial-gradient(ellipse at 55% 35%, rgba(233,138,21,0.45) 0%, transparent 55%)' }}
          />
        )}
      </div>

      {/* Bowl rim highlight */}
      <div className="absolute inset-0 rounded-full border-4 border-white/30 pointer-events-none" />
    </div>
  );
}

export function BowlBuilder({ isOpen, onClose, onAddToCart }: BowlBuilderProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedItems, setSelectedItems] = useState<BowlItem[]>([]);
  const [veggieScoops, setVeggieScoops] = useState(0);
  const [selectedVeggies, setSelectedVeggies] = useState<string[]>([]);

  if (!isOpen) return null;

  const currentCategory = categories[currentStep];

  const handleVeggieToggle = (name: string) =>
    setSelectedVeggies(prev => prev.includes(name) ? prev.filter(v => v !== name) : [...prev, name]);

  const handleAddItem = (itemName: string) => {
    const existing = selectedItems.find(i => i.name === itemName && i.category === currentCategory.id);
    if (existing) {
      setSelectedItems(prev => prev.map(i => i.id === existing.id ? { ...i, scoops: i.scoops + 1 } : i));
    } else {
      setSelectedItems(prev => [...prev, { id: `${currentCategory.id}-${itemName}-${Date.now()}`, name: itemName, category: currentCategory.id, price: currentCategory.pricePerScoop, scoops: 1 }]);
    }
  };

  const handleRemoveItem = (itemId: string) => {
    const item = selectedItems.find(i => i.id === itemId);
    if (!item) return;
    if (item.scoops > 1) setSelectedItems(prev => prev.map(i => i.id === itemId ? { ...i, scoops: i.scoops - 1 } : i));
    else setSelectedItems(prev => prev.filter(i => i.id !== itemId));
  };

  const getItemScoops = (itemName: string) =>
    selectedItems.find(i => i.name === itemName && i.category === currentCategory.id)?.scoops || 0;

  const calculateTotal = () =>
    selectedItems.reduce((sum, i) => sum + i.price * i.scoops, 0) + (veggieScoops > 0 ? veggieScoops * 40 : 0);

  const saveVeggies = () => {
    if (currentStep === 2 && veggieScoops > 0 && selectedVeggies.length > 0) {
      const vi: BowlItem = { id: `veggies-${Date.now()}`, name: 'Veggie Scoop', category: 'veggies', price: 40, scoops: veggieScoops, veggieSelection: selectedVeggies };
      setSelectedItems(prev => [...prev.filter(i => i.category !== 'veggies'), vi]);
    }
  };

  const handleNext = () => { saveVeggies(); if (currentStep < categories.length - 1) setCurrentStep(s => s + 1); };
  const handleBack = () => { if (currentStep > 0) setCurrentStep(s => s - 1); };

  const handleAddToCart = () => {
    let finalItems = [...selectedItems];
    if (currentStep === 2 && veggieScoops > 0 && selectedVeggies.length > 0) {
      finalItems = [...finalItems.filter(i => i.category !== 'veggies'), { id: `veggies-${Date.now()}`, name: 'Veggie Scoop', category: 'veggies', price: 40, scoops: veggieScoops, veggieSelection: selectedVeggies }];
    }
    if (finalItems.length === 0 && veggieScoops === 0) return;
    onAddToCart({ id: `bowl-${Date.now()}`, items: finalItems, total: calculateTotal() });
    setSelectedItems([]); setVeggieScoops(0); setSelectedVeggies([]); setCurrentStep(0); onClose();
  };

const handleClose = () => {
  console.log("HANDLE CLOSE FIRED");

  setSelectedItems([]);
  setVeggieScoops(0);
  setSelectedVeggies([]);
  setCurrentStep(0);

  onClose();
};

  return (
    <motion.div
  className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
  onClick={(e) => {
    if (e.target === e.currentTarget) handleClose();
  }}
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
>
      <motion.div
        className="bg-[#FAF5E4] w-full sm:max-w-2xl lg:max-w-6xl lg:max-h-[90vh] sm:rounded-3xl max-h-[96vh] flex flex-col overflow-hidden shadow-2xl"
        initial={{ opacity: 0, y: 80 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 80 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#1F3D2B] px-6 py-5 flex items-center justify-between shrink-0">
          <div>
            <p className="font-['Sora'] text-[#E2BD87]/50 text-xs font-semibold tracking-widest uppercase mb-0.5">
              Step {currentStep + 1} of {categories.length}
            </p>
            <h3 className="text-[#FAF5E4] text-xl">{currentCategory.name}</h3>
            <p className="font-['Sora'] text-[#E2BD87]/60 text-xs mt-0.5">{currentCategory.subtitle}</p>
          </div>
          <button onClick={handleClose} className="p-2 rounded-xl hover:bg-white/10 text-[#FAF5E4]/60 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="flex shrink-0 bg-[#1F3D2B]">
          {categories.map((cat, i) => (
            <div key={i} className="flex-1 h-1 transition-all" style={{
              backgroundColor: i < currentStep ? '#E98A15' : i === currentStep ? '#E2BD87' : 'rgba(255,255,255,0.1)'
            }} />
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* Left: selections */}
          <div className="flex-1 overflow-y-auto p-5 lg:p-7">
            <div className="mb-5">
              <p className="font-['Sora'] text-[#1A1209]/50 text-sm">
                ₹{currentCategory.pricePerScoop} per scoop
                {currentCategory.note && <span className="ml-2 text-[#E98A15] font-semibold">· {currentCategory.note}</span>}
              </p>
            </div>

            {/* Veggie step */}
            {currentCategory.id === 'veggies' ? (
              <div>
                <div className="flex items-center justify-between bg-white rounded-2xl px-5 py-4 border border-[#1A1209]/8 mb-5">
                  <div>
                    <p className="font-['Sora'] font-semibold text-[#1F3D2B] text-sm">Veggie scoops</p>
                    <p className="font-['Sora'] text-[#1A1209]/50 text-xs">₹{veggieScoops * 40} total</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button onClick={() => setVeggieScoops(v => Math.max(0, v - 1))} disabled={veggieScoops === 0}
                      className="w-9 h-9 rounded-full border-2 border-[#1F3D2B] text-[#1F3D2B] flex items-center justify-center disabled:opacity-30 transition-opacity">
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-['Anton'] text-2xl text-[#1F3D2B] w-7 text-center">{veggieScoops}</span>
                    <button onClick={() => setVeggieScoops(v => v + 1)}
                      className="w-9 h-9 rounded-full bg-[#1F3D2B] text-white flex items-center justify-center hover:bg-[#162d1f] transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Veggie chips with thumbnails */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {currentCategory.items.map(veggie => {
                    const sel = selectedVeggies.includes(veggie);
                    return (
                      <button key={veggie} onClick={() => handleVeggieToggle(veggie)}
                        className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all text-center ${sel ? 'border-[#1F3D2B] bg-[#1F3D2B]/6 shadow-sm' : 'border-[#1A1209]/10 bg-white hover:border-[#1F3D2B]/30'}`}>
                        {/* Thumbnail 
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#F0E8D0]">
                          <img src={INGREDIENT_IMGS[veggie] || 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=120&h=120&fit=crop&auto=format'} alt={veggie} className="w-full h-full object-cover" />
                        </div>
                        */ }
                        <span className={`font-['Sora'] text-xs font-semibold ${sel ? 'text-[#1F3D2B]' : 'text-[#1A1209]/70'}`}>{veggie}</span>
                        {sel && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                            className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#1F3D2B] flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </motion.div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Regular items with thumbnails */
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {currentCategory.items.map(item => {
                  const scoops = getItemScoops(item);
                  const itemObj = selectedItems.find(i => i.name === item && i.category === currentCategory.id);
                  return (
                    <motion.div key={item} layout
                      className={`relative group rounded-2xl border overflow-hidden transition-all cursor-pointer ${scoops > 0 ? 'border-[#1F3D2B] shadow-md ring-1 ring-[#1F3D2B]/20' : 'border-[#1A1209]/10 bg-white hover:border-[#1F3D2B]/30'}`}
                      onClick={() => handleAddItem(item)}
                    >
                      {/* Thumbnail 
                      <div className="aspect-[4/3] overflow-hidden bg-[#F0E8D0]">
                        <img
                          src={INGREDIENT_IMGS[item] || 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=120&h=120&fit=crop&auto=format'}
                          alt={item}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        
                        {scoops > 0 && (
                          <div className="absolute inset-0 bg-[#1F3D2B]/10" />
                        )}
                      </div>*/}

                      <div className="p-3">
                        <p className={`font-['Sora'] font-semibold text-sm mb-2 ${scoops > 0 ? 'text-[#1F3D2B]' : 'text-[#1A1209]'}`}>{item}</p>
                        <div className="flex items-center justify-between">
                          <span className="font-['Sora'] text-xs text-[#1A1209]/40">₹{currentCategory.pricePerScoop}</span>
                          {scoops > 0 ? (
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                              <button onClick={() => itemObj && handleRemoveItem(itemObj.id)}
                                className="w-6 h-6 rounded-full border border-[#1F3D2B] text-[#1F3D2B] flex items-center justify-center hover:bg-[#1F3D2B] hover:text-white transition-colors">
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="font-['Anton'] text-base text-[#1F3D2B]">{scoops}</span>
                              <button onClick={() => handleAddItem(item)}
                                className="w-6 h-6 rounded-full bg-[#1F3D2B] text-white flex items-center justify-center hover:bg-[#162d1f] transition-colors">
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full border border-[#1A1209]/20 flex items-center justify-center text-[#1A1209]/40 group-hover:border-[#1F3D2B] group-hover:text-[#1F3D2B] transition-colors">
                              <Plus className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      </div>

                      {scoops > 0 && (
                        <div className="absolute top-2 left-2 bg-[#1F3D2B] text-white rounded-full w-6 h-6 flex items-center justify-center">
                          <span className="font-['Anton'] text-xs">{scoops}</span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Bowl Preview (desktop sticky) */}
          <div className="hidden lg:flex w-72 border-l border-[#1A1209]/8 flex-col shrink-0">
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white/40">
              <p className="font-['Sora'] text-[#1A1209]/40 text-xs font-semibold tracking-widest uppercase mb-4">Your Bowl</p>
              <RealisticBowlPreview selectedItems={selectedItems} selectedVeggies={selectedVeggies} veggieScoops={veggieScoops} />

              {/* Ingredient layer legend */}
              <div className="mt-5 w-full space-y-1.5">
                {Object.entries(LAYER_COLORS).map(([cat, info]) => {
                  const filled = cat === 'veggies'
                    ? (selectedVeggies.length > 0 || veggieScoops > 0)
                    : selectedItems.some(i => i.category === cat);
                  return (
                    <div key={cat} className={`flex items-center gap-2 transition-opacity ${filled ? 'opacity-100' : 'opacity-30'}`}>
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: info.color }} />
                      <span className="font-['Sora'] text-xs text-[#1A1209]/70">{info.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="p-5 bg-white/60 border-t border-[#1A1209]/8">
              <div className="flex items-center justify-between mb-1">
                <span className="font-['Sora'] text-[#1A1209]/50 text-xs">Bowl total</span>
                <span className="font-['Anton'] text-[#1F3D2B] text-2xl">₹{calculateTotal()}</span>
              </div>
              <p className="font-['Sora'] text-[#1A1209]/40 text-xs">
                {selectedItems.reduce((s, i) => s + i.scoops, 0) + veggieScoops} scoops selected
              </p>
            </div>
          </div>
        </div>

        {/* Mobile summary bar */}
        <div className="lg:hidden shrink-0 bg-white/80 border-t border-[#1A1209]/8 px-5 py-3 flex items-center justify-between">
          <div>
            <p className="font-['Sora'] text-[#1A1209]/50 text-xs">Bowl total</p>
            <span className="font-['Anton'] text-[#1F3D2B] text-xl">₹{calculateTotal()}</span>
          </div>
          <span className="font-['Sora'] text-[#1A1209]/40 text-xs">
            {selectedItems.reduce((s, i) => s + i.scoops, 0) + veggieScoops} scoops
          </span>
        </div>

        {/* Footer nav */}
        <div className="shrink-0 px-5 lg:px-7 py-5 bg-[#FAF5E4] border-t border-[#1A1209]/8 flex gap-3">
          {currentStep > 0 && (
            <button onClick={handleBack}
              className="flex items-center gap-1 px-5 py-3.5 border border-[#1A1209]/15 rounded-full font-['Sora'] text-sm font-semibold text-[#1A1209]/70 hover:border-[#1F3D2B] hover:text-[#1F3D2B] transition-colors">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
          {currentStep < categories.length - 1 ? (
            <button onClick={handleNext}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-[#1F3D2B] hover:bg-[#162d1f] text-[#E2BD87] rounded-full font-['Sora'] text-sm font-semibold tracking-wide transition-colors">
              Next: {categories[currentStep + 1].name}
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleAddToCart} disabled={selectedItems.length === 0 && veggieScoops === 0}
              className="flex-1 py-3.5 bg-[#E98A15] hover:bg-[#D07A0E] text-white rounded-full font-['Sora'] text-sm font-semibold tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Add to Cart · ₹{calculateTotal()}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
