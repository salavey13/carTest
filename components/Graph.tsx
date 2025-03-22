// /components/Graph.tsx
"use client";
import type React from "react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface GraphProps {
  currentQuestion: { id: number; text: string };
  answers: { id: number; text: string }[];
  onSelect: (answer: { id: number; text: string }) => Promise<void>;
}

export const Graph: React.FC<GraphProps> = ({ currentQuestion, answers, onSelect }) => {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setSelectedAnswer(null);
    setIsLoading(false);
  }, [currentQuestion]);

  const handleSelect = async (answer: { id: number; text: string }) => {
    setSelectedAnswer(answer.id);
    setIsLoading(true);
    try {
      await onSelect(answer);
    } catch (error) {
      console.error("Ошибка выбора:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isTwoAnswers = answers.length === 2;

  return (
    <div className="relative min-h-[60vh] flex flex-col items-center justify-center gap-12 py-8">
      {/* Question as H1 */}
      <AnimatePresence>
        {!selectedAnswer && (
          <motion.h1
            key={`question-${currentQuestion.id}`}
            className="text-3xl md:text-4xl font-bold text-gradient cyber-text glitch px-6 py-4 bg-card rounded-xl shadow-[0_0_20px_rgba(255,107,107,0.5)] border border-muted text-center max-w-3xl"
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -50 }}
            transition={{ duration: 0.6 }}
            data-text={currentQuestion.text}
          >
            {currentQuestion.text}
          </motion.h1>
        )}
      </AnimatePresence>

      {/* Answer Nodes */}
      <AnimatePresence>
        {!selectedAnswer && (
          <div className={`flex ${isTwoAnswers ? "flex-row gap-8" : "flex-wrap gap-6 justify-center"} w-full max-w-4xl px-4`}>
            {answers.map((answer, index) => {
              const colors = [
                "bg-primary text-primary-foreground hover:bg-primary/80",
                "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                "bg-accent text-accent-foreground hover:bg-accent/80",
                "bg-muted text-foreground hover:bg-muted/80",
              ];
              const color = colors[index % colors.length];

              return (
                <motion.button
                  key={`answer-${answer.id}`}
                  className={`w-48 h-48 md:w-56 md:h-56 ${color} rounded-xl flex items-center justify-center font-mono text-lg md:text-xl shadow-[0_0_15px_rgba(255,107,107,0.5)] border border-muted text-glow p-4 transition-all`}
                  initial={{ opacity: 0, scale: 0, rotate: -10 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                  transition={{ duration: 0.5, delay: index * 0.2 }}
                  whileHover={{ scale: 1.1, shadow: "0 0 25px rgba(255,107,107,0.8)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSelect(answer)}
                  disabled={isLoading}
                >
                  {answer.text}
                </motion.button>
              );
            })}
          </div>
        )}
      </AnimatePresence>

      {isLoading && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="w-16 h-16 border-4 border-t-primary border-muted rounded-full shadow-[0_0_15px_rgba(255,107,107,0.8)] animate-spin" />
        </motion.div>
      )}
    </div>
  );
};

