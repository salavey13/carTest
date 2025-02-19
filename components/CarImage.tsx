"use client"
import { motion, useTransform } from "framer-motion"
import Image from "next/image"

export const CarImage = ({ src, alt, progress }: { src: string; alt: string; progress: number }) => {
  const scale = useTransform(progress, [0, 1], [0.95, 1.05])
  const blur = useTransform(progress, [0, 0.5, 1], [8, 4, 0])
  const shadow = useTransform(progress, [0, 1], ["0px 0px 0px rgba(34,211,238,0)", "0px 8px 24px rgba(34,211,238,0.3)"])

  return (
    <motion.div
      style={{
        scale,
        filter: blur.to((v) => `blur(${v}px) saturate(${100 + v * 15}%)`),
        boxShadow: shadow,
      }}
      className="relative w-full aspect-video rounded-2xl overflow-hidden"
    >
      <Image src={src} alt={alt} fill className="object-cover" priority sizes="(max-width: 768px) 100vw, 50vw" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
    </motion.div>
  )
}

