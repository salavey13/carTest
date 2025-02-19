"use client"
import { motion, useMotionValue } from "framer-motion"
import type React from "react"

export const AnimatedText = ({
  children,
  mode,
  baseSize = "text-2xl",
  activeSize = "text-4xl",
  delay = 0,
}: {
  children: React.ReactNode
  mode: "question" | "preview"
  baseSize?: string
  activeSize?: string
  delay?: number
}) => {
  const opacity = useMotionValue(0)
  const y = useMotionValue(20)

  return (
    <motion.div
      initial={false}
      animate={{
        opacity: mode === "preview" ? 1 : 0,
        y: mode === "preview" ? 0 : 20,
        scale: mode === "preview" ? 1 : 0.95,
      }}
      transition={{
        type: "spring",
        stiffness: 150,
        damping: 20,
        delay,
      }}
      className={`${mode === "preview" ? activeSize : baseSize} ${
        mode === "preview" ? "text-cyan-400" : "text-gray-400"
      } transition-colors duration-300`}
    >
      {children}
    </motion.div>
  )
}

