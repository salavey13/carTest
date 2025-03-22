// /app/supercar-test/page.tsx
"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence, useMotionValue } from "framer-motion";
import { Brain } from "lucide-react";
import { supabaseAdmin } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
import { Graph } from "@/components/Graph";
import { ProgressIndicator } from "@/components/ProgressIndicator";
import ResultDisplay from "@/components/ResultDisplay";
import { debugLogger } from "@/lib/debugLogger";

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
  owner?: string; // Added for consistency with search API
}

export default function SupercarTest() {
  const { user } = useAppContext();

  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [allAnswers, setAllAnswers] = useState<AnswerData[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<AnswerData[]>([]);
  const [testProgress, setTestProgress] = useState<any>(null);
  const [result, setResult] = useState<CarResult | null>(null);
  const [similarCars, setSimilarCars] = useState<CarResult[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [mode, setMode] = useState<"question" | "preview">("question");
  const [previewCars, setPreviewCars] = useState<CarResult[]>([]);
  const modeProgress = useMotionValue(0);

  // Fetch questions on mount
  useEffect(() => {
    const fetchQuestions = async () => {
      const { data, error } = await supabaseAdmin.from("questions").select("*").order("position", { ascending: true });
      if (error) {
        console.error("Ошибка загрузки вопросов:", error);
      } else if (data) {
        setQuestions(data);
      }
    };
    fetchQuestions();
  }, []);

  // Fetch all answers on mount
  useEffect(() => {
    const fetchAnswers = async () => {
      const { data, error } = await supabaseAdmin.from("answers").select("*");
      if (error) {
        console.error("Ошибка загрузки ответов:", error);
      } else if (data) {
        setAllAnswers(data);
      }
    };
    fetchAnswers();
  }, []);

  // Load stored test progress
  useEffect(() => {
    const loadProgress = async () => {
      if (user?.id) {
        const { data } = await supabaseAdmin.from("users").select("test_progress").eq("user_id", user.id).single();
        if (data?.test_progress) {
          setCurrentQuestionIndex(data.test_progress.currentQuestionIndex);
          setSelectedAnswers(data.test_progress.selectedAnswers);
          setTestProgress(data.test_progress);
        }
      }
    };
    loadProgress();
  }, [user]);

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (user?.id) {
        const { data } = await supabaseAdmin.from("users").select("role").eq("user_id", user.id).single();
        setIsAdmin(data?.role === "admin");
      }
    };
    checkAdmin();
  }, [user]);

  // Real-time preview updates using search API
  useEffect(() => {
    const updatePreview = async () => {
      if (selectedAnswers.length > 0) {
        const searchText = selectedAnswers.map((a) => `${a.questionText} ${a.text}`).join(" ");
        try {
          const response = await fetch("/api/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: searchText }),
          });
          if (!response.ok) throw new Error(`Ошибка API: ${response.status}`);
          const data = await response.json();
          setPreviewCars(data || []);
        } catch (err) {
          console.error("Ошибка обновления превью:", err);
        }
      }
    };

    if (mode === "preview") {
      updatePreview();
    }
  }, [selectedAnswers, mode]);

  // Handle answer selection
  const handleAnswer = async (answer: AnswerData) => {
    const currentQuestion = questions[currentQuestionIndex];
    const augmentedAnswer: AnswerData = {
      ...answer,
      questionText: currentQuestion?.text || "",
    };

    const updatedAnswers = [...selectedAnswers, augmentedAnswer];
    const nextIndex = currentQuestionIndex + 1;

    if (nextIndex >= questions.length) {
      try {
        setIsSearching(true);
        const searchText = updatedAnswers.map((a) => `${a.questionText} ${a.text}`).join(" ");

        const response = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchText }),
        });

        if (!response.ok) throw new Error(`Ошибка поиска: ${response.status}`);
        const data = await response.json();

        if (data && data.length > 0) {
          const topResult = data[0];
          setResult(topResult);

          const { data: similar, error: similarError } = await supabaseAdmin.rpc("similar_cars", {
            car_id: topResult.id,
            match_count: 3,
          });

          if (similarError) throw similarError;

          if (similar) {
            const filteredSimilar = similar.filter((car: CarResult) => car.id !== topResult.id);
            setSimilarCars(filteredSimilar);
          }
        } else {
          throw new Error("Машина не найдена");
        }
      } catch (err) {
        debugLogger.error("Ошибка определения машины:", err);
        setSearchError("Не удалось найти подходящую машину. Попробуйте снова.");
      } finally {
        setIsSearching(false);
        await supabaseAdmin.from("users").update({ test_progress: null }).eq("user_id", user?.id);
      }
    } else {
      const progress = {
        currentQuestionIndex: nextIndex,
        selectedAnswers: updatedAnswers,
      };
      await supabaseAdmin.from("users").update({ test_progress: progress }).eq("user_id", user?.id);
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
    setMode("question");
    modeProgress.set(0);
    setSearchError(null);
    await supabaseAdmin.from("users").update({ test_progress: null }).eq("user_id", user?.id);
  };

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-[#00ff9d] p-4 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="w-12 h-12 border-4 border-t-[#00ff9d] border-[#00ff9d]/20 rounded-full shadow-[0_0_15px_rgba(0,255,157,0.5)]"
        />
        <span className="ml-4 text-lg font-mono">Загрузка вопросов...</span>
      </div>
    );
  }

  if (isSearching) {
    return (
      <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gray-900 text-[#00ff9d] rounded-lg p-8 shadow-[0_0_20px_rgba(0,255,157,0.5)] max-w-md w-full mx-4 border border-[#00ff9d]/30"
        >
          <div className="text-center space-y-4">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="flex justify-center"
            >
              <Brain className="h-12 w-12 text-[#00ff9d] animate-pulse" />
            </motion.div>
            <h3 className="text-lg font-mono text-[#00ff9d]">Анализ предпочтений</h3>
            <p className="text-sm text-[#00ff9d]/70">ИИ подбирает вашу кибер-машину...</p>
            <div className="flex justify-center gap-2">
              <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-2 h-2 bg-[#00ff9d] rounded-full"></motion.div>
              <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.2 }} className="w-2 h-2 bg-[#00ff9d] rounded-full"></motion.div>
              <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.4 }} className="w-2 h-2 bg-[#00ff9d] rounded-full"></motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (searchError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-[#00ff9d] p-4 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900 rounded-lg p-8 shadow-[0_0_20px_rgba(255,0,122,0.5)] max-w-md w-full mx-4 border border-[#ff007a]/50"
        >
          <div className="text-center space-y-4">
            <h3 className="text-lg font-mono text-[#ff007a]">ОШИБКА: Ничего не подошло</h3>
            <p className="text-sm text-[#00ff9d]/70">Попробуйте ещё раз, кибер-друг!</p>
            <button
              onClick={resetTest}
              className="bg-[#ff007a]/80 text-white px-4 py-2 rounded-md hover:bg-[#ff007a] transition-colors shadow-[0_0_10px_rgba(255,0,122,0.5)]"
            >
              Попробовать снова
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (result) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-[#00ff9d]"
      >
        <button
          onClick={resetTest}
          className="bg-[#ff007a]/80 text-white p-2 rounded mb-4 mx-auto block hover:bg-[#ff007a] transition-colors shadow-[0_0_10px_rgba(255,0,122,0.5)]"
        >
          Перезапустить тест
        </button>
        <ResultDisplay result={result} similarCars={similarCars} />
      </motion.div>
    );
  }

  const totalQuestions = questions.length;
  const currentQuestionData = questions[currentQuestionIndex];
  const answersForCurrentQuestion = allAnswers.filter((answer) => answer.question_id === currentQuestionData.id);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-[#00ff9d] flex flex-col"
    >
      <div className="flex-grow flex flex-col">
        <div className="mb-4 mt-32">
          <ProgressIndicator
            current={currentQuestionIndex}
            total={totalQuestions}
            answered={selectedAnswers.map((a) => questions.findIndex((q) => q.id === a.question_id))}
            mode={mode}
            modeProgress={modeProgress}
          />
        </div>

        <div className="relative flex-grow overflow-hidden">
          <Graph
            currentQuestion={{ id: currentQuestionData.id, text: currentQuestionData.text }}
            answers={answersForCurrentQuestion}
            onSelect={handleAnswer}
          />
        </div>

        <AnimatePresence>
          {mode === "preview" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center mt-4 text-sm text-[#00ff9d]/70"
            >
              Смахните вверх для возврата к вопросам
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

