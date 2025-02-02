'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import { supabase } from '@/hooks/supabase';
import { useTelegram } from '@/hooks/useTelegram';
import { useWorker } from '@/hooks/useWorker';
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
  const { user } = useTelegram();
  const { generateEmbedding } = useWorker();

  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [allAnswers, setAllAnswers] = useState<AnswerData[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<AnswerData[]>([]);
  const [testProgress, setTestProgress] = useState<any>(null);
  const [result, setResult] = useState<CarResult | null>(null);
  const [similarCars, setSimilarCars] = useState<CarResult[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const [mode, setMode] = useState<'question' | 'preview'>('question');
  const [previewCars, setPreviewCars] = useState<CarResult[]>([]);
  // Use a MotionValue for modeProgress instead of a plain number.
  const modeProgress = useMotionValue(0);

  // 1. Fetch questions on mount
  useEffect(() => {
    const fetchQuestions = async () => {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .order('position', { ascending: true });
      if (error) {
        console.error('Error fetching questions:', error);
      } else if (data) {
        setQuestions(data);
      }
    };
    fetchQuestions();
  }, []);

  // 2. Fetch all answers on mount
  useEffect(() => {
    const fetchAnswers = async () => {
      const { data, error } = await supabase.from('answers').select('*');
      if (error) {
        console.error('Error fetching answers:', error);
      } else if (data) {
        setAllAnswers(data);
      }
    };
    fetchAnswers();
  }, []);

  // 3. Load stored test progress
  useEffect(() => {
    const loadProgress = async () => {
      if (user?.id) {
        const { data } = await supabase
          .from('users')
          .select('test_progress')
          .eq('user_id', user.id)
          .single();
        if (data?.test_progress) {
          setCurrentQuestionIndex(data.test_progress.currentQuestionIndex);
          setSelectedAnswers(data.test_progress.selectedAnswers);
          setTestProgress(data.test_progress);
        }
      }
    };
    loadProgress();
  }, [user]);

  // 4. Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (user?.id) {
        const { data } = await supabase
          .from('users')
          .select('role')
          .eq('user_id', user.id)
          .single();
        setIsAdmin(data?.role === 'admin');
      }
    };
    checkAdmin();
  }, [user]);

  // 5. Real-time preview updates
  useEffect(() => {
    const updatePreview = async () => {
      if (selectedAnswers.length > 0) {
        const searchText = selectedAnswers
          .map(a => `${a.questionText} ${a.text}`)
          .join(' ');
        try {
          const embedding = await generateEmbedding(searchText);
          const { data, error } = await supabase.rpc('search_cars', {
            query_embedding: embedding,
            match_count: 3,
          });
          if (error) throw error;
          setPreviewCars(data || []);
        } catch (err) {
          console.error('Error updating preview:', err);
        }
      }
    };

    if (mode === 'preview') {
      updatePreview();
    }
  }, [selectedAnswers, mode, generateEmbedding]);

  // 6. Handle answer selection
  const handleAnswer = async (answer: AnswerData) => {
    // Augment answer with the current question text
    const currentQuestion = questions[currentQuestionIndex];
    const augmentedAnswer: AnswerData = {
      ...answer,
      questionText: currentQuestion?.text || ''
    };

    const updatedAnswers = [...selectedAnswers, augmentedAnswer];
    const nextIndex = currentQuestionIndex + 1;

    if (nextIndex >= questions.length) {
      // End of test: aggregate answers, generate embedding, and fetch final result
      try {
        const searchText = updatedAnswers
          .map(a => `${a.questionText} ${a.text}`)
          .join(' ');
        const embedding = await generateEmbedding(searchText);
        const { data, error } = await supabase.rpc('search_cars', {
          query_embedding: embedding,
          match_count: 1,
        });
        if (error) throw error;
        if (data && data.length > 0) {
          const topResult = data[0];
          setResult(topResult);
          const { data: similar, error: similarError } = await supabase.rpc('similar_cars', {
            car_id: topResult.id,
            match_count: 3,
          });
          if (similarError) throw similarError;
          if (similar) {
            // Remove top result from similar cars if it appears there
            const filteredSimilar = similar.filter((car: CarResult) => car.id !== topResult.id);
            setSimilarCars(filteredSimilar);
          }
        } else {
          throw new Error("No matching car found");
        }
      } catch (err) {
        console.error("Error determining final car:", err);
      }
      // Clear stored progress for a fresh start next time
      await supabase
        .from('users')
        .update({ test_progress: null })
        .eq('user_id', user?.id);
    } else {
      // Otherwise, update progress in the database
      const progress = {
        currentQuestionIndex: nextIndex,
        selectedAnswers: updatedAnswers,
      };
      await supabase
        .from('users')
        .update({ test_progress: progress })
        .eq('user_id', user?.id);
      setSelectedAnswers(updatedAnswers);
      setCurrentQuestionIndex(nextIndex);
    }
  };

  // 7. Reset test
  const resetTest = async () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswers([]);
    setTestProgress(null);
    setResult(null);
    setSimilarCars([]);
    setMode('question');
    modeProgress.set(0);
    await supabase
      .from('users')
      .update({ test_progress: null })
      .eq('user_id', user?.id);
  };

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4 flex items-center justify-center">
        Loading questions...
      </div>
    );
  }

  if (result) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="min-h-screen bg-gray-900 text-white p-4"
      >
        <nav className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">🚀 Supercar Match</h1>
          {isAdmin && (
            <Link href="/admin" className="bg-cyan-500 px-4 py-2 rounded-lg">
              Admin Panel
            </Link>
          )}
        </nav>
        <button
          onClick={resetTest}
          className="bg-red-500 p-2 rounded mb-4"
        >
          Restart Test
        </button>
        <ResultDisplay result={result} similarCars={similarCars} />
      </motion.div>
    );
  }

  const totalQuestions = questions.length;
  const currentQuestionData = questions[currentQuestionIndex];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-gray-900 text-white p-4 flex flex-col"
    >
      <nav className="flex-shrink-0 mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">🚀 Supercar Match</h1>
          {isAdmin && (
            <Link href="/admin" className="bg-cyan-500 px-4 py-2 rounded-lg">
              Admin Panel
            </Link>
          )}
        </div>
      </nav>

      <ProgressIndicator
        current={currentQuestionIndex}
        total={totalQuestions}
        answered={selectedAnswers.map(a =>
          questions.findIndex(q => q.id === a.question_id)
        )}
        mode={mode}
        modeProgress={modeProgress}
      />

      <div className="flex-grow relative overflow-hidden">
        <Graph
          currentQuestion={currentQuestionData.id}
          questionText={currentQuestionData.text}
          theme={currentQuestionData.theme}
          onSelect={handleAnswer}
          mode={mode}
          onModeChange={setMode}
          previewCars={previewCars}
          answers={allAnswers}
          setModeProgress={modeProgress.set}
        />
      </div>

      <AnimatePresence>
        {mode === 'preview' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center mt-4 text-sm text-gray-400"
          >
            Swipe up to return to questions
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

