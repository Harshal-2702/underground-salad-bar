import { Plus } from 'lucide-react';
import { motion } from 'motion/react';

interface PreMadeBowl {
  id: string;
  name: string;
  tagline: string;
  description: string;
  price: number;
  tag: string;
  tagColor: string;
  imgUrl: string;
  accentColor: string;
}

const preMadeBowls: PreMadeBowl[] = [
  {
    id: 'continental',
    name: 'Continental Bowl',
    tagline: 'Light. Fresh. Balanced.',
    description: 'Basmati rice, grilled chicken, broccoli, bell pepper, beetroot — finished with creamy hung curd garlic dressing.',
    price: 149,
    tag: 'Best Seller',
    tagColor: '#1F3D2B',
    imgUrl: 'https://images.unsplash.com/photo-1597958792579-bd3517df6399?w=600&h=450&fit=crop&auto=format',
    accentColor: '#1F3D2B',
  },
  {
    id: 'mexican',
    name: 'Mexican Bowl',
    tagline: 'Bold. Smoky. Satisfying.',
    description: 'Rice, spiced chicken or paneer, kidney beans, corn, chipotle dressing — a Chipotle tribute with a Pune twist.',
    price: 159,
    tag: 'Fan Favourite',
    tagColor: '#B36235',
    imgUrl: 'https://images.unsplash.com/photo-1602881916963-5daf2d97c06e?w=600&h=450&fit=crop&auto=format',
    accentColor: '#B36235',
  },
  {
    id: 'kimchi',
    name: 'Kimchi Bowl',
    tagline: 'Spicy. Fermented. Alive.',
    description: 'Basmati rice, soya chunks, carrots, lettuce, onion — drizzled with house pesto and a spicy paprika kick.',
    price: 169,
    tag: 'New',
    tagColor: '#E98A15',
    imgUrl: 'https://images.unsplash.com/photo-1569246294372-ed319c674f14?w=600&h=450&fit=crop&auto=format',
    accentColor: '#E98A15',
  },
];

interface PreMadeBowlsProps {
  onAddToCart: (bowl: any) => void;
}

export function PreMadeBowls({ onAddToCart }: PreMadeBowlsProps) {
  const handleAdd = (bowl: PreMadeBowl) => {
    onAddToCart({
      id: `premade-${bowl.id}-${Date.now()}`,
      items: [{ id: `item-${Date.now()}`, name: bowl.name, category: 'premade', price: bowl.price, scoops: 1 }],
      total: bowl.price,
    });
  };

  return (
    <section id="signature" className="py-20 sm:py-28 bg-white">
      <div className="max-w-screen-xl mx-auto px-6 sm:px-10 lg:px-14">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-14">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-0.5 bg-[#E98A15]" />
              <span className="font-['Sora'] text-[#B36235] text-sm font-semibold tracking-[0.2em] uppercase">Signature Bowls</span>
            </div>
            <h2 className="text-[#1F3D2B]">
              Chef-curated.<br />Always good.
            </h2>
          </div>
          <p className="font-['Sora'] text-[#1A1209]/60 text-base max-w-xs leading-relaxed">
            Can't decide? Start with one of our signature combos — then make it yours.
          </p>
        </div>

        {/* Bowls Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {preMadeBowls.map((bowl, i) => (
            <motion.div
              key={bowl.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              className="group flex flex-col rounded-2xl overflow-hidden border border-[#1A1209]/6 hover:border-[#1A1209]/12 hover:shadow-lg transition-all bg-[#FDFAF3]"
            >
              {/* Image */}
              <div className="aspect-[5/3] overflow-hidden bg-[#F0E8D0] relative">
                <img
                  src={bowl.imgUrl}
                  alt={bowl.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                <span
                  className="absolute top-3 left-3 px-3 py-1 rounded-full text-white font-['Sora'] text-xs font-semibold"
                  style={{ backgroundColor: bowl.tagColor }}
                >
                  {bowl.tag}
                </span>
              </div>

              {/* Content */}
              <div className="flex flex-col flex-1 p-5">
                <p className="font-['Sora'] text-xs font-semibold text-[#B36235] tracking-widest uppercase mb-1">{bowl.tagline}</p>
                <h3 className="text-[#1F3D2B] mb-3">{bowl.name}</h3>
                <p className="font-['Sora'] text-[#1A1209]/60 text-sm leading-relaxed flex-1 mb-5">{bowl.description}</p>

                <div className="flex items-center justify-between pt-4 border-t border-[#1A1209]/8">
                  <span className="font-['Anton'] text-[#1F3D2B] text-2xl">₹{bowl.price}</span>
                  <button
                    onClick={() => handleAdd(bowl)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full text-white font-['Sora'] text-sm font-semibold tracking-wide transition-all hover:opacity-90"
                    style={{ backgroundColor: bowl.accentColor }}
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
