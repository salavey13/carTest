"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LoadingProps {
  variant?: "bike" | "generic" | "system" | "kinetic";
  text?: string;
  className?: string;
  compact?: boolean;
}

const LOADER_GIF_URL =
  "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/Loader-S1000RR-8cb0319b-acf7-4ed9-bfd2-97b4b3e2c6fc.gif";

// Option 4: invert(1) grayscale(0.5) sepia(0.8) saturate(3) contrast(2)
const bikeGoldFilter = "invert(1) grayscale(0.5) sepia(0.8) saturate(3) contrast(2)";

export function Loading({ text, className, compact = false }: LoadingProps) {
  // Compact mode - small spinner for inline loading
  if (compact) {
    return (
      <div className={cn("flex items-center justify-center gap-2 py-4", className)}>
        <motion.div
          className="h-5 w-5 rounded-full border-2 border-t-transparent"
          style={{ borderColor: "#D4AF37", borderTopColor: "transparent" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        {text && (
          <p className="text-xs text-muted-foreground">{text}</p>
        )}
      </div>
    );
  }

  // Full page loading
  return (
    <div
      className={cn(
        "min-h-screen flex items-center justify-center overflow-hidden bg-black px-6",
        className,
      )}
    >
      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* S1000RR GIF with option 4 filter */}
        <img
          src={LOADER_GIF_URL}
          alt="Загрузка..."
          className="h-28 w-28 object-contain [image-rendering:auto]"
          style={{ filter: bikeGoldFilter }}
        />

        {/* Text */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center space-y-2"
        >
          <p
            className="text-sm font-medium tracking-wider"
            style={{ color: "#D4AF37" }}
          >
            {text || "Загружаем байки..."}
          </p>

          {/* Progress indicator */}
          <div className="flex items-center gap-2 justify-center">
            <motion.span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: "#D4AF37" }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <motion.span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: "#D4AF37" }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
            />
            <motion.span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: "#D4AF37" }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
