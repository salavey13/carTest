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
import { notifyAdmin } from "@/app/actions"; // <--- ИМПОРТ ДОБАВЛЕН

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

export default function VprTestPage() {
    // --- States ---
    const { user } = useAppContext();
    const params = useParams();
    const router = useRouter();
    const subjectId = parseInt(params.subjectId as string, 10);

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
    const [resetCounter, setResetCounter] = useState(0);
    const [selectedVariant, setSelectedVariant] = useState<number | null>(null);

    // --- Timer Functions ---
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

              // --- НАЧАЛО: Отправка уведомления админу (Время вышло) ---
              if (user && subject && updatedAttempt) {
                const message = `🔔 Тест ВПР завершен (Время вышло)!
Пользователь: ${user.username || user.id} (${user.id})
Предмет: ${subject.name}
Вариант: ${updatedAttempt.variant_number}
Результат: ${updatedAttempt.score ?? 0} из ${updatedAttempt.total_questions}`;
                  try {
                      await notifyAdmin(message);
                      debugLogger.log("Admin notified of time-up completion.");
                  } catch (notifyError) {
                      debugLogger.error("Failed to notify admin about time-up completion:", notifyError);
                  }
              } else {
                  debugLogger.warn("Could not notify admin (time-up): missing user, subject, or attempt data.");
              }
              // --- КОНЕЦ: Отправка уведомления админу (Время вышло) ---

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
    // Добавлены user и subject в зависимости для использования в уведомлении
    }, [currentAttempt, isSaving, isTestComplete, questions.length, user, subject]);
    // --- End Timer Functions ---


    // --- Data Fetching & Attempt Handling (Includes Variant Selection) ---
    useEffect(() => {
        debugLogger.log(`useEffect running. Reset Counter: ${resetCounter}`);

        if (!user?.id || !subjectId || isNaN(subjectId)) {
            if (!user?.id) router.push('/login');
            else setError("Неверный ID предмета");
            setIsLoading(false);
            return;
        }

        debugLogger.log(`Initializing test for Subject ID: ${subjectId}`);
        let isMounted = true;

        const initializeTest = async () => {
            if (!isMounted) {
                debugLogger.log("InitializeTest aborted: component unmounted.");
                return;
            }
            debugLogger.log("InitializeTest starting...");
            setIsLoading(true);
            setError(null);
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
            setCurrentAttempt(null);
            setQuestions([]);
            setIsCurrentQuestionNonAnswerable(false);
            setSelectedVariant(null);

            let variantToLoad: number | null = null;

            try {
                debugLogger.log("Selecting variant...");
                const { data: variantData, error: variantError } = await supabaseAdmin
                    .from('vpr_questions')
                    .select('variant_number')
                    .eq('subject_id', subjectId);

                if (!isMounted) return;
                if (variantError) throw new Error(`Ошибка получения вариантов: ${variantError.message}`);
                if (!variantData || variantData.length === 0) throw new Error('Для этого предмета не найдено ни одного варианта.');

                const allAvailableVariants = [...new Set(variantData.map(q => q.variant_number))].sort((a,b) => a - b);
                debugLogger.log("Available variants:", allAvailableVariants);

                const { data: completedAttemptsData, error: completedError } = await supabaseAdmin
                    .from('vpr_test_attempts')
                    .select('variant_number')
                    .eq('user_id', user.id)
                    .eq('subject_id', subjectId)
                    .not('completed_at', 'is', null);

                if (!isMounted) return;
                if (completedError) throw new Error(`Ошибка получения пройденных попыток: ${completedError.message}`);

                const completedVariants = [...new Set(completedAttemptsData.map(a => a.variant_number))];
                debugLogger.log("User has completed variants:", completedVariants);

                const untriedVariants = allAvailableVariants.filter(v => !completedVariants.includes(v));
                debugLogger.log("Untried variants:", untriedVariants);

                if (untriedVariants.length > 0) {
                    variantToLoad = untriedVariants[Math.floor(Math.random() * untriedVariants.length)];
                    debugLogger.log(`Selected random untried variant: ${variantToLoad}`);
                } else if (allAvailableVariants.length > 0) {
                    variantToLoad = allAvailableVariants[Math.floor(Math.random() * allAvailableVariants.length)];
                    debugLogger.log(`All variants tried. Selected random variant from all: ${variantToLoad}`);
                } else {
                    throw new Error('Не удалось определить вариант для загрузки.');
                }

                setSelectedVariant(variantToLoad);

                if (!variantToLoad) throw new Error("Variant selection failed.");

                debugLogger.log("Fetching subject data...");
                const { data: subjectData, error: subjectError } = await supabaseAdmin
                    .from('subjects')
                    .select('*')
                    .eq('id', subjectId)
                    .single();
                if (!isMounted) return;
                if (subjectError) throw new Error(`Ошибка загрузки предмета: ${subjectError.message}`);
                if (!subjectData) throw new Error('Предмет не найден');
                setSubject(subjectData); // <--- setSubject ЗДЕСЬ
                debugLogger.log("Subject data loaded:", subjectData.name);

                debugLogger.log(`Fetching questions for selected variant ${variantToLoad}...`);
                const { data: questionData, error: questionError } = await supabaseAdmin
                    .from('vpr_questions')
                    .select(`*, vpr_answers ( * )`)
                    .eq('subject_id', subjectId)
                    .eq('variant_number', variantToLoad)
                    .order('position', { ascending: true });
                if (!isMounted) return;
                if (questionError) throw new Error(`Ошибка загрузки вопросов: ${questionError.message}`);
                if (!questionData || questionData.length === 0) throw new Error(`Вопросы для варианта ${variantToLoad} не найдены`);
                setQuestions(questionData);
                debugLogger.log(`Loaded ${questionData.length} questions.`);

                debugLogger.log(`Finding active test attempt for variant ${variantToLoad}...`);
                const { data: existingAttempts, error: attemptError } = await supabaseAdmin
                    .from('vpr_test_attempts')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('subject_id', subjectId)
                    .eq('variant_number', variantToLoad)
                    .is('completed_at', null)
                    .order('started_at', { ascending: false })
                    .limit(1);
                 if (!isMounted) return;
                 if (attemptError) throw new Error(`Ошибка поиска попытки: ${attemptError.message}`);

                let attemptToUse: VprTestAttempt | null = null;

                if (existingAttempts && existingAttempts.length > 0) {
                    const potentialAttempt = existingAttempts[0];
                    if (potentialAttempt.total_questions !== questionData.length) {
                        debugLogger.warn(`Question count mismatch for variant ${variantToLoad}. Active attempt outdated. Will create new one.`);
                         try {
                            debugLogger.log(`Attempting to delete outdated attempt ID: ${potentialAttempt.id}`);
                             await supabaseAdmin.from('vpr_test_attempts').delete().eq('id', potentialAttempt.id);
                         } catch (deleteErr) {
                             debugLogger.error("Failed to delete outdated attempt:", deleteErr);
                         }
                    } else {
                        attemptToUse = potentialAttempt;
                        debugLogger.log(`Resuming active attempt ID: ${attemptToUse.id} for variant ${variantToLoad}, Last Index: ${attemptToUse.last_question_index}`);
                        setFinalScore(attemptToUse.score || 0);
                    }
                } else {
                    debugLogger.log(`No active attempt found in DB for variant ${variantToLoad}.`);
                }

                if (!attemptToUse) {
                     debugLogger.log(`Creating new attempt for variant ${variantToLoad}.`);
                     const { data: newAttemptData, error: newAttemptError } = await createNewAttempt(user.id, subjectId, variantToLoad, questionData.length);
                     if (!isMounted) return;
                     if (newAttemptError || !newAttemptData) throw newAttemptError || new Error('Не удалось создать новую попытку');
                     attemptToUse = newAttemptData;
                     debugLogger.log(`New attempt created ID: ${attemptToUse.id} for variant ${variantToLoad}`);
                     setFinalScore(0);
                }

                setCurrentAttempt(attemptToUse);
                const resumeIndex = Math.max(0, Math.min(attemptToUse.last_question_index, questionData.length - 1));
                setCurrentQuestionIndex(resumeIndex);
                debugLogger.log(`Setting current question index to: ${resumeIndex}`);

                const currentQ = questionData[resumeIndex];
                const currentAnswers = currentQ?.vpr_answers || [];
                const isNonAnswerable = currentAnswers.length > 0 && currentAnswers.every(a => /^\[(Рисунок|Ввод текста|Диаграмма|Изображение|Площадь)\].*/.test(a.text));
                setIsCurrentQuestionNonAnswerable(isNonAnswerable);
                debugLogger.log(`Is current question (${resumeIndex}) non-answerable? ${isNonAnswerable}`);

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

        const createNewAttempt = async (userId: string, subjId: number, variantNum: number, totalQ: number) => {
             debugLogger.log(`Helper: Creating new attempt for user ${userId}, subject ${subjId}, variant ${variantNum}, totalQ ${totalQ}`);
             return await supabaseAdmin
                 .from('vpr_test_attempts')
                 .insert({ user_id: userId, subject_id: subjId, variant_number: variantNum, total_questions: totalQ, last_question_index: 0, score: 0 })
                 .select()
                 .single();
         };

        initializeTest();

        return () => {
            isMounted = false;
            debugLogger.log("useEffect cleanup: component unmounting or dependencies changed.");
        };
     }, [user, subjectId, resetCounter, router]); // router добавлен обратно, так как используется в if (!user?.id)
    // --- End Data Fetching ---


    // --- Answer Handling ---
    const handleAnswer = useCallback(async (selectedAnswer: VprAnswerData) => {
        if (!currentAttempt || showFeedback || isTestComplete || isSaving || !isTimerRunning || timeUpModal || !questions[currentQuestionIndex]) return;
        debugLogger.log(`Handling answer selection: Answer ID ${selectedAnswer.id} for Question ID ${questions[currentQuestionIndex].id} (Variant: ${currentAttempt.variant_number})`);
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
            // Игнорируем ошибку дубликата (23505), но выводим остальные
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
            // Важно: Не устанавливаем setShowFeedback(false) здесь, чтобы пользователь видел фидбек, даже если сохранение не удалось
        } finally {
             setIsSaving(false);
             // Таймер не перезапускаем здесь, он запустится при handleNextQuestion
        }
    }, [currentAttempt, showFeedback, isTestComplete, isSaving, isTimerRunning, timeUpModal, questions, currentQuestionIndex]);
    // --- End Answer Handling ---


    // --- Navigation Logic ---
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
                // ТЕСТ ЗАВЕРШЕН НОРМАЛЬНО
                setIsCurrentQuestionNonAnswerable(false);
                setIsTimerRunning(false);
                setIsTestComplete(true);
                setFinalScore(updatedAttempt.score ?? 0);
                debugLogger.log("Test marked as complete. Final Score from DB:", updatedAttempt.score);
                toast.success("Тест завершен!", { duration: 4000 });

                // --- НАЧАЛО: Отправка уведомления админу ---
                if (user && subject && updatedAttempt) {
                    const message = `✅ Тест ВПР завершен!
Пользователь: ${user.username || user.id} (${user.id})
Предмет: ${subject.name}
Вариант: ${updatedAttempt.variant_number}
Результат: ${updatedAttempt.score ?? 0} из ${updatedAttempt.total_questions}`;
                    try {
                        await notifyAdmin(message);
                        debugLogger.log("Admin notified of normal test completion.");
                    } catch (notifyError) {
                        debugLogger.error("Failed to notify admin about normal completion:", notifyError);
                        // Можно добавить toast.warning("Не удалось уведомить администратора.") если нужно
                    }
                } else {
                    debugLogger.warn("Could not notify admin: missing user, subject, or attempt data.");
                }
                // --- КОНЕЦ: Отправка уведомления админу ---
            }
        } catch(err: any) {
            debugLogger.error("Error updating attempt on navigation:", err);
            setError(`Не удалось сохранить прогресс (${err.message}). Попробуйте обновить страницу.`);
            toast.error("Ошибка сохранения прогресса.");
            if (!isFinishing) setIsTimerRunning(false); // Stop timer if nav failed
        } finally {
            setIsSaving(false);
        }
    // Добавлены user и subject в зависимости для использования в уведомлении
    }, [currentAttempt, isSaving, isTestComplete, timeUpModal, questions, currentQuestionIndex, user, subject]);
    // --- End Navigation Logic ---


    // --- Reset Logic ---
     const resetTest = useCallback(async () => {
         if (isSaving) {
             toast.warning("Подождите, идет сохранение...");
             return;
         }
         debugLogger.log("Reset button clicked.");
         setIsLoading(true);

         try {
             setIsTimerRunning(false);

             debugLogger.log(`Attempting to delete ANY active attempt for subject ${subjectId} and user before reset.`);
             const { error: deleteError } = await supabaseAdmin
                 .from('vpr_test_attempts')
                 .delete()
                 .eq('user_id', user?.id)
                 .eq('subject_id', subjectId)
                 .is('completed_at', null);

             if (deleteError) {
                  debugLogger.error("Error deleting active attempt(s) during reset:", deleteError);
             } else {
                  debugLogger.log("Any active attempts for this subject/user deleted successfully.");
             }

             setCurrentAttempt(null);
             setQuestions([]);
             setCurrentQuestionIndex(0);
             setError(null);
             setSelectedVariant(null);
             setSubject(null); // Сбрасываем предмет тоже

             toast.info("Сброс теста...", { duration: 1500});
             setResetCounter(prev => prev + 1);
             debugLogger.log("Reset counter incremented, useEffect will re-run.");

         } catch (err: any) {
              debugLogger.error("Error during reset process:", err);
              setError(`Ошибка сброса теста: ${err.message}`);
              setIsLoading(false);
         }
     }, [isSaving, user?.id, subjectId]);
    // --- End Reset Logic ---


    // --- Rendering Logic ---
    if (isLoading) return <VprLoadingIndicator />;
    if (error) return <VprErrorDisplay error={error} onRetry={resetTest} />;
    if (isTestComplete) {
        // Передаем данные в компонент завершения
        return ( <VprCompletionScreen
                    subjectName={subject?.name}
                    variantNumber={currentAttempt?.variant_number}
                    finalScore={finalScore}
                    totalQuestions={questions.length}
                    onReset={resetTest}
                    onGoToList={() => router.push('/vpr-tests')} /> );
    }
    // Проверка после загрузки и ошибок, перед рендером основного теста
    if (!currentAttempt || questions.length === 0 || !selectedVariant || !subject) {
         return <VprErrorDisplay error={error || "Данные теста (предмет, вариант или вопросы) не загружены. Попробуйте сбросить."} onRetry={resetTest} />;
    }

    const currentQuestionData = questions[currentQuestionIndex];
    const answersForCurrent = currentQuestionData?.vpr_answers || [];
    const showSavingOverlay = isSaving;

    return (
        <motion.div key={currentAttempt.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-page-gradient text-light-text flex flex-col items-center pt-6 pb-10 px-4">
            <VprTimeUpModal show={timeUpModal} onConfirm={completeTestDueToTime} />
            <div className="max-w-3xl w-full bg-dark-card shadow-xl rounded-2xl p-5 md:p-8 flex-grow flex flex-col border border-brand-blue/20 relative">
                 {showSavingOverlay && ( <div className="absolute inset-0 bg-dark-card/80 backdrop-blur-sm flex items-center justify-center z-40 rounded-2xl"> <Loader2 className="h-8 w-8 animate-spin text-brand-blue" /> <span className="ml-3 text-light-text">Сохранение...</span> </div> )}
                 <VprHeader
                    subjectName={subject?.name}
                    variantNumber={selectedVariant} // Передаем выбранный вариант
                    showDescriptionButton={!!subject?.description}
                    isDescriptionShown={showDescription}
                    onToggleDescription={() => setShowDescription(!showDescription)}
                    timerKey={timerKey}
                    timeLimit={timeLimit}
                    onTimeUp={handleTimeUp}
                    isTimerRunning={isTimerRunning && !isSaving && !isTestComplete && !showFeedback && !timeUpModal}
                />
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