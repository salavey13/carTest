"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence, useMotionValue } from "framer-motion"
import { Brain } from "lucide-react"
import { supabaseAdmin } from "@/hooks/supabase"
import { useTelegram } from "@/hooks/useTelegram"
import { useWorker } from "@/hooks/useWorker"
import { Graph } from "@/components/Graph"
import { ProgressIndicator } from "@/components/ProgressIndicator"
import ResultDisplay from "@/components/ResultDisplay"
import { debugLogger } from "@/lib/debugLogger"

// Type definitions
interface QuestionData {
  id: number
  text: string
  theme: string
  position: number
}

interface AnswerData {
  id: number
  question_id: number
  text: string
  questionText?: string
}

interface CarResult {
  id: string
  make: string
  model: string
  description?: string
  image_url?: string
  rent_link?: string
  similarity?: number
  specs?: any
}

export default function SupercarTest() {
  const { user } = useTelegram()
  const { generateEmbedding, isInitialized } = useWorker()

  const [questions, setQuestions] = useState<QuestionData[]>([])
  const [allAnswers, setAllAnswers] = useState<AnswerData[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<AnswerData[]>([])
  const [testProgress, setTestProgress] = useState<any>(null)
  const [result, setResult] = useState<CarResult | null>(null)
  const [similarCars, setSimilarCars] = useState<CarResult[]>([])
  const [isAdmin, setIsAdmin] = useState(false)

  const [mode, setMode] = useState<"question" | "preview">("question")
  const [previewCars, setPreviewCars] = useState<CarResult[]>([])
  // Use a MotionValue for modeProgress instead of a plain number.
  const modeProgress = useMotionValue(0)

  // Add loading state for search
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // 1. Fetch questions on mount
  useEffect(() => {
    const fetchQuestions = async () => {
      const { data, error } = await supabaseAdmin.from("questions").select("*").order("position", { ascending: true })
      if (error) {
        console.error("Error fetching questions:", error)
      } else if (data) {
        setQuestions(data)
      }
    }
    fetchQuestions()
  }, [])

  // 2. Fetch all answers on mount
  useEffect(() => {
    const fetchAnswers = async () => {
      const { data, error } = await supabaseAdmin.from("answers").select("*")
      if (error) {
        console.error("Error fetching answers:", error)
      } else if (data) {
        setAllAnswers(data)
      }
    }
    fetchAnswers()
  }, [])

  // 3. Load stored test progress
  useEffect(() => {
    const loadProgress = async () => {
      if (user?.id) {
        const { data } = await supabaseAdmin.from("users").select("test_progress").eq("user_id", user.id).single()
        if (data?.test_progress) {
          setCurrentQuestionIndex(data.test_progress.currentQuestionIndex)
          setSelectedAnswers(data.test_progress.selectedAnswers)
          setTestProgress(data.test_progress)
        }
      }
    }
    loadProgress()
  }, [user])

  // 4. Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (user?.id) {
        const { data } = await supabaseAdmin.from("users").select("role").eq("user_id", user.id).single()
        setIsAdmin(data?.role === "admin")
      }
    }
    checkAdmin()
  }, [user])

  // 5. Real-time preview updates
  useEffect(() => {
    const updatePreview = async () => {
      if (selectedAnswers.length > 0) {
        const searchText = selectedAnswers.map((a) => `${a.questionText} ${a.text}`).join(" ")
        try {
          const embedding = await generateEmbedding(searchText)
          const { data, error } = await supabaseAdmin.rpc("search_cars", {
            query_embedding: embedding,
            match_count: 3,
          })
          if (error) throw error
          setPreviewCars(data || [])
        } catch (err) {
          console.error("Error updating preview:", err)
        }
      }
    }

    if (mode === "preview") {
      updatePreview()
    }
  }, [selectedAnswers, mode, generateEmbedding])

  // 6. Handle answer selection
  const handleAnswer = async (answer: AnswerData) => {
    const currentQuestion = questions[currentQuestionIndex]
    const augmentedAnswer: AnswerData = {
      ...answer,
      questionText: currentQuestion?.text || "",
    }

    const updatedAnswers = [...selectedAnswers, augmentedAnswer]
    const nextIndex = currentQuestionIndex + 1

    if (nextIndex >= questions.length) {
      try {
        setIsSearching(true)
        const searchText = updatedAnswers.map((a) => `${a.questionText} ${a.text}`).join(" ")

        // Wait for worker initialization if needed
        if (!isInitialized) {
          debugLogger.log("Waiting for worker initialization...")
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }

        const embedding = await generateEmbedding(searchText)

        if (!embedding || embedding.length === 0) {
          throw new Error("Generated embedding is empty")
        }

        debugLogger.log("Generated embedding:", embedding.length, "dimensions")

        const { data, error } = await supabaseAdmin.rpc("search_cars", {
          query_embedding: embedding,
          match_count: 1,
        })

        if (error) throw error

        if (data && data.length > 0) {
          const topResult = data[0]
          setResult(topResult)

          const { data: similar, error: similarError } = await supabaseAdmin.rpc("similar_cars", {
            car_id: topResult.id,
            match_count: 3,
          })

          if (similarError) throw similarError

          if (similar) {
            const filteredSimilar = similar.filter((car: CarResult) => car.id !== topResult.id)
            setSimilarCars(filteredSimilar)
          }
        } else {
          throw new Error("No matching car found")
        }
      } catch (err) {
        debugLogger.error("Error determining final car:", err)
        setSearchError("Failed to find a matching car. Please try again.")
        // Show error to user
        // You might want to add error state and display it in the UI
      } finally {
        setIsSearching(false)
        // Clear stored progress
        await supabaseAdmin.from("users").update({ test_progress: null }).eq("user_id", user?.id)
      }
    } else {
      const progress = {
        currentQuestionIndex: nextIndex,
        selectedAnswers: updatedAnswers,
      }
      await supabaseAdmin.from("users").update({ test_progress: progress }).eq("user_id", user?.id)
      setSelectedAnswers(updatedAnswers)
      setCurrentQuestionIndex(nextIndex)
    }
  }

  // 7. Reset test
  const resetTest = async () => {
    setCurrentQuestionIndex(0)
    setSelectedAnswers([])
    setTestProgress(null)
    setResult(null)
    setSimilarCars([])
    setMode("question")
    modeProgress.set(0)
    setSearchError(null)
    await supabaseAdmin.from("users").update({ test_progress: null }).eq("user_id", user?.id)
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4 flex items-center justify-center">
        Loading questions...
      </div>
    )
  }

  // Add loading state to result display
  if (isSearching) {
    return (
      <div className="fixed inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center dark">
        <div className="bg-card text-card-foreground rounded-lg p-8 shadow-lg max-w-md w-full mx-4 border border-border">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <Brain className="h-12 w-12 text-primary animate-pulse" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Анализ предпочтений</h3>
            <p className="text-sm text-muted-foreground">ИИ подбирает вам машину по вкусу...</p>
            <div className="flex justify-center gap-2">
              <div className="animate-bounce delay-0 w-2 h-2 bg-primary rounded-full"></div>
              <div className="animate-bounce delay-150 w-2 h-2 bg-primary rounded-full"></div>
              <div className="animate-bounce delay-300 w-2 h-2 bg-primary rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (searchError) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 flex items-center justify-center dark">
        <div className="bg-card text-card-foreground rounded-lg p-8 shadow-lg max-w-md w-full mx-4 border border-destructive">
          <div className="text-center space-y-4">
            <h3 className="text-lg font-semibold text-destructive">Вам ничего не подошло</h3>
            <p className="text-sm text-muted-foreground">Попробуйте закатать губу.</p>
            <button
              onClick={resetTest}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
            >
              Попробовать снова
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (result) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="min-h-screen bg-gray-900 text-white"
      >
        <button onClick={resetTest} className="bg-red-500 p-2 rounded mb-4 mx-auto block">
          Restart Test
        </button>
        <ResultDisplay result={result} similarCars={similarCars} />
      </motion.div>
    )
  }

  const totalQuestions = questions.length
  const currentQuestionData = questions[currentQuestionIndex]

  // Filter answers to only show those for the current question
  const answersForCurrentQuestion = allAnswers.filter((answer) => answer.question_id === currentQuestionData.id)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-gray-900 text-white flex flex-col"
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
              className="text-center mt-4 text-sm text-gray-400"
            >
              Swipe up to return to questions
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

