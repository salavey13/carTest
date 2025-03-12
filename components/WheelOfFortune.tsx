"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { useTelegram } from "@/hooks/useTelegram"
import { supabaseAdmin } from "@/hooks/supabase"
import { notifyWinners } from "@/app/actions"
import { toast } from "sonner"
import { Loader2, Trophy, RotateCw } from "lucide-react"

interface WheelSegment {
  value: number
  color: string
}

export default function WheelOfFortune() {
  const { dbUser, isLoading, isAdmin } = useTelegram()
  const [isSpinning, setIsSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null)
  const [userNumber, setUserNumber] = useState<number | null>(null)
  const [winners, setWinners] = useState<any[]>([])
  const [isLoadingWinners, setIsLoadingWinners] = useState(false)
  const [manualWinningNumber, setManualWinningNumber] = useState("")
  const wheelRef = useRef<HTMLDivElement>(null)

  // Generate unique numbers for segments
  const generateUniqueNumbers = (count: number, max: number) => {
    const numbers = new Set<number>()
    while (numbers.size < count) {
      numbers.add(Math.floor(Math.random() * max) + 1)
    }
    return Array.from(numbers)
  }

  // Create wheel segments with unique numbers
  const uniqueNumbers = generateUniqueNumbers(20, 999)
  const segments: WheelSegment[] = uniqueNumbers.map((value, i) => ({
    value,
    color: getWheelColor(i, 20),
  }))

  // Load user's previously selected number
  useEffect(() => {
    if (dbUser && !isLoading) {
      const metadata = dbUser.metadata as any
      if (metadata?.wheelNumber) {
        setUserNumber(metadata.wheelNumber)
      }
    }
  }, [dbUser, isLoading])

  // Generate gradient colors for segments
  function getWheelColor(index: number, total: number) {
    const hue = (index / total) * 360
    return `linear-gradient(135deg, hsl(${hue}, 70%, 60%), hsl(${hue}, 70%, 40%))`
  }

  // Spin the wheel logic
  const spinWheel = async () => {
    if (isSpinning || !dbUser) return

    setIsSpinning(true)
    const spinDegrees = 1800 + Math.random() * 360
    setRotation(rotation + spinDegrees)

    setTimeout(async () => {
      const segmentAngle = 360 / segments.length
      const normalizedRotation = (rotation + spinDegrees) % 360
      const segmentIndex = Math.floor(normalizedRotation / segmentAngle)
      const selectedSegment = segments[segments.length - 1 - (segmentIndex % segments.length)] // Adjusted for correct segment selection

      setSelectedNumber(selectedSegment.value)
      setUserNumber(selectedSegment.value)

      try {
        const currentMetadata = dbUser.metadata || {}
        const updatedMetadata = {
          ...currentMetadata,
          wheelNumber: selectedSegment.value,
        }

        const { error } = await supabaseAdmin
          .from("users")
          .update({ metadata: updatedMetadata })
          .eq("user_id", dbUser.user_id)

        if (error) throw error
        toast.success(`Your lucky number: ${selectedSegment.value}!`)
      } catch (error) {
        console.error("Error saving number:", error)
        toast.error("Failed to save number. Try again.")
      }

      setIsSpinning(false)
    }, 5000)
  }

  // Find winners (admin only)
  const findWinners = async () => {
    if (!isAdmin()) return

    setIsLoadingWinners(true)

    try {
      const winningNumber = manualWinningNumber ? Number.parseInt(manualWinningNumber) : selectedNumber

      if (!winningNumber) {
        toast.error("Spin the wheel first or enter a winning number")
        setIsLoadingWinners(false)
        return
      }

      const { data, error } = await supabaseAdmin
        .from("users")
        .select("*")
        .filter("metadata->wheelNumber", "eq", winningNumber)

      if (error) throw error

      setWinners(data || [])

      if (data?.length > 0) {
        await notifyWinners(winningNumber, data)
        toast.success(`Found and notified ${data.length} winners!`)
      } else {
        toast.info("No winners found with this number")
      }
    } catch (error) {
      console.error("Error finding winners:", error)
      toast.error("Failed to find winners. Try again.")
    }

    setIsLoadingWinners(false)
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-blue-900 mt-6">
        <Loader2 className="w-12 h-12 animate-spin text-yellow-400" />
      </div>
    )
  }

  // Authorization check
  if (!dbUser) {
    return (
      <div className="text-center p-8 bg-blue-800 text-white rounded-lg mt-6">
        <h2 className="text-2xl font-bold mb-4">Please Log In</h2>
        <p>You need to log in to use the Wheel of Fortune.</p>
      </div>
    )
  }

  // Main component render
  return (
    <div className="container mx-auto p-4 bg-blue-900 min-h-screen text-white mt-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">Wheel of Fortune</h1>
        <p className="text-lg text-blue-200">Spin the wheel to find your lucky number!</p>

        {userNumber && (
          <div className="mt-4 p-3 bg-blue-800 rounded-lg inline-block">
            <p className="text-lg">
              Your current number: <span className="font-bold text-2xl text-yellow-400">{userNumber}</span>
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-16 items-center justify-center">
        {/* Wheel Section */}
        <div className="relative max-w-md w-full aspect-square">
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            animate={isSpinning ? { y: [0, -10, 0] } : {}}
            transition={{ duration: 0.5, repeat: isSpinning ? Infinity : 0 }}
          >
            <div className="w-4 h-16 bg-yellow-400 z-10 -mt-16 rounded-b-lg" />
          </motion.div>

          <motion.div
            ref={wheelRef}
            className="w-full h-full rounded-full overflow-hidden border-8 border-blue-700 relative"
            animate={{ rotate: rotation }}
            transition={{ duration: 5, ease: "easeOut" }}
          >
            {segments.map((segment, index) => {
              const angle = 360 / segments.length
              const rotation = index * angle

              return (
                <div
                  key={index}
                  className="absolute w-full h-full"
                  style={{
                    background: segment.color,
                    clipPath: `polygon(50% 50%, 100% 0%, 100% ${100 * Math.tan((angle * Math.PI) / 360)}%)`,
                    transform: `rotate(${rotation}deg)`,
                    transformOrigin: "50% 50%",
                  }}
                >
                  <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white font-bold text-xl"
                    style={{
                      transform: `translateY(-60%) rotate(${-rotation}deg)`,
                      textShadow: "0 0 4px rgba(0, 0, 0, 0.5)",
                    }}
                  >
                    {segment.value}
                  </div>
                </div>
              )
            })}
          </motion.div>

          <button
            onClick={spinWheel}
            disabled={isSpinning}
            className={`mt-8 px-6 py-3 bg-yellow-400 text-blue-900 rounded-full font-bold text-lg flex items-center justify-center gap-2 mx-auto ${
              isSpinning ? "opacity-50 cursor-not-allowed" : "hover:bg-yellow-300"
            }`}
          >
            {isSpinning ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Spinning...
              </>
            ) : (
              <>
                <RotateCw className="w-5 h-5" />
                Spin the Wheel
              </>
            )}
          </button>
        </div>

        {/* Admin Section */}
        {isAdmin() && (
          <div className="bg-blue-800 p-6 rounded-lg w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-400" />
              Admin Panel
            </h2>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1 text-blue-100">Winning Number (Optional)</label>
              <input
                type="number"
                min="1"
                max="999"
                value={manualWinningNumber}
                onChange={(e) => setManualWinningNumber(e.target.value)}
                className="w-full p-2 border border-blue-600 bg-blue-900 text-white rounded-md placeholder-blue-300"
                placeholder="Enter number (1-999)"
              />
            </div>

            <button
              onClick={findWinners}
              disabled={isLoadingWinners}
              className={`w-full py-3 bg-yellow-400 text-blue-900 rounded-md font-bold flex items-center justify-center gap-2 ${
                isLoadingWinners ? "opacity-50 cursor-not-allowed" : "hover:bg-yellow-300"
              }`}
            >
              {isLoadingWinners ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Finding Winners...
                </>
              ) : (
                "Find and Notify Winners"
              )}
            </button>

            {winners.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">Winners ({winners.length})</h3>
                <div className="max-h-60 overflow-y-auto bg-blue-900 rounded-md p-2">
                  {winners.map((winner) => (
                    <div key={winner.user_id} className="p-2 border-b border-blue-700 last:border-b-0">
                      <p className="font-medium">{winner.full_name || winner.username || winner.user_id}</p>
                      <p className="text-sm text-blue-300">ID: {winner.user_id}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
