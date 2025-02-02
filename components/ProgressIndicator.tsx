// components/ProgressIndicator.tsx
'use client';
import { motion, useMotionValue, useTransform } from 'framer-motion';

interface ProgressIndicatorProps {
  current: number;
  total: number;
  answered: number[];
  mode: 'question' | 'preview';
  modeProgress: number; // 0-1 value from Graph's mode transition
}

export const ProgressIndicator = ({
  current,
  total,
  answered,
  mode,
  modeProgress
}: ProgressIndicatorProps) => {
  const opacity = useTransform(modeProgress, [0, 0.3], [1, 0]);
  const y = useTransform(modeProgress, [0, 1], [0, -50]);
  const scale = useTransform(modeProgress, [0, 1], [1, 0.8]);

  return (
    <motion.div
      style={{ opacity, y, scale }}
      className="flex justify-center gap-3 mb-6 origin-top"
    >
      {Array.from({ length: total }).map((_, index) => (
        <motion.div
          key={index}
          className={`w-3 h-3 rounded-full relative ${
            answered.includes(index) ? 'bg-cyan-500' : 'bg-gray-700'
          }`}
          animate={{
            scale: index === current ? 1.3 : 1,
            y: index === current ? -3 : 0,
            transition: { type: 'spring', stiffness: 500 }
          }}
        >
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-cyan-400"
            initial={{ scale: 0 }}
            animate={{ 
              scale: index === current ? 1 : 0,
              opacity: 1 - modeProgress
            }}
            transition={{ type: 'spring', bounce: 0.5 }}
          />
          <motion.div
            className="absolute inset-0 bg-cyan-400 rounded-full"
            animate={{
              scale: mode === 'preview' ? 1.5 : 0,
              opacity: mode === 'preview' ? 0.3 : 0
            }}
            transition={{ duration: 0.3 }}
          />
        </motion.div>
      ))}
    </motion.div>
  );
};

