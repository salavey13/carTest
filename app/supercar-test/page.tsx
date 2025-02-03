// app/test/page.tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import {
  fetchQuestions,
  fetchAnswers,
  saveTestProgress,
  loadTestProgress,
  searchCars,
  getSimilarCars,
} from '@/hooks/supabase'; // Import specific Supabase functions
import { useTelegram } from '@/hooks/useTelegram';
import { useWorker } from '@/hooks/useWorker';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Graph } from '@/components/Graph';
import { ProgressIndicator } from '@/components/ProgressIndicator';
import ResultDisplay from '@/components/ResultDisplay';

// Type definitions
interface QuestionData {
  id: number;
  text: string;
  theme: string;
  position: number;
}
interface AnswerData {
  id: number;
  question_id: number;
  text: string;
  questionText?: string;
}
interface CarResult {
  id: string;
  make: string;
  model: string;
  description?: string;
  image_url?: string;
  rent_link?: string;
  similarity?: number;
  specs?: any;
}

export default function SupercarTest() {
  const { user, isAuthenticated, isAdmin } = useTelegram();
  const { generateEmbedding } = useWorker();
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [allAnswers, setAllAnswers] = useState<AnswerData[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<AnswerData[]>([]);
  const [testProgress, setTestProgress] = useState(null);
  const [result, setResult] = useState<CarResult | null>(null);
  const [similarCars, setSimilarCars] = useState<CarResult[]>([]);

  // Fetch questions on mount
  useEffect(() => {
    const fetchQuestionsData = async () => {
      try {
        const data = await fetchQuestions(); // Use imported function
        if (data) setQuestions(data);
      } catch (error) {
        console.error('Error fetching questions:', error);
      }
    };
    fetchQuestionsData();
  }, []);

  // Fetch all answers on mount
  useEffect(() => {
    const fetchAnswersData = async () => {
      try {
        const data = await fetchAnswers(); // Use imported function
        if (data) setAllAnswers(data);
      } catch (error) {
        console.error('Error fetching answers:', error);
      }
    };
    fetchAnswersData();
  }, []);

  // Load stored test progress
  useEffect(() => {
    const loadProgress = async () => {
      if (isAuthenticated && user?.id) {
        try {
          const progress = await loadTestProgress(user.id); // Use imported function
          if (progress) {
            setCurrentQuestionIndex(progress.currentQuestionIndex || 0);
            setSelectedAnswers(progress.selectedAnswers || []);
            setTestProgress(progress);
          }
        } catch (error) {
          console.error('Error loading test progress:', error);
        }
      }
    };
    loadProgress();
  }, [isAuthenticated, user]);

  // Save test progress after each answer
  const saveProgress = async (progress: any) => {
    if (isAuthenticated && user?.id) {
      try {
        await saveTestProgress(user.id, progress); // Use imported function
      } catch (error) {
        console.error('Error saving test progress:', error);
      }
    }
  };

  // Handle answer selection
  const handleAnswer = async (answer: AnswerData) => {
    const currentQuestion = questions[currentQuestionIndex];
    const augmentedAnswer: AnswerData = {
      ...answer,
      questionText: currentQuestion?.text || '',
    };
    const updatedAnswers = [...selectedAnswers, augmentedAnswer];
    const nextIndex = currentQuestionIndex + 1;

    if (nextIndex >= questions.length) {
      // End of test: aggregate answers, generate embedding, and fetch final result
      try {
        const searchText = updatedAnswers.map(a => `${a.questionText} ${a.text}`).join(' ');
        const embedding = await generateEmbedding(searchText);
        const { data: searchResults } = await searchCars(embedding, 1); // Use imported function
        if (searchResults && searchResults.length > 0) {
          const topResult = searchResults[0];
          setResult(topResult);
          const { data: similar } = await getSimilarCars(topResult.id, 3); // Use imported function
          if (similar) {
            const filteredSimilar = similar.filter((car: CarResult) => car.id !== topResult.id);
            setSimilarCars(filteredSimilar);
          }
        } else {
          throw new Error('No matching car found');
        }
        // Clear progress after test completion
        await saveTestProgress(user.id, null); // Use imported function
      } catch (err) {
        console.error('Error determining final car:', err);
      }
    } else {
      // Update progress in the database
      const progress = {
        currentQuestionIndex: nextIndex,
        selectedAnswers: updatedAnswers,
      };
      await saveProgress(progress);
      setSelectedAnswers(updatedAnswers);
      setCurrentQuestionIndex(nextIndex);
    }
  };

  // Reset test
  const resetTest = async () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswers([]);
    setTestProgress(null);
    setResult(null);
    setSimilarCars([]);
    if (isAuthenticated && user?.id) {
      await saveTestProgress(user.id, null); // Use imported function
    }
  };

  if (questions.length === 0) {
    return <div className="min-h-screen bg-black text-white">Loading questions...</div>;
  }

  const totalQuestions = questions.length;
  const currentQuestionData = questions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Binary Background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none select-none overflow-hidden whitespace-nowrap text-[8px] leading-none binary-background">
        {Array(100).fill('01').join('')}
      </div>
      {/* Header */}
      <Header user={user} />
      {/* Main Content */}
      <div className="pt-20 relative container mx-auto px-4">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B6B] to-[#4ECDC4] font-mono mb-8">
          🚀 Supercar Match
        </h1>
        {isAdmin && (
          <Link href="/admin" className="text-cyan-400 hover:text-cyan-500">
            Admin Panel
          </Link>
        )}
        {result ? (
          <ResultDisplay
            result={result}
            similarCars={similarCars}
            onRestart={resetTest}
          />
        ) : (
          <>
            <ProgressIndicator
              total={totalQuestions}
              current={currentQuestionIndex + 1}
            />
            <Graph
              currentQuestion={currentQuestionData.id}
              questionText={currentQuestionData.text}
              onSelect={handleAnswer}
              answers={allAnswers.filter(a => a.question_id === currentQuestionData.id)}
            />
          </>
        )}
      </div>
      {/* Footer */}
      <Footer />
    </div>
  );
}
