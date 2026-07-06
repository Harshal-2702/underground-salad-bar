import { motion } from 'motion/react';

export function WhatIsSection() {
  return (
    <section className="py-12 sm:py-16 lg:py-20 xl:py-32 bg-white relative overflow-hidden">
      {/* Large decorative text */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[150px] sm:text-[250px] lg:text-[300px] xl:text-[400px] font-black text-gray-900/5 pointer-events-none whitespace-nowrap hidden sm:block">
        FRESH
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <motion.h2 
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-gray-900 mb-6 sm:mb-8 px-4"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            What Is
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-purple-600 to-red-600 mt-2">
              Underground Salad Bar?
            </span>
          </motion.h2>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="space-y-6 px-4"
          >
            <p className="text-lg sm:text-xl lg:text-2xl text-gray-700 leading-relaxed font-medium max-w-4xl mx-auto">
              We're revolutionizing healthy eating in Pune with a unique{' '}
              <span className="text-blue-700 font-bold">build-your-own bowl</span> concept.
            </p>
            
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 leading-relaxed max-w-3xl mx-auto">
              Inspired by global fast-casual dining but rooted in{' '}
              <span className="text-red-600 font-bold italic">authentic Indian flavors</span>, 
              we offer fresh, nutritious, and completely customizable meals.
            </p>
            
            <motion.div 
              className="pt-8 flex flex-wrap justify-center gap-3 sm:gap-4"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
            >
              {['Fresh', 'Custom', 'Indian', 'Healthy'].map((word, i) => (
                <motion.span
                  key={word}
                  className="px-5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-full text-gray-900 font-bold border-2 border-blue-200 text-sm sm:text-base"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ delay: i * 0.1 }}
                >
                  {word}
                </motion.span>
              ))}
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}