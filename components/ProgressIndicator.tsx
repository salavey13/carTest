"use client"
import { motion, useTransform } from "framer-motion"

interface ProgressIndicatorProps {
  current: number
  total: number
  answered: number[]
  mode: "question" | "preview"
  modeProgress: number
}

export const ProgressIndicator = ({ current, total, answered, mode, modeProgress }: ProgressIndicatorProps) => {
  const opacity = useTransform(modeProgress, [0, 0.3], [1, 0])
  const y = useTransform(modeProgress, [0, 1], [0, -50])
  const scale = useTransform(modeProgress, [0, 1], [1, 0.8])

  return (
    <motion.div style={{ opacity, y, scale }} className="flex justify-center gap-3 mb-6 origin-top">
      {Array.from({ length: total }).map((_, index) => (
        <motion.div
          key={index}
          className={`relative w-3 h-3 rounded-full ${
            answered.includes(index) ? "bg-primary" : "bg-muted"
          }`}
          animate={{
            scale: index === current ? 1.3 : 1,
            y: index === current ? -3 : 0,
            transition: { type: "spring", stiffness: 500 },
          }}
        >
          {/* Border for Current Question */}
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-primary"
            initial={{ scale: 0 }}
            animate={{
              scale: index === current ? 1 : 0,
              opacity: 1 - modeProgress,
            }}
            transition={{ type: "spring", bounce: 0.5 }}
          />
          {/* Preview Mode Background */}
          <motion.div
            className="absolute inset-0 bg-primary rounded-full"
            animate={{
              scale: mode === "preview" ? 1.5 : 0,
              opacity: mode === "preview" ? 0.3 : 0,
            }}
            transition={{ duration: 0.3 }}
          />
          {/* Pulse Effect for Current Question */}
          {index === current && (
            <motion.div
              className="absolute inset-0 rounded-full bg-primary animate-ping"
              style={{ opacity: 0.5 }}
            />
          )}
        </motion.div>
      ))}
    </motion.div>
  )
}

