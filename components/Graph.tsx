'use client';
import { useState, useCallback } from 'react';
import { useSwipeable } from 'react-swipeable';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { CarImage } from './CarImage';
import { AnimatedText } from './AnimatedText';

interface GraphProps {
  currentQuestion: number;
  questionText: string;
  onSelect: (answer: any) => void;
  mode: 'question' | 'preview';
  onModeChange: (mode: 'question' | 'preview') => void;
  previewCars: any[];
  answers: {
    id: number;
    question_id: number;
    text: string;
  }[];
  setModeProgress: (value: number) => void;
}

export const Graph = ({
  currentQuestion,
  questionText,
  onSelect,
  mode,
  onModeChange,
  previewCars = [],
  answers,
  setModeProgress
}: GraphProps) => {
  const [carIndex, setCarIndex] = useState(0);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const modeProgress = useMotionValue(0);

  // Filter answers to only those for the current question
  const currentAnswers = answers.filter(answer => answer.question_id === currentQuestion);

  const handleCarChange = useCallback((direction: number) => {
    setCarIndex(prev => Math.max(0, Math.min(prev + direction, previewCars.length - 1)));
  }, [previewCars.length]);

  const handlers = useSwipeable({
    onSwiping: ({ deltaX, deltaY, dir }) => {
      if (mode === 'question') {
        const verticalProgress = Math.min(Math.abs(deltaY) / 150, 1);
        modeProgress.set(verticalProgress);
        setSwipeProgress(verticalProgress);
        
        if (dir === 'Up' || dir === 'Down') {
          onModeChange(dir === 'Down' ? 'preview' : 'question');
        }
      } else {
        const horizontalProgress = Math.min(Math.abs(deltaX) / 150, 1);
        setSwipeProgress(horizontalProgress);
      }
    },
    onSwiped: ({ deltaX, dir }) => {
      if (mode === 'preview' && Math.abs(deltaX) > 50) {
        handleCarChange(deltaX > 0 ? -1 : 1);
      }
      setSwipeProgress(0);
      modeProgress.set(0);
      setModeProgress(0);
    },
    trackMouse: true,
    delta: 10
  });

  // Ensure carIndex is always within bounds
  const safeCarIndex = Math.min(carIndex, previewCars.length - 1);
  const selectedCar = previewCars[safeCarIndex];

  return (
    <div {...handlers} className="relative h-[65vh] overflow-visible">
      {/* Question Card */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-purple-700/80 to-purple-900/80 
          rounded-3xl p-8 shadow-2xl backdrop-blur-sm"
        style={{
          y: useTransform(modeProgress, [0, 1], [0, 300]),
          scale: useTransform(modeProgress, [0, 1], [1, 0.9]),
          opacity: useTransform(modeProgress, [0, 1], [1, 0.7])
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion}
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="h-full flex flex-col justify-between"
          >
            <AnimatedText mode={mode} baseSize="text-3xl" activeSize="text-3xl">
              {questionText}
            </AnimatedText>

            <div className="flex gap-4 justify-between">
              {currentAnswers.map((answer, i) => (
                <motion.button
                  key={answer.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex-1 p-6 bg-black/20 rounded-xl backdrop-blur-sm"
                  onClick={() => onSelect(answer)}
                >
                  <AnimatedText 
                    mode={mode} 
                    baseSize="text-lg" 
                    activeSize="text-xl"
                    delay={i * 0.1}
                  >
                    {answer.text}
                  </AnimatedText>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Car Preview Card */}
      <motion.div
        className="absolute inset-0 bg-gray-800/90 rounded-3xl p-8 shadow-2xl backdrop-blur-sm"
        style={{
          y: useTransform(modeProgress, [0, 1], [300, 0]),
          scale: useTransform(modeProgress, [0, 1], [0.9, 1]),
          opacity: modeProgress
        }}
      >
        <AnimatePresence mode="popLayout" custom={safeCarIndex}>
          <motion.div
            key={safeCarIndex}
            custom={safeCarIndex}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="h-full flex flex-col gap-6"
          >
            {selectedCar ? (
              <>
                <CarImage 
                  src={selectedCar.image_url || '/default-car.png'} 
                  alt={selectedCar.model || 'Car'}
                  progress={swipeProgress}
                />

                <div className="space-y-4">
                  <AnimatedText mode="preview" baseSize="text-2xl" activeSize="text-3xl">
                    {selectedCar.make} {selectedCar.model}
                  </AnimatedText>
                  
                  <AnimatedText mode="preview" delay={0.1}>
                    {selectedCar.description || 'Описание недоступно'}
                  </AnimatedText>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full">
                <p className="text-lg text-gray-400">Загрузка машин...</p>
              </div>
            )}

            <div className="flex gap-2 justify-center mt-auto">
              {previewCars.map((_, i) => (
                <motion.div
                  key={i}
                  className={`w-3 h-3 rounded-full ${
                    i === safeCarIndex ? 'bg-cyan-400' : 'bg-gray-600'
                  }`}
                  animate={{ scale: i === safeCarIndex ? 1.3 : 1 }}
                />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

