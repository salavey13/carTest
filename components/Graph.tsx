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
  onSelect: (answer: any) => void
}

export const Graph: React.FC<GraphProps> = ({ currentQuestion, answers, onSelect }) => {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setSelectedAnswer(null)
    setIsLoading(false)
  }, [currentQuestion]) 

  const handleSelect = async (answer: any) => {
    setSelectedAnswer(answer.id)
    setIsLoading(true)
    await onSelect(answer)
  }

  return (
    <div className="relative h-[80vh] flex items-center justify-center">
      <motion.div
        key={`question-${currentQuestion.id}`}
        className="absolute w-48 h-48 bg-purple-700 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg text-center p-4"
        initial={{ scale: 0 }}
        animate={{ scale: 1, y: selectedAnswer ? -150 : 0 }}
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
              className={`absolute w-40 h-40 ${
                index % 2 === 0 ? "bg-blue-500" : "bg-green-500"
              } rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg cursor-pointer text-center p-4`}
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

      {selectedAnswer && isLoading && (
        <motion.div
          className="absolute bottom-20 w-48 h-48 bg-gray-300 rounded-full flex items-center justify-center text-gray-700 font-bold text-lg shadow-lg"
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

