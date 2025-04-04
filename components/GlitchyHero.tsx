"use client"

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight } from "lucide-react"

/** VignetteOverlay: Adds a radial gradient overlay for visual effect */
const VignetteOverlay: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background: 'radial-gradient(circle at 50% 69%, transparent 0%, rgba(0, 14, 41, 0.9) 70%, rgba(0, 14, 41, 1) 100%)',
      pointerEvents: 'none',
      zIndex: 5,
    }}
  />
)

/** GlitchyLine: Renders animated glitch lines with dynamic colors */
const GlitchyLine: React.FC<{
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  thickness: number
  delay: number
}> = ({ x1, y1, x2, y2, color, thickness, delay }) => {
  const style: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '200%',
    stroke: color,
    strokeWidth: thickness,
    opacity: 0,
    filter: 'blur(0.5px)',
  }

  return (
    <motion.svg
      style={style}
      initial={{ opacity: 0, pathLength: 0 }}
      animate={{ opacity: [0, 1, 0.5], pathLength: 1 }}
      transition={{
        opacity: { delay, duration: 1, times: [0, 0.1, 1] },
        pathLength: { delay, duration: 1, ease: "easeOut" },
      }}
    >
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
    </motion.svg>
  )
}

/** EdgeHighlight: Applies an edge detection effect to the image */
const EdgeHighlight: React.FC<{ imageUrl: string; foregroundColor: string }> = ({ imageUrl, foregroundColor }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d', { willReadFrequently: true })
    if (!canvas || !ctx) return

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = imageUrl
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const edges = detectEdges(imageData)
      ctx.putImageData(edges, 0, 0)
    }
  }, [imageUrl])

  const detectEdges = (imageData: ImageData) => {
    const { data, width, height } = imageData
    const output = new ImageData(width, height)

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4
        const surrounding = [
          data[idx - width * 4 - 4], data[idx - width * 4], data[idx - width * 4 + 4],
          data[idx - 4], data[idx + 4],
          data[idx + width * 4 - 4], data[idx + width * 4], data[idx + width * 4 + 4],
        ]
        const average = surrounding.reduce((a, b) => a + b) / surrounding.length
        const diff = Math.abs(data[idx] - average)

        if (diff > 20) {
          output.data[idx] = parseInt(foregroundColor.slice(1, 3), 16)
          output.data[idx + 1] = parseInt(foregroundColor.slice(3, 5), 16)
          output.data[idx + 2] = parseInt(foregroundColor.slice(5, 7), 16)
          output.data[idx + 3] = 255
        }
      }
    }

    return output
  }

  return (
    <motion.canvas
      ref={canvasRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1, duration: 4 }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        mixBlendMode: 'screen',
      }}
    />
  )
}

interface GlitchyHeroProps {
  imageUrls: string[]
  heading?: string
  description?: string
  buttonText?: string
  buttonLink?: string
}

/** GlitchyHero: Main component with glitchy animations and interactive elements */
const GlitchyHero: React.FC<GlitchyHeroProps> = ({ imageUrls, heading, description, buttonText, buttonLink }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [gyro, setGyro] = useState({ x: 0, y: 0 })
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const requestRef = useRef<number>()
  const previousTimeRef = useRef<number>()
  const [glitchLines, setGlitchLines] = useState<React.ReactNode[]>([])
  const [easterEggTriggered, setEasterEggTriggered] = useState(false)

  const foregroundColor = '#11e6d0'
  const backgroundColor = '#FFA9F3'

  /** Update window dimensions on mount and resize */
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)

    if (typeof window !== 'undefined') {
      if ('DeviceOrientationEvent' in window) {
        window.addEventListener('deviceorientation', handleOrientation)
      }
      window.addEventListener('mousemove', handleMouseMove)
    }

    return () => {
      window.removeEventListener('resize', updateDimensions)
      if (typeof window !== 'undefined') {
        if ('DeviceOrientationEvent' in window) {
          window.removeEventListener('deviceorientation', handleOrientation)
        }
        window.removeEventListener('mousemove', handleMouseMove)
      }
    }
  }, [])

  const handleOrientation = (event: DeviceOrientationEvent) => {
    const x = event.gamma || 0 // Range: -90 to 90
    const y = event.beta || 0 // Range: -180 to 180
    setGyro({ x: x / 90, y: y / 180 })
  }

  const handleMouseMove = (event: MouseEvent) => {
    setMousePos({
      x: (event.clientX / window.innerWidth) * 2 - 1,
      y: (event.clientY / window.innerHeight) * 2 - 1,
    })
  }

  const animate = useCallback((time: number) => {
    if (previousTimeRef.current !== undefined) {
      setGyro((prevGyro) => ({
        x: prevGyro.x * 0.95 + mousePos.x * 0.05,
        y: prevGyro.y * 0.95 + mousePos.y * 0.05,
      }))
    }
    previousTimeRef.current = time
    requestRef.current = requestAnimationFrame(animate)
  }, [mousePos])

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(requestRef.current!)
  }, [animate])

  /** Generate glitch lines based on window dimensions */
  useEffect(() => {
    const generateGlitchLines = () => {
      const lines: React.ReactNode[] = []
      const numLines = 200
      const centerX = dimensions.width / 2
      const centerY = dimensions.height * 0.69
      const maxRadius = Math.max(dimensions.width, dimensions.height) / 1.5

      for (let i = 0; i < numLines; i++) {
        const angle = Math.random() * Math.PI * 2
        const radius = Math.random() * maxRadius
        const x1 = centerX + Math.cos(angle) * radius
        const y1 = centerY + Math.sin(angle) * radius

        const flipAngle = Math.random() < 0.5 ? Math.PI / 2 : 0
        const endAngle = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2) + flipAngle
        const length = Math.random() * 100 + 50
        const x2 = x1 + Math.cos(endAngle) * length
        const y2 = y1 + Math.sin(endAngle) * length

        const color = Math.random() > 0.5 ? foregroundColor : backgroundColor
        const thickness = Math.random() * 3 + 1
        const delay = Math.pow(i / numLines, 3) * 2

        lines.push(
          <GlitchyLine
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            color={color}
            thickness={thickness}
            delay={delay}
          />
        )
      }

      setGlitchLines(lines)
    }

    if (dimensions.width && dimensions.height) {
      generateGlitchLines()
    }
  }, [dimensions])

  /** Cycle through images every 13 seconds */
  useEffect(() => {
    if (imageUrls.length > 1) {
      const intervalId = setInterval(() => {
        setCurrentImageIndex((prevIndex) => (prevIndex + 1) % imageUrls.length)
      }, 13000)

      return () => clearInterval(intervalId)
    }
  }, [imageUrls])

  const handleTap = () => {
    setEasterEggTriggered(true)
    setTimeout(() => setEasterEggTriggered(false), 3000)
  }

  return (
    <div
      className="relative w-full h-[80vh] mb-8 overflow-visible justify-center"
      onClick={handleTap}
    >
      <VignetteOverlay />
      <motion.div
        className="absolute inset-0"
        animate={{
          x: gyro.x * 20,
          y: gyro.y * 20,
          rotate: gyro.x * 2,
        }}
        transition={{ type: 'spring', stiffness: 100, damping: 10 }}
      >
        {glitchLines}
      </motion.div>
      <div className="relative flex flex-col items-center justify-center h-full text-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 1 }}
          className="relative w-[95%] max-w-2xl mx-auto"
        >
          <motion.img
            key={currentImageIndex}
            src={imageUrls[currentImageIndex]}
            initial={{ opacity: 0 }}
            className="w-full h-auto"
            animate={{
              opacity: 1,
              y: [0, -5, 0],
              transition: {
                duration: 7,
                repeat: Infinity,
                ease: "easeInOut",
              },
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 13 }}
            alt={`Slide ${currentImageIndex}`}
          />
          <EdgeHighlight imageUrl={imageUrls[currentImageIndex]} foregroundColor={foregroundColor} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.8 }}
          className="relative flex flex-col items-center justify-center"
        >
          {heading && (
            <h1 className="text-4xl md:text-6xl font-bold mb-4 text-center">
              {heading}
            </h1>
          )}
          {description && (
            <p className="text-xl md:text-2xl mb-8 text-center max-w-2xl">
              {description}
            </p>
          )}
          {buttonText && buttonLink && (
            <a
              href={buttonLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-100 px-8 py-3 rounded-lg text-lg mb-8 mr-2 ml-2 font-semibold hover:bg-opacity-90 hover:text-grey-100 transition-colors"
            >
              {buttonText} <ArrowRight className="inline-block ml-2" />
            </a>
          )}
        </motion.div>
      </div>
      {easterEggTriggered && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center"
        >
          <div className="text-white text-4xl font-bold">SALAVEY13</div>
        </motion.div>
      )}
    </div>
  )
}

export default GlitchyHero