"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Loader2 } from "lucide-react";
import { supabaseAdmin } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
import { debugLogger } from "@/lib/debugLogger";
import { useParams, useRouter } from 'next/navigation';

// Import VPR components
import { VprProgressIndicator } from "@/components/VprProgressIndicator";
import { ExplanationDisplay } from "@/components/ExplanationDisplay";
import { VprLoadingIndicator } from "@/components/vpr/VprLoadingIndicator";
import { VprErrorDisplay } from "@/components/vpr/VprErrorDisplay";
import { VprCompletionScreen } from "@/components/vpr/VprCompletionScreen";
import { VprHeader } from "@/components/vpr/VprHeader";
import { VprDescription } from "@/components/vpr/VprDescription";
import { VprQuestionContent } from "@/components/vpr/VprQuestionContent";
import { VprAnswerList } from "@/components/vpr/VprAnswerList";
import { VprTimeUpModal } from "@/components/vpr/VprTimeUpModal";

import { toast } from "sonner";

// --- Interfaces ---
interface SubjectData {
    id: number;
    name: string;
    description?: string;
}

interface VprQuestionData {
    id: number;
    subject_id: number;
    variant_number: number;
    text: string;
    explanation?: string;
    position: number;
    vpr_answers: VprAnswerData[];
}

export interface VprAnswerData {
    id: number;
    question_id: number;
    text: string;
    is_correct: boolean;
}

interface VprTestAttempt {
    id: string;
    user_id: string;
    subject_id: number;
    variant_number: number;
    started_at: string;
    completed_at?: string;
    score?: number;
    total_questions: number;
    last_question_index: number;
}
// --- End Interfaces ---

// TODO: Implement logic to select or pass variant dynamically if needed
// Hardcoding variant for now
const CURRENT_VARIANT_TO_LOAD = 1;

export default function VprTestPage() {
    // --- States ---
    const { user } = useAppContext();
    const params = useParams();
    const router = useRouter();
    const subjectId = parseInt(params.subjectId as string, 10);
    const variantNumber = CURRENT_VARIANT_TO_LOAD; // Use the selected variant

    const [subject, setSubject] = useState<SubjectData | null>(null);
    const [questions, setQuestions] = useState<VprQuestionData[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [currentAttempt, setCurrentAttempt] = useState<VprTestAttempt | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedAnswerId, setSelectedAnswerId] = useState<number | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [feedbackExplanation, setFeedbackExplanation] = useState<string | null>(null);
    const [isTestComplete, setIsTestComplete] = useState(false);
    const [finalScore, setFinalScore] = useState<number>(0);
    const [showDescription, setShowDescription] = useState(false);
    const [timerKey, setTimerKey] = useState(Date.now());
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [timeLimit] = useState(3600);
    const [timeUpModal, setTimeUpModal] = useState(false);
    const [isCurrentQuestionNonAnswerable, setIsCurrentQuestionNonAnswerable] = useState(false);
    const [resetCounter, setResetCounter] = useState(0); // <<< New state for forcing reset effect

    // --- Timer Functions (Unchanged) ---
    const handleTimeUp = useCallback(() => {
        debugLogger.log("Timer: Time is up!");
        if (!isTestComplete && !timeUpModal) {
            setIsTimerRunning(false);
            setShowFeedback(false);
            setTimeUpModal(true);
        }
    }, [isTestComplete, timeUpModal]);

    const completeTestDueToTime = useCallback(async () => {
         setTimeUpModal(false);
         if (!currentAttempt || isSaving || isTestComplete) return;
         debugLogger.log("Completing test due to time up for attempt:", currentAttempt.id);
         setIsSaving(true);
         try {
             const currentScore = currentAttempt.score || 0;
             const updates: Partial<VprTestAttempt> = {
                 last_question_index: questions.length,
                 completed_at: new Date().toISOString(),
                 score: currentScore
             };
             const { data: updatedAttempt, error: updateError } = await supabaseAdmin
                 .from('vpr_test_attempts')
                 .update(updates)
                 .eq('id', currentAttempt.id)
                 .select()
                 .single();
              if (updateError) throw updateError;
              if (!updatedAttempt) throw new Error("Attempt not found after forced completion update.");
              setCurrentAttempt(updatedAttempt);
              setIsTestComplete(true);
              setFinalScore(updatedAttempt.score ?? 0);
              toast.warning("Время вышло! Тест завершен.", { duration: 5000 });
         } catch (err: any) {
             debugLogger.error("Error forcing test completion:", err);
             setError(`Не удалось завершить тест (${err.message || 'Неизвестная ошибка'}). Попробуйте обновить страницу.`);
         } finally {
            setIsSaving(false);
         }
    }, [currentAttempt, isSaving, isTestComplete, questions.length]);
    // --- End Timer Functions ---


    // --- Data Fetching & Attempt Handling ---
    useEffect(() => {
        debugLogger.log(`useEffect running. Reset Counter: ${resetCounter}`); // Log effect trigger

        // Basic validation
        if (!user?.id || !subjectId || isNaN(subjectId) || !variantNumber || isNaN(variantNumber)) {
            if (!user?.id) router.push('/login');
            else setError("Неверный ID предмета или номер варианта");
            setIsLoading(false);
            return;
        }

        debugLogger.log(`Initializing test for Subject ID: ${subjectId}, Variant: ${variantNumber}`);
        let isMounted = true;

        const initializeTest = async () => {
            if (!isMounted) {
                debugLogger.log("InitializeTest aborted: component unmounted.");
                return;
            }
            debugLogger.log("InitializeTest starting...");
            setIsLoading(true);
            setError(null);
            // Reset states...
            setShowDescription(false);
            setIsTestComplete(false);
            setShowFeedback(false);
            setSelectedAnswerId(null);
            setIsTimerRunning(false);
            setTimerKey(Date.now());
            setTimeUpModal(false);
            setIsCorrect(false);
            setFeedbackExplanation(null);
            setFinalScore(0);
            setCurrentQuestionIndex(0);
            setCurrentAttempt(null); // Clear previous attempt state *before* fetching
            setQuestions([]);
            setIsCurrentQuestionNonAnswerable(false);

            try {
                // Fetch Subject
                debugLogger.log("Fetching subject data...");
                const { data: subjectData, error: subjectError } = await supabaseAdmin
                    .from('subjects')
                    .select('*')
                    .eq('id', subjectId)
                    .single();
                if (!isMounted) return;
                if (subjectError) throw new Error(`Ошибка загрузки предмета: ${subjectError.message}`);
                if (!subjectData) throw new Error('Предмет не найден');
                setSubject(subjectData);
                debugLogger.log("Subject data loaded:", subjectData.name);

                // Fetch Questions
                debugLogger.log(`Fetching questions for variant ${variantNumber}...`);
                const { data: questionData, error: questionError } = await supabaseAdmin
                    .from('vpr_questions')
                    .select(`*, vpr_answers ( * )`)
                    .eq('subject_id', subjectId)
                    .eq('variant_number', variantNumber)
                    .order('position', { ascending: true });
                if (!isMounted) return;
                if (questionError) throw new Error(`Ошибка загрузки вопросов: ${questionError.message}`);
                if (!questionData || questionData.length === 0) throw new Error(`Вопросы для варианта ${variantNumber} не найдены`);
                setQuestions(questionData);
                debugLogger.log(`Loaded ${questionData.length} questions.`);

                // Find Active Attempt
                debugLogger.log("Finding active test attempt...");
                const { data: existingAttempts, error: attemptError } = await supabaseAdmin
                    .from('vpr_test_attempts')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('subject_id', subjectId)
                    .eq('variant_number', variantNumber)
                    .is('completed_at', null)
                    .order('started_at', { ascending: false })
                    .limit(1);
                 if (!isMounted) return;
                 if (attemptError) throw new Error(`Ошибка поиска попытки: ${attemptError.message}`);

                let attemptToUse: VprTestAttempt | null = null;

                if (existingAttempts && existingAttempts.length > 0) {
                    const potentialAttempt = existingAttempts[0];
                    if (potentialAttempt.total_questions !== questionData.length) {
                        debugLogger.warn("Question count mismatch. Active attempt outdated. Will create new one.");
                        // Attempt to delete the outdated attempt - best effort
                         try {
                            debugLogger.log(`Attempting to delete outdated attempt ID: ${potentialAttempt.id}`);
                             await supabaseAdmin.from('vpr_test_attempts').delete().eq('id', potentialAttempt.id);
                         } catch (deleteErr) {
                             debugLogger.error("Failed to delete outdated attempt:", deleteErr);
                         }
                    } else {
                        attemptToUse = potentialAttempt;
                        debugLogger.log(`Resuming active attempt ID: ${attemptToUse.id}, Last Index: ${attemptToUse.last_question_index}`);
                        setFinalScore(attemptToUse.score || 0);
                    }
                } else {
                    debugLogger.log("No active attempt found in DB.");
                }

                // Create new attempt if needed
                if (!attemptToUse) {
                     debugLogger.log("Creating new attempt.");
                     const { data: newAttemptData, error: newAttemptError } = await createNewAttempt(user.id, subjectId, variantNumber, questionData.length);
                     if (!isMounted) return;
                     if (newAttemptError || !newAttemptData) throw newAttemptError || new Error('Не удалось создать новую попытку');
                     attemptToUse = newAttemptData;
                     debugLogger.log(`New attempt created ID: ${attemptToUse.id}`);
                     setFinalScore(0);
                }

                // Set state for the loaded/created attempt
                setCurrentAttempt(attemptToUse);
                const resumeIndex = Math.max(0, Math.min(attemptToUse.last_question_index, questionData.length - 1));
                setCurrentQuestionIndex(resumeIndex);
                debugLogger.log(`Setting current question index to: ${resumeIndex}`);

                // Check non-answerable status
                const currentQ = questionData[resumeIndex];
                const currentAnswers = currentQ?.vpr_answers || [];
                const isNonAnswerable = currentAnswers.length > 0 && currentAnswers.every(a => /^\[(Рисунок|Ввод текста|Диаграмма|Изображение|Площадь)\].*/.test(a.text));
                setIsCurrentQuestionNonAnswerable(isNonAnswerable);
                debugLogger.log(`Is current question (${resumeIndex}) non-answerable? ${isNonAnswerable}`);

                // Start Timer
                debugLogger.log("Attempt is active. Starting timer.");
                setIsTimerRunning(true);

            } catch (err: any) {
                if (!isMounted) return;
                debugLogger.error("Error during test initialization:", err);
                setError(err.message || 'Произошла ошибка при загрузке теста');
                setIsTimerRunning(false);
            } finally {
                 if (isMounted) {
                    setIsLoading(false);
                    debugLogger.log("InitializeTest finished.");
                 }
            }
        };

        // Helper to create attempt
        const createNewAttempt = async (userId: string, subjId: number, variantNum: number, totalQ: number) => {
             debugLogger.log(`Helper: Creating new attempt for user ${userId}, subject ${subjId}, variant ${variantNum}, totalQ ${totalQ}`);
             return await supabaseAdmin
                 .from('vpr_test_attempts')
                 .insert({ userId, subject_id: subjId, variant_number: variantNum, total_questions: totalQ, last_question_index: 0, score: 0 })
                 .select()
                 .single();
         };

        initializeTest();

        // Cleanup function
        return () => {
            isMounted = false;
            debugLogger.log("useEffect cleanup: component unmounting or dependencies changed.");
        };
     // Add resetCounter to dependencies to force re-run on reset
     }, [user, subjectId, variantNumber, resetCounter]); // router removed, not used directly in effect now
    // --- End Data Fetching ---


    // --- Answer Handling (Unchanged) ---
    const handleAnswer = useCallback(async (selectedAnswer: VprAnswerData) => {
        if (!currentAttempt || showFeedback || isTestComplete || isSaving || !isTimerRunning || timeUpModal || !questions[currentQuestionIndex]) return;
        debugLogger.log(`Handling answer selection: Answer ID ${selectedAnswer.id} for Question ID ${questions[currentQuestionIndex].id}`);
        setIsTimerRunning(false);
        setIsSaving(true);
        setSelectedAnswerId(selectedAnswer.id);
        const correct = selectedAnswer.is_correct;
        setIsCorrect(correct);
        setFeedbackExplanation(questions[currentQuestionIndex]?.explanation || "Объяснение отсутствует.");
        setShowFeedback(true);
        const scoreIncrement = correct ? 1 : 0;
        const newScore = (currentAttempt.score || 0) + scoreIncrement;
        debugLogger.log(`Answer Correct: ${correct}. Proposed Score: ${newScore}`);
        try {
            debugLogger.log("Recording answer to DB...");
            const { error: recordError } = await supabaseAdmin.from('vpr_attempt_answers').insert({ attempt_id: currentAttempt.id, question_id: questions[currentQuestionIndex].id, selected_answer_id: selectedAnswer.id, was_correct: correct });
            if (recordError && recordError.code !== '23505') throw new Error(`Ошибка записи ответа: ${recordError.message}`);
            if (recordError?.code === '23505') debugLogger.warn("Attempt answer already recorded."); else debugLogger.log("Answer recorded successfully.");
            debugLogger.log("Updating attempt score in DB...");
            const { data: updatedData, error: updateScoreError } = await supabaseAdmin.from('vpr_test_attempts').update({ score: newScore }).eq('id', currentAttempt.id).select().single();
            if (updateScoreError) throw new Error(`Ошибка обновления счета: ${updateScoreError.message}`);
            if (!updatedData) throw new Error("Attempt data not returned after score update.");
            setCurrentAttempt(updatedData); // Update local state with confirmed score
            debugLogger.log("Attempt score updated successfully.");
        } catch (err: any) {
            debugLogger.error("Error saving answer/score:", err);
            toast.error(`Не удалось сохранить результат: ${err.message}`);
        } finally {
             setIsSaving(false);
        }
    }, [currentAttempt, showFeedback, isTestComplete, isSaving, isTimerRunning, timeUpModal, questions, currentQuestionIndex]);
    // --- End Answer Handling ---


    // --- Navigation Logic (Unchanged) ---
    const handleNextQuestion = useCallback(async (isSkip: boolean = false) => {
        if (!currentAttempt || isSaving || isTestComplete || timeUpModal || !questions.length) return;
        const currentQIndex = currentQuestionIndex;
        const nextIndex = currentQIndex + 1;
        const isFinishing = nextIndex >= questions.length;
        debugLogger.log(`Handling next question. From: ${currentQIndex}, To: ${nextIndex}, Finishing: ${isFinishing}, Skip: ${isSkip}`);
        setIsSaving(true);
        setShowFeedback(false); setSelectedAnswerId(null); setIsCorrect(false); setFeedbackExplanation(null);
        let nextIsNonAnswerable = false;
        if (!isFinishing) {
            const nextQ = questions[nextIndex]; const nextAnswers = nextQ?.vpr_answers || [];
            nextIsNonAnswerable = nextAnswers.length > 0 && nextAnswers.every(a => /^\[(Рисунок|Ввод текста|Диаграмма|Изображение|Площадь)\].*/.test(a.text));
            debugLogger.log(`Next question (${nextIndex}) non-answerable? ${nextIsNonAnswerable}`);
        }
        try {
            const updates: Partial<VprTestAttempt> = isFinishing ? { last_question_index: questions.length, completed_at: new Date().toISOString() } : { last_question_index: nextIndex };
            debugLogger.log(`Updating attempt progress/completion in DB to index: ${updates.last_question_index}`);
            const { data: updatedAttempt, error: updateError } = await supabaseAdmin.from('vpr_test_attempts').update(updates).eq('id', currentAttempt.id).select().single();
            if (updateError) throw new Error(`Ошибка обновления прогресса: ${updateError.message}`);
            if (!updatedAttempt) throw new Error("Attempt not found after update.");
            setCurrentAttempt(updatedAttempt); // Update with DB data *first*
            if (!isFinishing) {
                setCurrentQuestionIndex(nextIndex);
                setIsCurrentQuestionNonAnswerable(nextIsNonAnswerable);
                setIsTimerRunning(true);
                debugLogger.log(`Moved to question index: ${nextIndex}. Timer restarted.`);
            } else {
                setIsCurrentQuestionNonAnswerable(false);
                setIsTimerRunning(false);
                setIsTestComplete(true);
                setFinalScore(updatedAttempt.score ?? 0);
                debugLogger.log("Test marked as complete. Final Score from DB:", updatedAttempt.score);
                toast.success("Тест завершен!", { duration: 4000 });
            }
        } catch(err: any) {
            debugLogger.error("Error updating attempt on navigation:", err);
            setError(`Не удалось сохранить прогресс (${err.message}). Попробуйте обновить страницу.`);
            toast.error("Ошибка сохранения прогресса.");
            if (!isFinishing) setIsTimerRunning(false); // Stop timer if nav failed
        } finally {
            setIsSaving(false);
        }
    }, [currentAttempt, isSaving, isTestComplete, timeUpModal, questions, currentQuestionIndex]);
    // --- End Navigation Logic ---


    // --- Reset Logic ---
     const resetTest = useCallback(async () => {
         if (isSaving) { // Prevent reset during save
             toast.warning("Подождите, идет сохранение...");
             return;
         }
         debugLogger.log("Reset button clicked.");
         setIsLoading(true); // Show full loading indicator

         try {
             // Stop the timer immediately
             setIsTimerRunning(false);

             // Attempt to delete the currently loaded ACTIVE attempt
             if (currentAttempt && !currentAttempt.completed_at) {
                 debugLogger.log(`Attempting to delete active attempt ID: ${currentAttempt.id} before reset.`);
                 const { error: deleteError } = await supabaseAdmin
                     .from('vpr_test_attempts')
                     .delete()
                     .eq('id', currentAttempt.id)
                     .is('completed_at', null);

                 if (deleteError) {
                     debugLogger.error("Error deleting active attempt during reset:", deleteError);
                     toast.error("Не удалось корректно сбросить предыдущую попытку.");
                 } else {
                      debugLogger.log("Active attempt deleted successfully.");
                 }
             } else {
                 debugLogger.log("No active attempt loaded or it was already completed. Skipping delete.");
             }

             // Clear sensitive local state *before* triggering re-fetch
             setCurrentAttempt(null);
             setQuestions([]); // Clear questions
             setCurrentQuestionIndex(0);
             setError(null);
             // other state resets can happen inside useEffect on re-run

             toast.info("Сброс теста...", { duration: 1500});
             // Increment the counter to explicitly trigger the useEffect hook
             setResetCounter(prev => prev + 1);
             debugLogger.log("Reset counter incremented, useEffect will re-run.");

         } catch (err: any) {
              debugLogger.error("Error during reset process:", err);
              setError(`Ошибка сброса теста: ${err.message}`);
              setIsLoading(false); // Ensure loading stops on error
         }
         // setIsLoading(true) remains active, useEffect will set it to false when done re-initializing.
     }, [isSaving, currentAttempt]); // Removed user/subject/variant - they don't change
    // --- End Reset Logic ---


    // --- Rendering Logic (Unchanged structure, uses updated state/props) ---
    if (isLoading) return <VprLoadingIndicator />; // Show full loader during initial load & reset
    if (error) return <VprErrorDisplay error={error} onRetry={resetTest} />;
    if (isTestComplete) {
        return ( <VprCompletionScreen subjectName={subject?.name} finalScore={finalScore} totalQuestions={questions.length} onReset={resetTest} onGoToList={() => router.push('/vpr-tests')} /> );
    }
    if (!currentAttempt || questions.length === 0) {
         return <VprErrorDisplay error="Данные теста не загружены. Попробуйте сбросить." onRetry={resetTest} />;
    }

    const currentQuestionData = questions[currentQuestionIndex];
    const answersForCurrent = currentQuestionData?.vpr_answers || [];
    const showSavingOverlay = isSaving; // Use the dedicated saving state

    return (
        <motion.div key={currentAttempt.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-page-gradient text-light-text flex flex-col items-center pt-6 pb-10 px-4">
            <VprTimeUpModal show={timeUpModal} onConfirm={completeTestDueToTime} />
            <div className="max-w-3xl w-full bg-dark-card shadow-xl rounded-2xl p-5 md:p-8 flex-grow flex flex-col border border-brand-blue/20 relative">
                 {showSavingOverlay && ( <div className="absolute inset-0 bg-dark-card/80 backdrop-blur-sm flex items-center justify-center z-40 rounded-2xl"> <Loader2 className="h-8 w-8 animate-spin text-brand-blue" /> <span className="ml-3 text-light-text">Сохранение...</span> </div> )}
                <VprHeader subjectName={subject?.name} showDescriptionButton={!!subject?.description} isDescriptionShown={showDescription} onToggleDescription={() => setShowDescription(!showDescription)} timerKey={timerKey} timeLimit={timeLimit} onTimeUp={handleTimeUp} isTimerRunning={isTimerRunning && !isSaving && !isTestComplete && !showFeedback && !timeUpModal} />
                <VprDescription description={subject?.description} show={showDescription} />
                <VprProgressIndicator current={currentQuestionIndex} total={questions.length} />
                <VprQuestionContent questionText={currentQuestionData?.text} questionNumber={currentQuestionIndex + 1} totalQuestions={questions.length} />
                <VprAnswerList answers={answersForCurrent} selectedAnswerId={selectedAnswerId} showFeedback={showFeedback} timeUpModal={timeUpModal} handleAnswer={handleAnswer} />
                 {isCurrentQuestionNonAnswerable && !showFeedback && !isTestComplete && !timeUpModal && (
                     <div className="mt-4 text-center"> <button onClick={() => handleNextQuestion(true)} disabled={isSaving} className="bg-brand-purple text-white px-6 py-2 rounded-lg font-semibold hover:bg-brand-purple/80 transition-colors disabled:opacity-50 disabled:cursor-wait"> Пропустить / Далее </button> <p className="text-xs text-gray-400 mt-2">Этот вопрос требует рисунка, ввода текста или анализа изображения.</p> </div>
                 )}
                 <AnimatePresence> {showFeedback && ( <ExplanationDisplay explanation={feedbackExplanation} isCorrect={isCorrect} onNext={() => handleNextQuestion(false)} isLastQuestion={currentQuestionIndex >= questions.length - 1} /> )} </AnimatePresence>
                <div className="mt-auto pt-6 text-center"> <button onClick={resetTest} disabled={isSaving || isLoading} className="text-xs text-gray-500 hover:text-brand-pink underline transition-colors flex items-center justify-center gap-1 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"> <RotateCcw className="h-3 w-3"/> Сбросить и начать заново </button> </div>
            </div>
        </motion.div>
    );
}