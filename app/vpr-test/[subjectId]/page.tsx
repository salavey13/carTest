"use client";
import { useEffect, useState, useCallback } from "react"; // Добавлен useCallback
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Loader2, BookOpen, RotateCcw, Info, AlertTriangle, Lightbulb } from "lucide-react"; // Добавлен AlertTriangle, Lightbulb (needed for ExplanationDisplay)
import { supabaseAdmin } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
import { debugLogger } from "@/lib/debugLogger";
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { VprProgressIndicator } from "@/components/VprProgressIndicator";
import { QuestionDisplay } from "@/components/QuestionDisplay";
import { AnswerOption } from "@/components/AnswerOption";
import { ExplanationDisplay } from "@/components/ExplanationDisplay";
import { TimerDisplay } from "@/components/TimerDisplay"; // Импорт таймера
import { toast } from "sonner"; // Для уведомлений

// --- Interfaces (kept from current context, VprAnswerData exported) ---
interface SubjectData {
    id: number;
    name: string;
    description?: string;
}

interface VprQuestionData {
    id: number;
    subject_id: number;
    text: string;
    explanation?: string;
    position: number;
    vpr_answers: VprAnswerData[];
}

export interface VprAnswerData { // Экспортируем для AnswerOption
    id: number;
    question_id: number;
    text: string;
    is_correct: boolean;
}

interface VprTestAttempt {
    id: string;
    user_id: string;
    subject_id: number;
    started_at: string;
    completed_at?: string;
    score?: number;
    total_questions: number;
    last_question_index: number;
}
// --- End Interfaces ---

export default function VprTestPage() {
    // --- Existing States (from current context) ---
    const { user } = useAppContext();
    const params = useParams();
    const router = useRouter();
    const subjectId = parseInt(params.subjectId as string, 10);

    const [subject, setSubject] = useState<SubjectData | null>(null);
    const [questions, setQuestions] = useState<VprQuestionData[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [currentAttempt, setCurrentAttempt] = useState<VprTestAttempt | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedAnswerId, setSelectedAnswerId] = useState<number | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false); // Needed for ExplanationDisplay prop
    const [feedbackExplanation, setFeedbackExplanation] = useState<string | null>(null); // Needed for ExplanationDisplay prop

    const [isTestComplete, setIsTestComplete] = useState(false);
    const [finalScore, setFinalScore] = useState<number>(0);
    // --- End Existing States ---

    // --- New States (from new version) ---
    const [showDescription, setShowDescription] = useState(false);
    const [timerKey, setTimerKey] = useState(Date.now()); // Ключ для сброса таймера
    const [isTimerRunning, setIsTimerRunning] = useState(false); // Состояние таймера
    const [timeLimit] = useState(900); // Пример: 15 минут на тест (в секундах)
    const [timeUpModal, setTimeUpModal] = useState(false); // Модальное окно при истечении времени
    // --- End New States ---

    // --- New Timer Functions (from new version) ---
    const handleTimeUp = useCallback(() => {
        debugLogger.log("Время вышло!");
        setIsTimerRunning(false);
        setShowFeedback(false); // Скрываем текущую обратную связь, если есть
        // Показываем модалку или сразу завершаем тест
        setTimeUpModal(true);
        // Можно автоматически завершить тест
        // handleNextQuestion(true); // Передаем флаг timeUp = true - removed this direct call
    }, []); // Пустой массив зависимостей

    const completeTestDueToTime = async () => {
         setTimeUpModal(false);
         if (!currentAttempt) return;

         // Логика завершения теста (похожа на isFinishing в handleNextQuestion)
         setIsLoading(true); // Показать индикатор загрузки
         try {
             const currentScore = currentAttempt.score || 0; // Get score before update
             const updates: Partial<VprTestAttempt> = {
                 last_question_index: questions.length, // Отмечаем все вопросы как "пройденные"
                 completed_at: new Date().toISOString(),
                 score: currentScore // Use the score calculated so far
             };

             const { error: updateError } = await supabaseAdmin
                 .from('vpr_test_attempts')
                 .update(updates)
                 .eq('id', currentAttempt.id);

              if (updateError) throw updateError;

              setCurrentAttempt(prev => prev ? { ...prev, ...updates } : null);
              setIsTestComplete(true);
              setFinalScore(updates.score ?? 0); // Set final score from updates
              toast.warning("Время вышло! Тест завершен.", { duration: 5000 });

         } catch (err) {
             debugLogger.error("Ошибка принудительного завершения теста:", err);
             setError("Не удалось завершить тест. Попробуйте обновить страницу.");
             // Consider adding a toast error here as well
         } finally {
            setIsLoading(false);
         }
    };
    // --- End New Timer Functions ---


    // --- Data Fetching and Attempt Handling (merged from current context + new timer logic) ---
    useEffect(() => {
        // --- User/Subject ID Check (from current context) ---
        if (!user?.id || !subjectId || isNaN(subjectId)) {
            if (!user?.id) router.push('/login'); // Или другая логика
            else setError("Неверный ID предмета");
            setIsLoading(false);
            return;
        };

        const initializeTest = async () => {
            setIsLoading(true);
            setError(null);
            // --- State Resets (from current context + new states) ---
            setShowDescription(false);
            setIsTestComplete(false);
            setShowFeedback(false);
            setSelectedAnswerId(null);
            setIsTimerRunning(false); // Таймер пока не запущен
            setTimerKey(Date.now()); // Сброс ключа таймера
            setTimeUpModal(false);
            // Reset score related states too for clean start
            setIsCorrect(false);
            setFeedbackExplanation(null);
            setFinalScore(0);
            setCurrentQuestionIndex(0); // Ensure index is reset
            setCurrentAttempt(null); // Clear previous attempt state

            try {
                // --- Role Update Block (from current context) ---
                const currentUserRole = user?.dbUser?.role;
                if (user?.id && currentUserRole && currentUserRole !== 'vpr_tester' && currentUserRole !== 'admin') {
                    try {
                        const { error: roleUpdateError } = await supabaseAdmin
                            .from('users')
                            .update({ role: 'vpr_tester' })
                            .eq('user_id', user.id);
                        if (roleUpdateError) {
                             debugLogger.error("Ошибка обновления роли пользователя:", roleUpdateError);
                        } else {
                            debugLogger.log(`Роль пользователя ${user.id} обновлена на vpr_tester`);
                            // Optional: update context if supported
                        }
                    } catch (roleErr) {
                         debugLogger.error("Исключение при обновлении роли:", roleErr);
                    }
                }
                // --- End Role Update Block ---

                // --- Subject Fetch (from current context) ---
                const { data: subjectData, error: subjectError } = await supabaseAdmin
                    .from('subjects')
                    .select('*')
                    .eq('id', subjectId)
                    .single();
                if (subjectError || !subjectData) throw new Error(subjectError?.message || 'Предмет не найден');
                setSubject(subjectData);

                // --- Questions Fetch (from current context) ---
                const { data: questionData, error: questionError } = await supabaseAdmin
                    .from('vpr_questions')
                    .select(`*, vpr_answers ( * )`)
                    .eq('subject_id', subjectId)
                    .order('position', { ascending: true });
                if (questionError || !questionData || questionData.length === 0) throw new Error(questionError?.message || 'Вопросы для этого предмета не найдены');
                setQuestions(questionData);

                // --- Attempt Find/Create (from current context) ---
                const { data: existingAttempts, error: attemptError } = await supabaseAdmin
                    .from('vpr_test_attempts')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('subject_id', subjectId)
                    .is('completed_at', null)
                    .order('started_at', { ascending: false })
                    .limit(1);
                if (attemptError) throw attemptError;

                let attemptToUse: VprTestAttempt;
                if (existingAttempts && existingAttempts.length > 0) {
                    attemptToUse = existingAttempts[0];
                     if(attemptToUse.total_questions !== questionData.length) {
                          debugLogger.warn("Количество вопросов изменилось, начинаем новую попытку.");
                           const { data: newAttemptData, error: newAttemptError } = await createNewAttempt(user.id, subjectId, questionData.length);
                           if (newAttemptError || !newAttemptData) throw newAttemptError || new Error('Не удалось создать новую попытку');
                           attemptToUse = newAttemptData;
                     } else {
                        debugLogger.log("Возобновление попытки:", attemptToUse.id);
                        // Restore score from existing attempt
                        setFinalScore(attemptToUse.score || 0);
                     }
                } else {
                    const { data: newAttemptData, error: newAttemptError } = await createNewAttempt(user.id, subjectId, questionData.length);
                    if (newAttemptError || !newAttemptData) throw newAttemptError || new Error('Не удалось создать новую попытку');
                    attemptToUse = newAttemptData;
                    debugLogger.log("Начата новая попытка:", attemptToUse.id);
                    setFinalScore(0); // Ensure score is 0 for new attempt
                }
                setCurrentAttempt(attemptToUse);
                setCurrentQuestionIndex(Math.min(attemptToUse.last_question_index, questionData.length - 1)); // Correct index resume

                // --- Timer Start Logic (from new version) ---
                // Запускаем таймер только если тест не завершен И не загружается
                if (!attemptToUse.completed_at) {
                     setIsTimerRunning(true);
                } else {
                     // If attempt was already completed (edge case), set test as complete
                     setIsTestComplete(true);
                     setFinalScore(attemptToUse.score || 0);
                     setIsTimerRunning(false);
                }


            } catch (err: any) {
                debugLogger.error("Ошибка инициализации теста:", err);
                setError(err.message || 'Произошла ошибка при загрузке теста');
                setIsTimerRunning(false); // Ensure timer isn't running on error
            } finally {
                setIsLoading(false);
            }
        };

        // --- Helper function (from current context) ---
        const createNewAttempt = async (userId: string, subjId: number, totalQ: number) => {
             return await supabaseAdmin
                 .from('vpr_test_attempts')
                 .insert({ user_id: userId, subject_id: subjId, total_questions: totalQ, last_question_index: 0, score: 0 }) // Initialize score to 0
                 .select()
                 .single();
         };

        initializeTest();
     // Include timerKey in dependencies if you want timer to reset on explicit key change,
     // but router.replace with query param handles the main reset case.
     }, [user, subjectId, router]);
    // --- End Data Fetching ---


    // --- Answer Handling Logic (merged from current context + new timer logic) ---
    const handleAnswer = async (selectedAnswer: VprAnswerData) => {
        // Guard clause includes new timer check
        if (!currentAttempt || showFeedback || isTestComplete || isLoading || !isTimerRunning) return;

        setIsTimerRunning(false); // !!! Останавливаем таймер на время показа объяснения !!! (New)
        setSelectedAnswerId(selectedAnswer.id); // (Current)

        // --- Feedback Logic (from current context) ---
        const correct = selectedAnswer.is_correct;
        setIsCorrect(correct);
        setFeedbackExplanation(questions[currentQuestionIndex]?.explanation || "Объяснение отсутствует.");
        setShowFeedback(true);
        // --- End Feedback Logic ---

        // --- Score Update (Client-side immediate update from current context) ---
        const scoreIncrement = correct ? 1 : 0;
        const newScore = (currentAttempt.score || 0) + scoreIncrement;
        // Update client-side attempt state immediately
        setCurrentAttempt(prev => prev ? { ...prev, score: newScore } : null);
        // Also update finalScore state if needed immediately, though it's mainly for completion screen
        // setFinalScore(newScore); // Or update this only on completion

        // --- Async DB Recording (from current context) ---
        try {
            const { error: recordError } = await supabaseAdmin
                .from('vpr_attempt_answers')
                .insert({
                    attempt_id: currentAttempt.id,
                    question_id: questions[currentQuestionIndex].id,
                    selected_answer_id: selectedAnswer.id,
                    was_correct: correct,
                });
            // Handle potential unique constraint violation (user re-answering somehow)
            if (recordError && recordError.code !== '23505') {
                 throw recordError;
            }
            debugLogger.log("Ответ записан:", { questionId: questions[currentQuestionIndex].id, correct });

            // It's often better to update the attempt score *after* recording the answer
            // This prevents score mismatch if the DB write fails, but makes UI feel slower.
            // Choose based on preference. The code above updates client state first.
            // Alternative: Update attempt score *here* in DB after recording answer
            /*
            const { error: updateScoreError } = await supabaseAdmin
                .from('vpr_test_attempts')
                .update({ score: newScore })
                .eq('id', currentAttempt.id);
            if (updateScoreError) throw updateScoreError;
            */

        } catch (err) {
            debugLogger.error("Ошибка записи ответа или обновления счета в БД:", err);
            toast.error("Не удалось сохранить ваш ответ. Результат может быть неточным.");
            // Optionally revert client-side score update if DB fails?
            // setCurrentAttempt(prev => prev ? { ...prev, score: (prev.score || 0) - scoreIncrement } : null);
        }
    };
    // --- End Answer Handling ---


    // --- Navigation Logic (merged from current context + new timer logic) ---
    const handleNextQuestion = async (/* timeUp = false - removed */) => {
        if (!currentAttempt || isLoading) return;

        const nextIndex = currentQuestionIndex + 1;
        const isFinishing = nextIndex >= questions.length;

        // --- UI Updates (from current context + new) ---
        setShowFeedback(false); // Скрываем обратную связь
        setSelectedAnswerId(null);

        if (!isFinishing) {
            setCurrentQuestionIndex(nextIndex);
            // setTimerKey(Date.now()); // Removed as per new version comment (timer is per test)
            setIsTimerRunning(true); // !!! Запускаем таймер снова для следующего вопроса !!! (New)
        } else {
            setIsTimerRunning(false); // Таймер больше не нужен (New)
        }
        // --- End UI Updates ---

        // --- Async DB Updates (from current context) ---
        try {
            const updates: Partial<VprTestAttempt> = isFinishing
                ? {
                      last_question_index: questions.length,
                      completed_at: new Date().toISOString(),
                      score: currentAttempt.score || 0 // Use the latest client-side score
                  }
                : { last_question_index: nextIndex };

            const { data: updatedAttempt, error: updateError } = await supabaseAdmin
                .from('vpr_test_attempts')
                .update(updates)
                .eq('id', currentAttempt.id)
                .select() // Select the updated row
                .single(); // Expect a single row back

            if (updateError) throw updateError;
            if (!updatedAttempt) throw new Error("Attempt not found after update.");

            // Update client state with the confirmed data from DB
            setCurrentAttempt(updatedAttempt);

            if (isFinishing) {
                 // --- Completion State Update (from current context + new) ---
                 setIsTestComplete(true);
                 setFinalScore(updatedAttempt.score ?? 0); // Use score from DB response
                 debugLogger.log("Тест завершен в БД. Финальный счет:", updatedAttempt.score);
                 toast.success("Тест завершен!", { duration: 4000 }); // Added notification
            } else {
                 debugLogger.log("Переход к вопросу:", nextIndex + 1);
            }

        } catch(err) {
            debugLogger.error("Ошибка обновления попытки при переходе:", err);
            setError("Не удалось сохранить прогресс. Попробуйте обновить страницу.");
            toast.error("Ошибка сохранения прогресса.");
            // Maybe revert UI changes?
            // if (!isFinishing) setCurrentQuestionIndex(currentQuestionIndex);
            // setIsTimerRunning(false); // Stop timer on error?
        }
        // --- End Async DB Updates ---
    };
    // --- End Navigation Logic ---


    // --- Reset Logic (merged from current context + new timer logic) ---
    const resetTest = () => {
         if (!user?.id || !subjectId) return;
         setIsLoading(true); // Show loading indicator during reset
         // --- Reset States (from current context + new) ---
         setCurrentAttempt(null);
         setIsTestComplete(false);
         setShowFeedback(false);
         setSelectedAnswerId(null);
         setFinalScore(0);
         setCurrentQuestionIndex(0);
         setError(null);
         setIsTimerRunning(false); // Убедиться, что таймер остановлен (New)
         setTimerKey(Date.now()); // Сбросить ключ (New)
         setTimeUpModal(false); // (New)
         setShowDescription(false); // (New)
         // --- End Reset States ---

          // Force re-fetch via useEffect dependency change (from current context/new version)
          if (typeof window !== "undefined") {
              router.replace(`/vpr-test/${subjectId}?reset=${Date.now()}`);
          }
          // No need to call initializeTest directly, the route change triggers useEffect
     };
    // --- End Reset Logic ---


    // --- Rendering Logic ---

    // --- Loading State (from current context) ---
    if (isLoading) {
        return (
            <div className="min-h-screen bg-dark-bg flex items-center justify-center"> {/* Dark bg */}
                <Loader2 className="h-12 w-12 animate-spin text-brand-blue" /> {/* Brand color */}
                <span className="ml-4 text-lg text-light-text">Загрузка теста...</span> {/* Light text */}
            </div>
        );
    }

    // --- Error State (from current context, styled for dark theme) ---
    if (error) {
        return (
            <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4"> {/* Dark bg */}
                <div className="bg-dark-card rounded-lg shadow-xl p-6 text-center max-w-md border border-red-500/50"> {/* Dark card */}
                    <XCircle className="h-12 w-12 text-brand-pink mx-auto mb-4" /> {/* Brand color */}
                    <h2 className="text-xl font-semibold text-brand-pink mb-2">Ошибка</h2>
                    <p className="text-light-text/80 mb-4">{error}</p> {/* Light text */}
                    <button
                        onClick={() => window.location.reload()} // Simple reload for now
                        className="bg-brand-pink text-white px-4 py-2 rounded hover:bg-brand-pink/80 transition-colors" // Brand color button
                    >
                        Обновить страницу
                    </button>
                </div>
            </div>
        );
    }

    // --- Test Completion Screen (from new version) ---
    if (isTestComplete) {
        const percentage = questions.length > 0 ? ((finalScore / questions.length) * 100).toFixed(0) : 0;
        const resultColor = parseInt(percentage) >= 80 ? 'text-green-500' : parseInt(percentage) >= 50 ? 'text-yellow-500' : 'text-red-500';
        const resultBg = parseInt(percentage) >= 80 ? 'bg-green-900/30' : parseInt(percentage) >= 50 ? 'bg-yellow-900/30' : 'bg-red-900/30'; // Darker bg for dark theme

        return (
            <div className="min-h-screen bg-gradient-to-br from-dark-bg to-dark-card flex items-center justify-center p-4"> {/* Dark gradient bg */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    // Use dark card styling for completion card
                    className="bg-dark-card rounded-xl shadow-xl p-6 md:p-10 text-center max-w-md w-full border-t-4 border-brand-green"
                >
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    >
                         {/* Use CheckCircle, maybe change color based on result */}
                         <CheckCircle className={`h-16 w-16 ${parseInt(percentage) >= 50 ? 'text-brand-green' : 'text-yellow-500'} mx-auto mb-5`} />
                    </motion.div>

                    <h2 className="text-2xl md:text-3xl font-bold text-light-text mb-3">Тест "{subject?.name}" завершен!</h2> {/* Light text */}
                    <p className={`text-xl md:text-2xl font-semibold mb-6 p-3 rounded-lg ${resultBg} ${resultColor}`}>
                        {finalScore} из {questions.length} ({percentage}%)
                    </p>
                    <div className="space-y-4">
                         <button
                            onClick={resetTest}
                            // Updated button styles from new version
                            className="w-full bg-brand-blue text-white px-6 py-3 rounded-lg font-semibold text-lg hover:bg-brand-blue/80 transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                        >
                            <RotateCcw className="h-5 w-5" />
                            Пройти еще раз
                        </button>
                         <button
                            onClick={() => router.push('/vpr-tests')}
                            // Updated button styles from new version
                            className="w-full bg-gray-600 text-light-text/90 px-6 py-3 rounded-lg font-semibold text-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2" // Darker gray button
                        >
                             <BookOpen className="h-5 w-5" />
                            К списку тестов
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }
    // --- End Test Completion Screen ---


    // --- Main Test Screen (structure from current context, styles/components from new version) ---
    const currentQuestionData = questions[currentQuestionIndex];
    const answersForCurrent = currentQuestionData?.vpr_answers || [];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            // Use dark page gradient from new version
            className="min-h-screen bg-page-gradient text-light-text flex flex-col items-center pt-6 pb-10 px-4"
        >
            {/* Time Up Modal (from new version) */}
            <AnimatePresence>
                {timeUpModal && (
                    <motion.div
                         className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                         initial={{ opacity: 0 }}
                         animate={{ opacity: 1 }}
                         exit={{ opacity: 0 }}
                    >
                         <motion.div
                             // Dark theme styling for modal
                             className="bg-dark-card p-6 rounded-lg shadow-xl text-center max-w-sm border-t-4 border-brand-pink text-light-text"
                             initial={{ scale: 0.7, opacity: 0 }}
                             animate={{ scale: 1, opacity: 1 }}
                             transition={{ type: 'spring' }}
                        >
                             <AlertTriangle className="h-12 w-12 text-brand-pink mx-auto mb-4" />
                             <h3 className="text-xl font-bold text-light-text mb-2">Время вышло!</h3>
                             <p className="text-light-text/80 mb-5">К сожалению, время, отведенное на тест, истекло.</p>
                             <button
                                 onClick={completeTestDueToTime}
                                 // Brand colored button
                                 className="w-full bg-brand-pink text-white px-4 py-2 rounded-md font-semibold hover:bg-brand-pink/80 transition-colors"
                            >
                                 Посмотреть результаты
                             </button>
                         </motion.div>
                    </motion.div>
                 )}
             </AnimatePresence>

            {/* Main test container (dark card styling from new version) */}
            <div className="max-w-3xl w-full bg-dark-card shadow-xl rounded-2xl p-5 md:p-8 flex-grow flex flex-col border border-brand-blue/20">

                {/* Header: Title, Info, Timer (layout from new version) */}
                <div className="flex flex-col sm:flex-row justify-between items-center mb-5 gap-3">
                     <div className="text-center sm:text-left">
                        {/* Brand color title */}
                        <h1 className="text-xl md:text-2xl font-bold text-brand-green">{subject?.name}</h1>
                    </div>
                     <div className="flex items-center gap-3">
                         {/* Info Button (styling from new version) */}
                         {subject?.description && (
                              <button
                                 onClick={() => setShowDescription(!showDescription)}
                                 // Dark theme button style
                                 className="text-brand-blue hover:text-brand-blue/80 p-1.5 rounded-full bg-dark-bg/50 hover:bg-dark-bg transition-colors"
                                 title={showDescription ? "Скрыть описание" : "Показать описание"}
                              >
                                 <Info className="h-5 w-5" />
                             </button>
                         )}
                         {/* Timer Component (from new version) */}
                         <TimerDisplay
                             key={timerKey} // Re-renders on key change (e.g., reset)
                             initialTime={timeLimit} // Use the state variable
                             onTimeUp={handleTimeUp}
                             // Only run timer if test isn't loading, complete, showing feedback, or time is up
                             isRunning={isTimerRunning && !isLoading && !isTestComplete && !showFeedback && !timeUpModal}
                         />
                    </div>
                </div>

                {/* Description Dropdown (structure from current context, styling from new version) */}
                <AnimatePresence>
                    {showDescription && subject?.description && (
                         <motion.div
                            initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                            animate={{ height: 'auto', opacity: 1, marginBottom: '1.5rem' }} // mb-6
                            exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden"
                         >
                             {/* Dark theme prose styling */}
                             <div className="p-4 bg-dark-bg rounded-lg border border-brand-purple/30 prose prose-sm md:prose-base max-w-none prose-invert">
                                 <ReactMarkdown>{subject.description}</ReactMarkdown>
                             </div>
                         </motion.div>
                     )}
                 </AnimatePresence>


                {/* Progress Indicator (using updated component) */}
                <VprProgressIndicator current={currentQuestionIndex} total={questions.length} />

                {/* Question Display (using updated component) */}
                 <QuestionDisplay
                     questionText={currentQuestionData?.text}
                     questionNumber={currentQuestionIndex + 1}
                     totalQuestions={questions.length}
                 />

                {/* Answer Options (using updated component, mapping logic from current context) */}
                <div className="space-y-3 mb-6">
                     {answersForCurrent.map((answer) => {
                         const isSelected = answer.id === selectedAnswerId;
                         // Logic to show correctness/incorrectness based on feedback state (from current context)
                         const showCorrectness = showFeedback && answer.is_correct;
                         const showIncorrectness = showFeedback && isSelected && !answer.is_correct;

                         return (
                             <AnswerOption
                                 key={answer.id}
                                 answer={answer}
                                 isSelected={isSelected}
                                 showCorrectness={showCorrectness} // Pass calculated value
                                 showIncorrectness={showIncorrectness} // Pass calculated value
                                 isDisabled={showFeedback || timeUpModal} // Disable if feedback shown OR time is up
                                 onClick={handleAnswer}
                             />
                         );
                     })}
                 </div>


                {/* Explanation and Next Button (using updated component, presence from current context) */}
                 <AnimatePresence>
                     {showFeedback && (
                         <ExplanationDisplay
                             explanation={feedbackExplanation}
                             isCorrect={isCorrect} // Pass the state variable
                             onNext={handleNextQuestion}
                             isLastQuestion={currentQuestionIndex >= questions.length - 1}
                         />
                     )}
                 </AnimatePresence>

                 {/* Optional Reset Button (from current context, commented out) */}
                 {/* <button onClick={resetTest} className="mt-8 text-xs text-gray-400 underline">Сбросить тест</button> */}

            </div>
        </motion.div>
    );
}