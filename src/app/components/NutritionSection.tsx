import { Leaf, Heart, Zap, Shield } from 'lucide-react';
import { motion } from 'motion/react';

const values = [
  {
    icon: Leaf,
    title: 'Fresh Ingredients',
    description: 'Sourced daily from trusted local suppliers',
    color: 'from-green-400 to-emerald-500',
    bgColor: 'bg-green-50'
  },
  {
    icon: Heart,
    title: 'Balanced Nutrition',
    description: 'Every bowl is designed for optimal health',
    color: 'from-red-400 to-pink-500',
    bgColor: 'bg-red-50'
  },
  {
    icon: Zap,
    title: 'Energy Boost',
    description: 'Fuel your day with wholesome goodness',
    color: 'from-yellow-400 to-orange-500',
    bgColor: 'bg-yellow-50'
  },
  {
    icon: Shield,
    title: 'Quality Promise',
    description: 'No preservatives, just pure quality',
    color: 'from-blue-400 to-purple-500',
    bgColor: 'bg-blue-50'
  }
];

export function NutritionSection() {
  return (
    <section className="py-12 sm:py-16 lg:py-20 bg-gradient-to-b from-white to-gray-50 relative overflow-hidden">
      {/* Decorative elements */}
      <motion.div
        className="absolute top-20 left-[10%] w-24 h-24 sm:w-32 sm:h-32 bg-green-400/10 rounded-full blur-2xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-20 right-[15%] w-32 h-32 sm:w-40 sm:h-40 bg-blue-400/10 rounded-full blur-2xl"
        animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 5, repeat: Infinity, delay: 1 }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div 
          className="text-center mb-12 sm:mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 mb-3 sm:mb-4 px-4">
            Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-blue-600">Values</span>
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 font-medium max-w-2xl mx-auto px-4">
            We believe in serving meals that nourish your body and delight your taste buds
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {values.map((value, index) => {
            const Icon = value.icon;
            return (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -10 }}
                className="relative"
              >
                <div className={`text-center p-6 sm:p-8 rounded-3xl ${value.bgColor} hover:shadow-2xl transition-all border-2 border-white relative overflow-hidden group`}>
                  {/* Gradient overlay on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${value.color} opacity-0 group-hover:opacity-10 transition-opacity`}></div>
                  
                  {/* Icon container */}
                  <motion.div 
                    className={`relative z-10 w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 bg-gradient-to-br ${value.color} rounded-2xl flex items-center justify-center shadow-lg`}
                    whileHover={{ rotate: 360, scale: 1.1 }}
                    transition={{ duration: 0.6 }}
                  >
                    <Icon className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                  </motion.div>
                  
                  <h3 className="relative z-10 text-lg sm:text-xl font-black text-gray-900 mb-2 sm:mb-3">
                    {value.title}
                  </h3>
                  <p className="relative z-10 text-gray-600 text-sm leading-relaxed font-medium">
                    {value.description}
                  </p>
                </div>

                {/* Decorative shadow */}
                <motion.div
                  className={`absolute -z-10 inset-0 bg-gradient-to-br ${value.color} rounded-3xl blur-xl opacity-20`}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity, delay: index * 0.2 }}
                />
              </motion.div>
            );
          })}
        </div>

        {/* Additional highlight */}
        <motion.div
          className="mt-12 sm:mt-16 text-center px-4"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          <div className="inline-block bg-gradient-to-r from-green-50 via-blue-50 to-purple-50 rounded-2xl p-6 sm:p-8 border-2 border-gray-200 shadow-lg">
            <p className="text-xl sm:text-2xl font-black text-gray-900 mb-2">
              💯 100% Fresh, 0% Compromise
            </p>
            <p className="text-sm sm:text-base text-gray-600 font-medium">
              Every ingredient matters. Every bowl counts.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}