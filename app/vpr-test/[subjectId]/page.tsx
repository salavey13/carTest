"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { supabaseAdmin } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
import { debugLogger } from "@/lib/debugLogger";
import { useParams, useRouter } from 'next/navigation';

// Import VPR components from their new location
import { VprProgressIndicator } from "@/components/VprProgressIndicator";
import { ExplanationDisplay } from "@/components/ExplanationDisplay"; // Assuming this is correctly placed
import { VprLoadingIndicator } from "@/components/vpr/VprLoadingIndicator";
import { VprErrorDisplay } from "@/components/vpr/VprErrorDisplay";
import { VprCompletionScreen } from "@/components/vpr/VprCompletionScreen";
import { VprHeader } from "@/components/vpr/VprHeader";
import { VprDescription } from "@/components/vpr/VprDescription";
import { VprQuestionContent } from "@/components/vpr/VprQuestionContent";
import { VprAnswerList } from "@/components/vpr/VprAnswerList";
import { VprTimeUpModal } from "@/components/vpr/VprTimeUpModal";

import { toast } from "sonner";

// --- Interfaces (Keep VprAnswerData export if needed elsewhere, or move definition) ---
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
    vpr_answers: VprAnswerData[]; // Uses VprAnswerData defined below
}

// If AnswerOption or other components need this type, keep it exported
// Otherwise, it could be defined only within this file.
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

// --- Default Variant ---
const DEFAULT_VARIANT = 1;

export default function VprTestPage() {
    // --- States ---
    const { user } = useAppContext();
    const params = useParams();
    const router = useRouter();
    const subjectId = parseInt(params.subjectId as string, 10);
    const variantNumber = DEFAULT_VARIANT;

    const [subject, setSubject] = useState<SubjectData | null>(null);
    const [questions, setQuestions] = useState<VprQuestionData[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [currentAttempt, setCurrentAttempt] = useState<VprTestAttempt | null>(null);
    const [isLoading, setIsLoading] = useState(true);
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
    const [timeLimit] = useState(3600); // 60 minutes = 3600 seconds
    const [timeUpModal, setTimeUpModal] = useState(false);
    // --- End States ---


    // --- Timer Functions ---
    const handleTimeUp = useCallback(() => {
        debugLogger.log("Timer: Time is up!");
        if (!isTestComplete && !timeUpModal) { // Prevent multiple triggers
            setIsTimerRunning(false);
            setShowFeedback(false); // Hide any active feedback
            setTimeUpModal(true);
        }
    }, [isTestComplete, timeUpModal]); // Add dependencies

    const completeTestDueToTime = useCallback(async () => {
         setTimeUpModal(false);
         if (!currentAttempt || isLoading || isTestComplete) return; // Add guards
         debugLogger.log("Completing test due to time up for attempt:", currentAttempt.id);
         setIsLoading(true);
         try {
             const currentScore = currentAttempt.score || 0;
             const updates: Partial<VprTestAttempt> = {
                 last_question_index: questions.length, // Mark all questions as "seen"
                 completed_at: new Date().toISOString(),
                 score: currentScore // Persist score calculated so far
             };
             const { data: updatedAttempt, error: updateError } = await supabaseAdmin
                 .from('vpr_test_attempts')
                 .update(updates)
                 .eq('id', currentAttempt.id)
                 .select() // Select to get updated data
                 .single();

              if (updateError) throw updateError;
              if (!updatedAttempt) throw new Error("Attempt not found after forced completion update.");

              setCurrentAttempt(updatedAttempt); // Update state with DB data
              setIsTestComplete(true);
              setFinalScore(updatedAttempt.score ?? 0); // Use score from DB response
              toast.warning("Время вышло! Тест завершен.", { duration: 5000 });
         } catch (err: any) {
             debugLogger.error("Error forcing test completion:", err);
             setError(`Не удалось завершить тест (${err.message || 'Неизвестная ошибка'}). Попробуйте обновить страницу.`);
             // Optionally, still show results based on client state?
             // setIsTestComplete(true);
             // setFinalScore(currentAttempt?.score || 0);
         } finally {
            setIsLoading(false);
         }
    // Add dependencies
    }, [currentAttempt, isLoading, isTestComplete, questions.length]);
    // --- End Timer Functions ---


    // --- Data Fetching & Attempt Handling ---
    useEffect(() => {
        if (!user?.id || !subjectId || isNaN(subjectId) || !variantNumber) {
            if (!user?.id) router.push('/login');
            else setError("Неверный ID предмета или номер варианта");
            setIsLoading(false);
            return;
        };

        debugLogger.log(`Initializing test for Subject ID: ${subjectId}, Variant: ${variantNumber}`);

        const initializeTest = async () => {
            setIsLoading(true);
            setError(null);
            // Reset states...
            setShowDescription(false);
            setIsTestComplete(false);
            setShowFeedback(false);
            setSelectedAnswerId(null);
            setIsTimerRunning(false); // Timer stopped initially
            setTimerKey(Date.now()); // Reset timer component key
            setTimeUpModal(false);
            setIsCorrect(false);
            setFeedbackExplanation(null);
            setFinalScore(0);
            setCurrentQuestionIndex(0);
            setCurrentAttempt(null);
            setQuestions([]); // Clear previous questions

            try {
                // Role update logic... (Can be removed if role is managed elsewhere)

                // Fetch Subject
                debugLogger.log("Fetching subject data...");
                const { data: subjectData, error: subjectError } = await supabaseAdmin
                    .from('subjects')
                    .select('*')
                    .eq('id', subjectId)
                    .single();
                if (subjectError) throw new Error(`Ошибка загрузки предмета: ${subjectError.message}`);
                if (!subjectData) throw new Error('Предмет не найден');
                setSubject(subjectData);
                debugLogger.log("Subject data loaded:", subjectData.name);

                // Fetch Questions for the specific VARIANT
                debugLogger.log(`Fetching questions for variant ${variantNumber}...`);
                const { data: questionData, error: questionError } = await supabaseAdmin
                    .from('vpr_questions')
                    .select(`
                        id, subject_id, variant_number, text, explanation, position,
                        vpr_answers ( id, question_id, text, is_correct )
                    `)
                    .eq('subject_id', subjectId)
                    .eq('variant_number', variantNumber)
                    .order('position', { ascending: true });

                if (questionError) throw new Error(`Ошибка загрузки вопросов: ${questionError.message}`);
                if (!questionData || questionData.length === 0) throw new Error(`Вопросы для варианта ${variantNumber} не найдены`);
                setQuestions(questionData);
                debugLogger.log(`Loaded ${questionData.length} questions.`);

                // Find/Create Attempt for the specific VARIANT
                debugLogger.log("Finding or creating test attempt...");
                const { data: existingAttempts, error: attemptError } = await supabaseAdmin
                    .from('vpr_test_attempts')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('subject_id', subjectId)
                    .eq('variant_number', variantNumber)
                    .is('completed_at', null) // Only find active attempts
                    .order('started_at', { ascending: false })
                    .limit(1);

                if (attemptError) throw new Error(`Ошибка поиска попытки: ${attemptError.message}`);

                let attemptToUse: VprTestAttempt;
                if (existingAttempts && existingAttempts.length > 0) {
                    attemptToUse = existingAttempts[0];
                    // Check if question count matches (test structure might have changed)
                    if (attemptToUse.total_questions !== questionData.length) {
                        debugLogger.warn("Question count mismatch. Starting new attempt.");
                        const { data: newAttemptData, error: newAttemptError } = await createNewAttempt(user.id, subjectId, variantNumber, questionData.length);
                        if (newAttemptError || !newAttemptData) throw newAttemptError || new Error('Не удалось создать новую попытку после изменения теста');
                        attemptToUse = newAttemptData;
                        setFinalScore(0); // Reset score for new attempt
                    } else {
                        debugLogger.log(`Resuming attempt ID: ${attemptToUse.id}, Last Index: ${attemptToUse.last_question_index}`);
                        setFinalScore(attemptToUse.score || 0); // Restore score
                    }
                } else {
                    debugLogger.log("No active attempt found. Creating new one.");
                    const { data: newAttemptData, error: newAttemptError } = await createNewAttempt(user.id, subjectId, variantNumber, questionData.length);
                    if (newAttemptError || !newAttemptData) throw newAttemptError || new Error('Не удалось создать новую попытку');
                    attemptToUse = newAttemptData;
                    debugLogger.log(`New attempt created ID: ${attemptToUse.id}`);
                    setFinalScore(0); // Ensure score is 0 for new attempt
                }
                setCurrentAttempt(attemptToUse);
                 // Ensure resumed index is valid
                const resumeIndex = Math.max(0, Math.min(attemptToUse.last_question_index, questionData.length - 1));
                setCurrentQuestionIndex(resumeIndex);
                debugLogger.log(`Setting current question index to: ${resumeIndex}`);

                // Start Timer only if the attempt isn't already completed
                if (!attemptToUse.completed_at) {
                    debugLogger.log("Attempt is active. Starting timer.");
                    setIsTimerRunning(true);
                } else {
                    debugLogger.log("Attempt was already completed. Showing results.");
                    setIsTestComplete(true);
                    setFinalScore(attemptToUse.score || 0);
                    setIsTimerRunning(false); // Don't start timer for completed tests
                }

            } catch (err: any) {
                debugLogger.error("Error during test initialization:", err);
                setError(err.message || 'Произошла ошибка при загрузке теста');
                setIsTimerRunning(false); // Ensure timer is off on error
            } finally {
                setIsLoading(false);
                debugLogger.log("Initialization complete.");
            }
        };

        // Helper to create attempt (includes variant)
        const createNewAttempt = async (userId: string, subjId: number, variantNum: number, totalQ: number) => {
             debugLogger.log(`Creating new attempt for user ${userId}, subject ${subjId}, variant ${variantNum}, totalQ ${totalQ}`);
             return await supabaseAdmin
                 .from('vpr_test_attempts')
                 .insert({
                     user_id: userId,
                     subject_id: subjId,
                     variant_number: variantNum,
                     total_questions: totalQ,
                     last_question_index: 0,
                     score: 0 // Initialize score explicitly
                 })
                 .select()
                 .single();
         };

        initializeTest();

        // Cleanup function (optional, might be useful for websockets later)
        return () => {
            debugLogger.log("VprTestPage unmounting or dependencies changed.");
            // Cleanup logic if needed
        };
     // Depend on variantNumber if it could change dynamically (e.g., via query params)
     }, [user, subjectId, variantNumber, router]); // router removed if not used for reset anymore
    // --- End Data Fetching ---


    // --- Answer Handling ---
    const handleAnswer = useCallback(async (selectedAnswer: VprAnswerData) => {
        // Added more guards
        if (!currentAttempt || showFeedback || isTestComplete || isLoading || !isTimerRunning || timeUpModal || !questions[currentQuestionIndex]) return;

        debugLogger.log(`Handling answer selection: Answer ID ${selectedAnswer.id} for Question ID ${questions[currentQuestionIndex].id}`);
        setIsTimerRunning(false); // Stop timer during feedback display
        setSelectedAnswerId(selectedAnswer.id);

        const correct = selectedAnswer.is_correct;
        setIsCorrect(correct);
        setFeedbackExplanation(questions[currentQuestionIndex]?.explanation || "Объяснение отсутствует.");
        setShowFeedback(true); // Show feedback panel

        const scoreIncrement = correct ? 1 : 0;
        // Optimistic UI update for score
        const newScore = (currentAttempt.score || 0) + scoreIncrement;
        setCurrentAttempt(prev => prev ? { ...prev, score: newScore } : null);
        debugLogger.log(`Answer Correct: ${correct}. Optimistic Score: ${newScore}`);

        try {
            debugLogger.log("Recording answer to DB...");
            // Record the specific answer choice
            const { error: recordError } = await supabaseAdmin
                .from('vpr_attempt_answers')
                .insert({
                    attempt_id: currentAttempt.id,
                    question_id: questions[currentQuestionIndex].id,
                    selected_answer_id: selectedAnswer.id,
                    was_correct: correct,
                });
            // Handle potential unique constraint violation gracefully (user re-answering somehow)
            if (recordError && recordError.code !== '23505') { // 23505 is unique_violation
                 throw new Error(`Ошибка записи ответа: ${recordError.message}`);
            } else if (recordError?.code === '23505') {
                 debugLogger.warn("Attempt answer already recorded for this question.");
                 // Decide if you want to update the existing answer or just ignore
            } else {
                 debugLogger.log("Answer recorded successfully.");
            }


            // Update the overall attempt score in DB *after* answer is recorded
            debugLogger.log("Updating attempt score in DB...");
            const { error: updateScoreError } = await supabaseAdmin
                .from('vpr_test_attempts')
                .update({ score: newScore }) // Update score using the optimistically calculated value
                .eq('id', currentAttempt.id);

            if (updateScoreError) {
                throw new Error(`Ошибка обновления счета: ${updateScoreError.message}`);
            }
            debugLogger.log("Attempt score updated successfully.");

        } catch (err: any) {
            debugLogger.error("Error saving answer/score:", err);
            toast.error(`Не удалось сохранить результат: ${err.message}`);
            // Consider reverting optimistic score update if DB fails
            // setCurrentAttempt(prev => prev ? { ...prev, score: (prev.score || 0) - scoreIncrement } : null);
        }
    // Add dependencies
    }, [currentAttempt, showFeedback, isTestComplete, isLoading, isTimerRunning, timeUpModal, questions, currentQuestionIndex]);
    // --- End Answer Handling ---


    // --- Navigation Logic ---
    const handleNextQuestion = useCallback(async () => {
        // Added guards
        if (!currentAttempt || isLoading || isTestComplete || timeUpModal || !questions.length) return;

        const nextIndex = currentQuestionIndex + 1;
        const isFinishing = nextIndex >= questions.length;
        debugLogger.log(`Handling next question. Current: ${currentQuestionIndex}, Next: ${nextIndex}, Finishing: ${isFinishing}`);

        // Reset UI for next question / completion
        setShowFeedback(false);
        setSelectedAnswerId(null);
        setIsCorrect(false); // Reset correctness state
        setFeedbackExplanation(null); // Clear explanation

        if (!isFinishing) {
            setCurrentQuestionIndex(nextIndex);
            setIsTimerRunning(true); // Restart timer for the next question
            debugLogger.log("Timer restarted for next question.");
        } else {
            setIsTimerRunning(false); // Stop timer when finishing
            debugLogger.log("Last question answered. Stopping timer.");
        }

        // --- Async DB Update for Progress/Completion ---
        try {
            debugLogger.log(`Updating attempt progress/completion in DB for index: ${isFinishing ? questions.length : nextIndex}`);
            const updates: Partial<VprTestAttempt> = isFinishing
                ? {
                      last_question_index: questions.length, // Mark beyond last index to indicate full completion
                      completed_at: new Date().toISOString(),
                      // Score should have been updated by handleAnswer, just persisting index/completion
                  }
                : {
                      last_question_index: nextIndex // Update progress
                  };

            const { data: updatedAttempt, error: updateError } = await supabaseAdmin
                .from('vpr_test_attempts')
                .update(updates)
                .eq('id', currentAttempt.id)
                .select() // Get the updated row back
                .single();

            if (updateError) throw new Error(`Ошибка обновления прогресса: ${updateError.message}`);
            if (!updatedAttempt) throw new Error("Attempt not found after update.");

            // Update client state with the confirmed data from DB
            setCurrentAttempt(updatedAttempt);
            debugLogger.log("Attempt state updated with DB data:", updatedAttempt);

            if (isFinishing) {
                 // Set final state based on DB data
                 setIsTestComplete(true);
                 setFinalScore(updatedAttempt.score ?? 0);
                 debugLogger.log("Test marked as complete. Final Score from DB:", updatedAttempt.score);
                 toast.success("Тест завершен!", { duration: 4000 });
            } else {
                 debugLogger.log(`Moved to question index: ${nextIndex}`);
            }

        } catch(err: any) {
            debugLogger.error("Error updating attempt on navigation:", err);
            setError(`Не удалось сохранить прогресс (${err.message}). Попробуйте обновить страницу.`);
            toast.error("Ошибка сохранения прогресса.");
            // Consider UI rollback?
            // if (!isFinishing) setCurrentQuestionIndex(currentQuestionIndex); // Revert index
            // setIsTimerRunning(false); // Stop timer on error?
        }
    // Add dependencies
    }, [currentAttempt, isLoading, isTestComplete, timeUpModal, questions.length, currentQuestionIndex]);
    // --- End Navigation Logic ---


    // --- Reset Logic ---
     const resetTest = useCallback(() => {
         // Added guards
         if (!user?.id || !subjectId || isLoading) return;

         debugLogger.log("Resetting test...");
         setIsLoading(true); // Show loading indicator during reset process

         // --- Perform Reset Actions ---
         // 1. Clear local state
         setCurrentAttempt(null);
         setIsTestComplete(false);
         setShowFeedback(false);
         setSelectedAnswerId(null);
         setFinalScore(0);
         setCurrentQuestionIndex(0);
         setError(null);
         setIsTimerRunning(false);
         setTimerKey(Date.now());
         setTimeUpModal(false);
         setShowDescription(false);
         setQuestions([]); // Clear questions

         // 2. Optional: Mark previous attempt as "abandoned" or delete?
         // For now, we just let useEffect create a new one or resume another.

         // 3. Force re-initialization by changing a dependency in useEffect
         // Using router.replace might reload the page fully, depending on Next.js version/setup.
         // A state change triggering useEffect is often smoother for SPA feel.
         // We can just rely on the state reset and let useEffect run again due to cleared attempt.
         // OR: Trigger explicitly if needed:
         // setTriggerReset(prev => prev + 1); // And add triggerReset to useEffect deps

         // For simplicity, we assume clearing state is enough for useEffect to re-run correctly.
         // Adding a query param is more for forcing a full server-side refetch if needed.
         // router.replace(`/vpr-test/${subjectId}?reset=${Date.now()}&variant=${variantNumber}`);
         toast.info("Тест сброшен. Загрузка нового варианта...", { duration: 2000});
         // setIsLoading(false); // Let useEffect handle setting loading to false after re-init
     // Add dependencies
     }, [user?.id, subjectId, variantNumber, isLoading]);
    // --- End Reset Logic ---


    // --- Rendering Logic ---

    // Use Components for Loading, Error, Completion
    if (isLoading && !currentAttempt) return <VprLoadingIndicator />; // Show full screen loader only on initial load
    if (error) return <VprErrorDisplay error={error} onRetry={resetTest} />;
    if (isTestComplete) {
        return (
            <VprCompletionScreen
                subjectName={subject?.name}
                finalScore={finalScore}
                totalQuestions={questions.length}
                onReset={resetTest}
                onGoToList={() => router.push('/vpr-tests')} // Use router for navigation
            />
        );
    }

    // Ensure questions and attempt are loaded before rendering main test UI
    if (!currentAttempt || questions.length === 0) {
         // Can show a more specific loading state or potentially an error if data missing after load
         return <VprLoadingIndicator />;
    }


    const currentQuestionData = questions[currentQuestionIndex];
    // Ensure answers array exists, default to empty array if not
    const answersForCurrent = currentQuestionData?.vpr_answers || [];

    return (
        <motion.div
            key={currentAttempt.id} // Re-render the whole structure if attempt changes (e.g., after reset)
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-screen bg-page-gradient text-light-text flex flex-col items-center pt-6 pb-10 px-4"
        >
            {/* Time Up Modal Component */}
            <VprTimeUpModal show={timeUpModal} onConfirm={completeTestDueToTime} />

            {/* Main test container */}
            <div className="max-w-3xl w-full bg-dark-card shadow-xl rounded-2xl p-5 md:p-8 flex-grow flex flex-col border border-brand-blue/20 relative">
                 {/* Loading overlay during transitions/saves */}
                 {isLoading && (
                    <div className="absolute inset-0 bg-dark-card/70 flex items-center justify-center z-40 rounded-2xl">
                        <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
                    </div>
                 )}

                {/* Header Component */}
                <VprHeader
                    subjectName={subject?.name}
                    showDescriptionButton={!!subject?.description}
                    isDescriptionShown={showDescription}
                    onToggleDescription={() => setShowDescription(!showDescription)}
                    timerKey={timerKey}
                    timeLimit={timeLimit}
                    onTimeUp={handleTimeUp}
                    // Ensure timer runs only when appropriate
                    isTimerRunning={isTimerRunning && !isLoading && !isTestComplete && !showFeedback && !timeUpModal}
                 />

                {/* Description Component */}
                <VprDescription description={subject?.description} show={showDescription} />

                {/* Progress Indicator */}
                <VprProgressIndicator current={currentQuestionIndex} total={questions.length} />

                {/* Question Content Component */}
                 <VprQuestionContent
                     questionText={currentQuestionData?.text}
                     questionNumber={currentQuestionIndex + 1}
                     totalQuestions={questions.length}
                 />

                {/* Answer List Component */}
                 <VprAnswerList
                     answers={answersForCurrent}
                     selectedAnswerId={selectedAnswerId}
                     showFeedback={showFeedback}
                     timeUpModal={timeUpModal}
                     handleAnswer={handleAnswer} // Pass down the memoized handler
                 />

                {/* Explanation and Next Button */}
                 <AnimatePresence>
                     {showFeedback && (
                         <ExplanationDisplay
                             explanation={feedbackExplanation}
                             isCorrect={isCorrect}
                             onNext={handleNextQuestion} // Pass down memoized handler
                             isLastQuestion={currentQuestionIndex >= questions.length - 1}
                         />
                     )}
                 </AnimatePresence>

                {/* Footer Reset Button */}
                <div className="mt-auto pt-6 text-center">
                    <button
                        onClick={resetTest} // Pass down memoized handler
                        disabled={isLoading} // Disable button during loading states
                        className="text-xs text-gray-500 hover:text-brand-pink underline transition-colors flex items-center justify-center gap-1 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RotateCcw className="h-3 w-3"/>
                        Сбросить и начать заново
                    </button>
                </div>

            </div>
        </motion.div>
    );
}