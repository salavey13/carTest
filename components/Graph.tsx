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

  // Reset state when the question changes
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

  // Colors for answers to provide better distinction
  const answerColors = ["bg-primary", "bg-secondary", "bg-accent", "bg-highlight"]

  return (
    <div className="relative h-[42vh] flex items-center justify-center">
      <motion.div
        key={`question-${currentQuestion.id}`}
        className="absolute w-48 h-48 bg-background text-foreground border-2 border-primary rounded-full flex items-center justify-center font-bold text-lg shadow-lg text-center p-4"
        initial={{ scale: 0 }}
        animate={{ scale: 1, y: selectedAnswer !== null ? -150 : 0 }}
        exit={{ scale: 0 }}
        transition={{ duration: 0.5 }}
      >
        {currentQuestion.text}
      </motion.div>

      <AnimatePresence>
        {!selectedAnswer &&
          answers.map((answer, index) => (
            <motion.div
              key={`answer-${answer.id}`}
              className={`absolute w-40 h-40 ${answerColors[index % answerColors.length]} text-background rounded-full flex items-center justify-center font-bold text-sm shadow-lg cursor-pointer text-center p-4`}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: 1,
                scale: 1,
                x: index === 0 ? -120 : 120,
                y: 150,
              }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
              onClick={() => handleSelect(answer)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              {answer.text}
            </motion.div>
          ))}
      </AnimatePresence>

      {isLoading && (
        <motion.div
          className="absolute bottom-20 w-48 h-48 bg-background text-foreground border-2 border-primary rounded-full flex items-center justify-center font-bold text-lg shadow-lg"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0 }}
        >
          Loading...
        </motion.div>
      )}
    </div>
  )
}

