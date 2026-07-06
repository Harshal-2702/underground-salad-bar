import { motion } from 'motion/react';

interface RealisticBowlProps {
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  ingredients?: {
    base?: boolean;
    protein?: boolean;
    veggies?: boolean;
    beans?: boolean;
    gravy?: boolean;
  };
  className?: string;
  animated?: boolean;
  tilt?: number;
}

export function RealisticBowl({ 
  size = 'medium', 
  ingredients = { base: true, protein: true, veggies: true, beans: true, gravy: true },
  className = '',
  animated = true,
  tilt = 0
}: RealisticBowlProps) {
  const sizeClasses = {
    small: 'w-40 h-40',
    medium: 'w-56 h-56',
    large: 'w-72 h-72',
    xlarge: 'w-96 h-96'
  };

  const MotionDiv = animated ? motion.div : 'div';
  const animationProps = animated ? {
    animate: { 
      y: [0, -8, 0],
      rotate: [tilt, tilt + 1, tilt, tilt - 1, tilt]
    },
    transition: { 
      duration: 5,
      repeat: Infinity,
      ease: "easeInOut"
    }
  } : {};

  return (
    <MotionDiv 
      className={`relative ${sizeClasses[size]} ${className}`}
      style={{ transform: `rotate(${tilt}deg)` }}
      {...animationProps}
    >
      {/* Bowl Container with realistic depth */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Bowl shadow */}
        <div className="absolute inset-0 bg-black/20 blur-2xl transform translate-y-8 scale-90 rounded-full"></div>
        
        {/* Main Bowl */}
        <div className="relative w-full h-full">
          {/* Bowl exterior - ceramic white with subtle gradient */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gray-50 via-white to-gray-100 shadow-2xl border-8 border-white" 
               style={{ 
                 boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), inset 0 2px 4px rgba(0, 0, 0, 0.06)'
               }}>
            
            {/* Bowl inner shadow - creates depth */}
            <div className="absolute inset-0 rounded-full overflow-hidden">
              <div className="absolute inset-0 rounded-full bg-gradient-to-b from-transparent via-transparent to-black/10"></div>
              <div className="absolute inset-3 rounded-full bg-gradient-to-b from-black/5 to-transparent"></div>
            </div>
            
            {/* Ingredients Container - with perspective */}
            <div className="absolute inset-6 rounded-full overflow-hidden">
              {/* Base Layer (Rice/Grains) - Bottom foundation */}
              {ingredients.base && (
                <motion.div 
                  className="absolute bottom-0 left-0 right-0 h-[28%] rounded-b-full overflow-hidden"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.6 }}
                >
                  {/* Rice texture with realistic grains */}
                  <div className="absolute inset-0 bg-gradient-to-t from-amber-100 via-yellow-50 to-amber-50"></div>
                  {/* Grain details */}
                  <div className="absolute inset-0 opacity-60">
                    {[...Array(40)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute w-1 h-1.5 bg-white/80 rounded-full"
                        style={{
                          left: `${Math.random() * 100}%`,
                          top: `${Math.random() * 100}%`,
                          transform: `rotate(${Math.random() * 360}deg)`
                        }}
                      />
                    ))}
                  </div>
                  {/* Highlight on rice */}
                  <div className="absolute top-0 left-0 right-0 h-[30%] bg-gradient-to-b from-white/40 to-transparent"></div>
                </motion.div>
              )}
              
              {/* Beans Layer - Textured and dimensional */}
              {ingredients.beans && (
                <motion.div 
                  className="absolute bottom-[28%] left-0 right-0 h-[18%] flex items-center justify-around px-6"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  {/* Kidney beans - realistic with shine */}
                  {[...Array(8)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="relative"
                      animate={{ 
                        y: [0, -2, 0],
                        rotate: [0, 5, 0]
                      }}
                      transition={{ 
                        duration: 3, 
                        repeat: Infinity, 
                        delay: i * 0.2 
                      }}
                    >
                      <div 
                        className="w-3 h-4 rounded-full bg-gradient-to-br from-red-900 via-red-800 to-red-950 shadow-lg"
                        style={{
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3), inset -1px -1px 2px rgba(0,0,0,0.2), inset 1px 1px 1px rgba(255,255,255,0.3)'
                        }}
                      >
                        {/* Bean highlight */}
                        <div className="absolute top-0 left-1 w-1 h-1.5 bg-white/40 rounded-full blur-[0.5px]"></div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
              
              {/* Protein Layer - Chicken/Paneer chunks with texture */}
              {ingredients.protein && (
                <motion.div 
                  className="absolute bottom-[46%] left-0 right-0 h-[22%] flex items-center justify-around px-5"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  {/* Protein pieces */}
                  {[...Array(6)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="relative"
                      animate={{ 
                        y: [0, -3, 0],
                        rotate: [0, 8, 0, -5, 0]
                      }}
                      transition={{ 
                        duration: 4, 
                        repeat: Infinity, 
                        delay: i * 0.3 
                      }}
                    >
                      <div 
                        className={`w-5 h-5 rounded-md bg-gradient-to-br shadow-xl ${
                          i % 2 === 0 
                            ? 'from-orange-500 via-orange-600 to-orange-700' 
                            : 'from-red-600 via-red-700 to-red-800'
                        }`}
                        style={{
                          transform: `rotate(${i * 15}deg)`,
                          boxShadow: '0 3px 6px rgba(0,0,0,0.4), inset -1px -1px 2px rgba(0,0,0,0.3), inset 1px 1px 2px rgba(255,255,255,0.2)'
                        }}
                      >
                        {/* Protein shine */}
                        <div className="absolute top-0.5 left-0.5 w-2 h-2 bg-white/30 rounded-sm blur-[0.5px]"></div>
                        {/* Texture marks */}
                        <div className="absolute inset-0 opacity-30">
                          <div className="absolute top-1 left-1 w-2 h-0.5 bg-black/20"></div>
                          <div className="absolute bottom-1 right-1 w-1.5 h-0.5 bg-black/20"></div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
              
              {/* Veggies Layer - Colorful and fresh with variety */}
              {ingredients.veggies && (
                <motion.div 
                  className="absolute bottom-[68%] left-0 right-0 h-[22%] flex flex-wrap items-center justify-around px-4 gap-1"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                >
                  {/* Assorted veggie pieces */}
                  {[
                    { color: 'from-green-400 via-green-500 to-green-600', size: 'w-4 h-4' }, // Broccoli
                    { color: 'from-orange-400 via-orange-500 to-orange-600', size: 'w-3 h-3' }, // Carrot
                    { color: 'from-red-400 via-red-500 to-red-600', size: 'w-4 h-3' }, // Bell pepper
                    { color: 'from-purple-400 via-purple-500 to-purple-600', size: 'w-3 h-3' }, // Onion
                    { color: 'from-yellow-300 via-yellow-400 to-yellow-500', size: 'w-2 h-2' }, // Corn
                    { color: 'from-green-500 via-green-600 to-green-700', size: 'w-3 h-4' }, // Lettuce
                    { color: 'from-pink-400 via-red-400 to-red-500', size: 'w-3 h-3' }, // Beetroot
                    { color: 'from-lime-400 via-green-400 to-green-500', size: 'w-2 h-3' }, // More greens
                  ].map((veggie, i) => (
                    <motion.div
                      key={i}
                      className="relative"
                      animate={{ 
                        y: [0, -2, 0],
                        rotate: [0, 10, 0, -8, 0],
                        scale: [1, 1.05, 1]
                      }}
                      transition={{ 
                        duration: 3.5, 
                        repeat: Infinity, 
                        delay: i * 0.2 
                      }}
                    >
                      <div 
                        className={`${veggie.size} rounded-full bg-gradient-to-br ${veggie.color} shadow-lg`}
                        style={{
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3), inset -1px -1px 2px rgba(0,0,0,0.2), inset 1px 1px 1px rgba(255,255,255,0.4)'
                        }}
                      >
                        {/* Fresh veggie shine */}
                        <div className="absolute top-0 left-0.5 w-1.5 h-1.5 bg-white/50 rounded-full blur-[0.5px]"></div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
              
              {/* Gravy/Sauce Top Layer - Glossy and flowing */}
              {ingredients.gravy && (
                <motion.div 
                  className="absolute top-0 left-0 right-0 h-[25%] rounded-t-full overflow-hidden"
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                >
                  {/* Gravy base - rich Indian curry color */}
                  <div className="absolute inset-0 bg-gradient-to-b from-orange-600 via-orange-500 to-orange-400/80"></div>
                  
                  {/* Gravy shine - makes it look glossy and fresh */}
                  <div className="absolute top-0 left-0 right-0 h-[40%] bg-gradient-to-b from-white/30 via-white/10 to-transparent rounded-t-full"></div>
                  
                  {/* Gravy texture with spices */}
                  <div className="absolute inset-0 opacity-40">
                    {[...Array(15)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-0.5 h-0.5 bg-red-800 rounded-full"
                        style={{
                          left: `${Math.random() * 100}%`,
                          top: `${Math.random() * 100}%`,
                        }}
                        animate={{ 
                          opacity: [0.3, 0.6, 0.3],
                          scale: [1, 1.2, 1]
                        }}
                        transition={{ 
                          duration: 2, 
                          repeat: Infinity, 
                          delay: i * 0.1 
                        }}
                      />
                    ))}
                  </div>
                  
                  {/* Flowing gravy effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-transparent via-orange-400/30 to-transparent"
                    animate={{ 
                      x: [-10, 10, -10],
                      opacity: [0.3, 0.5, 0.3]
                    }}
                    transition={{ 
                      duration: 4, 
                      repeat: Infinity 
                    }}
                  />
                </motion.div>
              )}
            </div>
            
            {/* Bowl rim highlight - ceramic shine */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-[85%] h-4 bg-gradient-to-b from-white/90 via-white/60 to-transparent rounded-full blur-sm"></div>
            
            {/* Bowl rim top edge */}
            <div className="absolute top-0 inset-x-0 h-2 rounded-full bg-gradient-to-b from-white to-gray-50"></div>
          </div>
        </div>
      </div>
      
      {/* Steam effect for hot food */}
      {(ingredients.gravy || ingredients.protein) && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 pointer-events-none">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-8 h-12 bg-gradient-to-t from-gray-400/20 to-transparent rounded-full blur-md"
              animate={{
                y: [-10, -40],
                x: [0, (i - 1) * 5],
                opacity: [0.3, 0],
                scale: [0.8, 1.2]
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                delay: i * 0.8,
                ease: "easeOut"
              }}
              style={{ left: `${i * 10}px` }}
            />
          ))}
        </div>
      )}
    </MotionDiv>
  );
}
