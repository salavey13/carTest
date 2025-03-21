// /components/ProgressIndicator.tsx
"use client";
import { motion, useTransform } from "framer-motion";

interface ProgressIndicatorProps {
  current: number;
  total: number;
  answered: number[];
  mode: "question" | "preview";
  modeProgress: number;
}

export const ProgressIndicator = ({ current, total, answered, mode, modeProgress }: ProgressIndicatorProps) => {
  const opacity = useTransform(modeProgress, [0, 0.3], [1, 0]);
  const y = useTransform(modeProgress, [0, 1], [0, -50]);
  const scale = useTransform(modeProgress, [0, 1], [1, 0.8]);

  return (
    <motion.div
      style={{ opacity, y, scale }}
      className="flex justify-center gap-4 mb-8 bg-popover p-4 rounded-xl shadow-inner border border-muted max-w-xl mx-auto"
    >
      {Array.from({ length: total }).map((_, index) => (
        <motion.div
          key={index}
          className={`relative w-4 h-4 rounded-full ${answered.includes(index) ? "bg-primary" : "bg-muted"} shadow-[0_0_10px_rgba(255,107,107,0.3)]`}
          animate={{
            scale: index === current ? 1.5 : 1,
            y: index === current ? -4 : 0,
            transition: { type: "spring", stiffness: 500 },
          }}
        >
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-primary shadow-[0_0_15px_rgba(255,107,107,0.5)]"
            initial={{ scale: 0 }}
            animate={{ scale: index === current ? 1.2 : 0, opacity: 1 - modeProgress }}
            transition={{ type: "spring", bounce: 0.5 }}
          />
          <motion.div
            className="absolute inset-0 bg-primary rounded-full opacity-30"
            animate={{ scale: mode === "preview" ? 1.8 : 0 }}
            transition={{ duration: 0.3 }}
          />
          {index === current && (
            <motion.div
              className="absolute inset-0 rounded-full bg-primary animate-ping opacity-50"
            />
          )}
        </motion.div>
      ))}
    </motion.div>
  );
};

