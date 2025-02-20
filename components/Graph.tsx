"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface GraphProps {
  currentQuestion: {
    id: number
    text: string
  }
  answers: {
    id: number
    text: string
  }[]
  onSelect: (answer: { id: number; text: string }) => Promise<void>
}

export const Graph: React.FC<GraphProps> = ({ currentQuestion, answers, onSelect }) => {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setSelectedAnswer(null)
    setIsLoading(false)
  }, [currentQuestion])

  const handleSelect = async (answer: { id: number; text: string }) => {
    setSelectedAnswer(answer.id)
    setIsLoading(true)
    try {
      await onSelect(answer)
    } catch (error) {
      console.error("Error selecting answer:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const isTwoAnswers = answers.length === 2

  return (
    <div className="relative h-[60vh] flex items-center justify-center">
      {/* Question Circle */}
      <AnimatePresence>
        {!selectedAnswer && (
          <motion.div
            key={`question-${currentQuestion.id}`}
            className="absolute w-[25vw] max-w-[200px] h-[25vw] max-h-[200px]  min-h-[100px] min-w-[100px] bg-gradient-to-br from-primary to-secondary text-primary-foreground border border-border rounded-full flex items-center justify-center font-bold text-lg shadow-lg text-center p-4"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0, y: -50 }}
            transition={{ duration: 0.5 }}
          >
            {currentQuestion.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Answer Circles */}
      <AnimatePresence>
        {!selectedAnswer &&
          answers.map((answer, index) => {
            const colorClasses = [
              "bg-primary text-primary-foreground hover:bg-primary/90",
              "bg-secondary text-secondary-foreground hover:bg-secondary/90",
              "bg-accent text-accent-foreground hover:bg-accent/90",
              "bg-muted text-foreground hover:bg-muted/90",
            ]

            // Positioning logic
            let x, y
            if (isTwoAnswers) {
              // For two answers: position below question, side-by-side
              x = index === 0 ? -10 : 10 // Closer together
              y = 15 // Below the question
            } else {
              // For more answers: circular arrangement
              const angle = (index / answers.length) * 360
              const radius = 25 // vw
              x = radius * Math.cos((angle * Math.PI) / 180)
              y = radius * Math.sin((angle * Math.PI) / 180)
            }

            return (
              <motion.button
                key={`answer-${answer.id}`}
                className={`absolute w-[18vw] max-w-[150px] h-[18vw] max-h-[150px] min-h-[100px] min-w-[100px] ${colorClasses[index % colorClasses.length]} rounded-full flex items-center justify-center font-semibold text-base shadow-lg cursor-pointer text-center p-3 transition-colors duration-200`}
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  x: `${x}vw`,
                  y: `${y}vw`,
                }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                onClick={() => handleSelect(answer)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                disabled={isLoading}
              >
                {answer.text}
              </motion.button>
            )
          })}
      </AnimatePresence>
    </div>
  )
}

