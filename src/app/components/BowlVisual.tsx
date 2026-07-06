import { motion } from 'motion/react';

interface BowlVisualProps {
  size?: 'small' | 'medium' | 'large';
  ingredients?: {
    base?: boolean;
    protein?: boolean;
    veggies?: boolean;
    beans?: boolean;
    gravy?: boolean;
  };
  className?: string;
  animated?: boolean;
}

export function BowlVisual({ 
  size = 'medium', 
  ingredients = { base: true, protein: true, veggies: true, beans: true, gravy: true },
  className = '',
  animated = true
}: BowlVisualProps) {
  const sizeClasses = {
    small: 'w-32 h-32',
    medium: 'w-48 h-48',
    large: 'w-64 h-64'
  };

  const MotionDiv = animated ? motion.div : 'div';
  const animationProps = animated ? {
    animate: { 
      y: [0, -10, 0],
      rotate: [0, 2, 0, -2, 0]
    },
    transition: { 
      duration: 4,
      repeat: Infinity,
      ease: "easeInOut"
    }
  } : {};

  return (
    <MotionDiv 
      className={`relative ${sizeClasses[size]} ${className}`}
      {...animationProps}
    >
      {/* Bowl Container */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 shadow-2xl border-4 border-white">
        {/* Inner Bowl Shadow */}
        <div className="absolute inset-2 rounded-full bg-gradient-to-b from-transparent to-black/5"></div>
        
        {/* Ingredients Layers */}
        <div className="absolute inset-0 rounded-full overflow-hidden p-4">
          {/* Base Layer (Rice/Wrap) - Bottom */}
          {ingredients.base && (
            <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-amber-100 to-yellow-50 rounded-b-full"></div>
          )}
          
          {/* Beans Layer */}
          {ingredients.beans && (
            <div className="absolute bottom-[25%] left-0 right-0 h-[15%] flex items-center justify-around px-4">
              <div className="w-3 h-3 rounded-full bg-red-800"></div>
              <div className="w-2 h-2 rounded-full bg-amber-700"></div>
              <div className="w-3 h-3 rounded-full bg-red-900"></div>
              <div className="w-2 h-2 rounded-full bg-amber-800"></div>
            </div>
          )}
          
          {/* Protein Layer */}
          {ingredients.protein && (
            <div className="absolute bottom-[40%] left-0 right-0 h-[20%] flex items-center justify-around px-4">
              <div className="w-4 h-4 rounded bg-orange-600 rotate-12"></div>
              <div className="w-5 h-4 rounded bg-orange-700 -rotate-6"></div>
              <div className="w-4 h-4 rounded bg-red-700 rotate-45"></div>
            </div>
          )}
          
          {/* Veggies Layer */}
          {ingredients.veggies && (
            <div className="absolute bottom-[60%] left-0 right-0 h-[25%] flex flex-wrap items-center justify-around px-3 gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-2 h-2 rounded-full bg-purple-400"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div className="w-2 h-2 rounded-full bg-green-600"></div>
            </div>
          )}
          
          {/* Gravy/Sauce Top Layer */}
          {ingredients.gravy && (
            <div className="absolute top-0 left-0 right-0 h-[20%] bg-gradient-to-b from-orange-500/60 to-transparent rounded-t-full"></div>
          )}
        </div>
      </div>
      
      {/* Bowl Rim Highlight */}
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-[90%] h-3 bg-gradient-to-b from-white/80 to-transparent rounded-full blur-sm"></div>
    </MotionDiv>
  );
}
