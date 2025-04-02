"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Loader2, BookOpen, RotateCcw, Info } from "lucide-react";
import { supabaseAdmin } from "@/hooks/supabase"; // Используем клиентский supabase!
import { useAppContext } from "@/contexts/AppContext";
import { debugLogger } from "@/lib/debugLogger";
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown'; // Импорт

// Импорт НОВЫХ компонентов
import { VprProgressIndicator } from "@/components/VprProgressIndicator";
import { QuestionDisplay } from "@/components/QuestionDisplay";
import { AnswerOption } from "@/components/AnswerOption";
import { ExplanationDisplay } from "@/components/ExplanationDisplay";

// Обновленные интерфейсы
interface SubjectData {
    id: number;
    name: string;
    description?: string; // Описание теперь тут
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

export default function VprTestPage() {
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
    const [isCorrect, setIsCorrect] = useState(false);
    const [feedbackExplanation, setFeedbackExplanation] = useState<string | null>(null);

    const [isTestComplete, setIsTestComplete] = useState(false);
    const [finalScore, setFinalScore] = useState<number>(0);
    const [showDescription, setShowDescription] = useState(false); // Для показа/скрытия описания

    // --- Data Fetching and Attempt Handling (Остается как в предыдущем ответе) ---
    useEffect(() => {
        if (!user?.id || !subjectId || isNaN(subjectId)) {
            if (!user?.id) router.push('/login'); // Или другая логика
            else setError("Неверный ID предмета");
            setIsLoading(false);
            return;
        };

        const initializeTest = async () => {
            setIsLoading(true);
            setError(null);
            // Сбрасываем состояние перед инициализацией
            setShowDescription(false);
            setIsTestComplete(false);
            setShowFeedback(false);
            setSelectedAnswerId(null);

            
            try {
                // --- Начало блока обновления роли ---
                // Проверяем текущую роль пользователя ИЗ КОНТЕКСТА
                // Важно: dbUser из useAppContext должен быть актуальным
                const currentUserRole = user?.dbUser?.role; // Получаем роль из контекста

                if (user?.id && currentUserRole && currentUserRole !== 'vpr_tester' && currentUserRole !== 'admin') {
                    try {
                        const { error: roleUpdateError } = await supabaseAdmin
                            .from('users')
                            .update({ role: 'vpr_tester' }) // Устанавливаем роль
                            .eq('user_id', user.id);

                        if (roleUpdateError) {
                             debugLogger.error("Ошибка обновления роли пользователя:", roleUpdateError);
                             // Не критично для теста, но стоит залогировать
                        } else {
                            debugLogger.log(`Роль пользователя ${user.id} обновлена на vpr_tester`);
                            // Опционально: обновить dbUser в контексте, если AppContext это поддерживает
                            // user.updateDbUser({ ...user.dbUser, role: 'vpr_tester' }); // Пример
                        }
                    } catch (roleErr) {
                         debugLogger.error("Исключение при обновлении роли:", roleErr);
                    }
                }
                // --- Конец блока обновления роли --

                // 1. Fetch Subject Info
                const { data: subjectData, error: subjectError } = await supabaseAdmin
                    .from('subjects')
                    .select('*')
                    .eq('id', subjectId)
                    .single();

                if (subjectError || !subjectData) throw new Error(subjectError?.message || 'Предмет не найден');
                setSubject(subjectData);

                // 2. Fetch Questions with Answers
                const { data: questionData, error: questionError } = await supabaseAdmin
                    .from('vpr_questions')
                    .select(`*, vpr_answers ( * )`)
                    .eq('subject_id', subjectId)
                    .order('position', { ascending: true });

                if (questionError || !questionData || questionData.length === 0) throw new Error(questionError?.message || 'Вопросы для этого предмета не найдены');
                setQuestions(questionData);

                // 3. Find or Create Test Attempt
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
                     // Важно: Проверяем, соответствует ли total_questions в попытке текущему числу вопросов
                     if(attemptToUse.total_questions !== questionData.length) {
                          debugLogger.warn("Количество вопросов изменилось, начинаем новую попытку.");
                          // Можно пометить старую попытку как 'aborted' или просто создать новую
                          // Создаем новую:
                           const { data: newAttemptData, error: newAttemptError } = await createNewAttempt(user.id, subjectId, questionData.length);
                           if (newAttemptError || !newAttemptData) throw newAttemptError || new Error('Не удалось создать новую попытку');
                           attemptToUse = newAttemptData;
                     } else {
                        debugLogger.log("Возобновление попытки:", attemptToUse.id);
                     }
                } else {
                    const { data: newAttemptData, error: newAttemptError } = await createNewAttempt(user.id, subjectId, questionData.length);
                    if (newAttemptError || !newAttemptData) throw newAttemptError || new Error('Не удалось создать новую попытку');
                    attemptToUse = newAttemptData;
                    debugLogger.log("Начата новая попытка:", attemptToUse.id);
                }

                 setCurrentAttempt(attemptToUse);
                 // Устанавливаем индекс вопроса, убеждаясь, что он не выходит за рамки
                 setCurrentQuestionIndex(Math.min(attemptToUse.last_question_index, questionData.length -1));
                 // Если попытка уже была завершена ранее (хотя мы фильтруем по completed_at = null)
                 if (attemptToUse.completed_at) {
                     setIsTestComplete(true);
                     setFinalScore(attemptToUse.score || 0);
                 }


            } catch (err: any) {
                debugLogger.error("Ошибка инициализации теста:", err);
                setError(err.message || 'Произошла ошибка при загрузке теста');
            } finally {
                setIsLoading(false);
            }
        };
         // Helper function to create a new attempt
        const createNewAttempt = async (userId: string, subjId: number, totalQ: number) => {
             return await supabaseAdmin
                 .from('vpr_test_attempts')
                 .insert({ user_id: userId, subject_id: subjId, total_questions: totalQ, last_question_index: 0 })
                 .select()
                 .single();
         };


        initializeTest();
     }, [user, subjectId, router]); // Зависимости


    // --- Answer Handling Logic (Остается почти без изменений) ---
    const handleAnswer = async (selectedAnswer: VprAnswerData) => {
        if (!currentAttempt || showFeedback || isTestComplete || isLoading) return;

        setSelectedAnswerId(selectedAnswer.id);
        const correct = selectedAnswer.is_correct;
        setIsCorrect(correct);
        setFeedbackExplanation(questions[currentQuestionIndex]?.explanation || "Объяснение отсутствует.");
        setShowFeedback(true); // Показываем обратную связь

        // Асинхронно записываем ответ
        // Важно: Обновляем client-side score СРАЗУ для UI, даже если запись в БД займет время
        const scoreIncrement = correct ? 1 : 0;
        setCurrentAttempt(prev => prev ? { ...prev, score: (prev.score || 0) + scoreIncrement } : null);


        try {
            const { error: recordError } = await supabaseAdmin
                .from('vpr_attempt_answers')
                .insert({
                    attempt_id: currentAttempt.id,
                    question_id: questions[currentQuestionIndex].id,
                    selected_answer_id: selectedAnswer.id,
                    was_correct: correct,
                });
            if (recordError && recordError.code !== '23505') { // Игнорируем ошибку дубликата
                throw recordError;
            }
            debugLogger.log("Ответ записан:", { questionId: questions[currentQuestionIndex].id, correct });
        } catch (err) {
            debugLogger.error("Ошибка записи ответа в БД:", err);
             // Можно показать пользователю сообщение, но тест продолжается
             // setError("Не удалось сохранить ваш ответ. Результат может быть неточным.");
        }
    };

    // --- Navigation Logic (Остается почти без изменений) ---
    const handleNextQuestion = async () => {
        if (!currentAttempt || isLoading) return;

        const nextIndex = currentQuestionIndex + 1;

        // Сначала обновляем UI
        setShowFeedback(false);
        setSelectedAnswerId(null);

        // Определяем, завершен ли тест
        const isFinishing = nextIndex >= questions.length;

        // Обновляем состояние индекса вопроса *только если тест не завершен*
        if (!isFinishing) {
            setCurrentQuestionIndex(nextIndex);
        }

        // Асинхронно обновляем БД
        try {
            const updates: Partial<VprTestAttempt> = isFinishing
                ? {
                      last_question_index: questions.length, // Ставим индекс ЗА последний вопрос
                      completed_at: new Date().toISOString(),
                      score: currentAttempt.score || 0 // Фиксируем счет из состояния
                  }
                : {
                      last_question_index: nextIndex
                  };

            const { error: updateError } = await supabaseAdmin
                .from('vpr_test_attempts')
                .update(updates)
                .eq('id', currentAttempt.id);

            if (updateError) throw updateError;

            // Обновляем состояние попытки в UI
             setCurrentAttempt(prev => prev ? { ...prev, ...updates } : null);


            // Если тест завершен, обновляем состояние UI
            if (isFinishing) {
                setIsTestComplete(true);
                setFinalScore(updates.score ?? 0); // Используем обновленный score
                debugLogger.log("Тест завершен в БД. Финальный счет:", updates.score);
            } else {
                 debugLogger.log("Переход к вопросу:", nextIndex + 1);
            }

        } catch(err) {
            debugLogger.error("Ошибка обновления попытки при переходе:", err);
            setError("Не удалось сохранить прогресс. Попробуйте обновить.");
             // Возможно, стоит откатить setCurrentQuestionIndex, если критично
             // setCurrentQuestionIndex(currentQuestionIndex); // Откат индекса
        }
    };

    // --- Reset Logic (Перезапускает initializeTest) ---
    const resetTest = () => {
         if (!user?.id || !subjectId) return;
         // Просто перезапускаем инициализацию, она сама создаст новую попытку
         // Сбрасываем только UI состояние на всякий случай
         setIsLoading(true);
         setCurrentAttempt(null);
         setIsTestComplete(false);
         setShowFeedback(false);
         setSelectedAnswerId(null);
         setFinalScore(0);
         setCurrentQuestionIndex(0); // Сброс индекса
         setError(null);
         // Вызов useEffect сработает из-за изменения зависимостей не нужен,
         // просто имитируем перезагрузку данных
         const event = new Event('reset'); // Можно использовать кастомное событие или просто вызвать функцию
         window.dispatchEvent(event); // Пример
         // Или лучше так:
          if (typeof window !== "undefined") {
              // Форсируем перезагрузку данных через useEffect
              router.replace(`/vpr-test/${subjectId}?reset=${Date.now()}`); // Добавляем query param для уникальности
          }
     };

    // --- Rendering Logic ---

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                <span className="ml-4 text-lg text-gray-700">Загрузка теста...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-md p-6 text-center max-w-md border border-red-300">
                    <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-red-700 mb-2">Ошибка</h2>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button
                        onClick={() => window.location.reload()} // Simple reload for now
                        className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
                    >
                        Обновить страницу
                    </button>
                </div>
            </div>
        );
    }

    if (isTestComplete) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md w-full border border-green-300"
                >
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Тест "{subject?.name}" завершен!</h2>
                    <p className="text-lg text-gray-600 mb-6">
                        Ваш результат: <span className="font-semibold text-blue-600">{finalScore}</span> из {questions.length}
                    </p>
                    <div className="space-y-3">
                         <button
                            onClick={resetTest}
                            className="w-full bg-blue-500 text-white px-5 py-2.5 rounded-md hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <RotateCcw className="h-5 w-5" />
                            Пройти еще раз
                        </button>
                         <button
                            onClick={() => router.push('/')} // Navigate to home or subject list
                            className="w-full bg-gray-200 text-gray-700 px-5 py-2.5 rounded-md hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
                        >
                             <BookOpen className="h-5 w-5" />
                            К списку тестов
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    // --- Отображение Теста ---
    const currentQuestionData = questions[currentQuestionIndex];
    const answersForCurrent = currentQuestionData?.vpr_answers || [];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-screen bg-gradient-to-b from-gray-50 to-indigo-100 text-gray-800 flex flex-col items-center pt-8 pb-12 px-4"
        >
            <div className="max-w-3xl w-full bg-white shadow-lg rounded-xl p-5 md:p-8 flex-grow flex flex-col">

                {/* Заголовок и Описание Предмета */}
                <div className="mb-5 text-center relative">
                    <h1 className="text-2xl md:text-3xl font-bold text-indigo-800">{subject?.name}</h1>
                    {subject?.description && (
                         <button
                            onClick={() => setShowDescription(!showDescription)}
                            className="absolute top-0 right-0 text-indigo-500 hover:text-indigo-700 p-1 rounded-full hover:bg-indigo-100 transition-colors"
                            title={showDescription ? "Скрыть описание" : "Показать описание"}
                         >
                            <Info className="h-5 w-5" />
                        </button>
                    )}
                </div>

                {/* Выпадающее описание предмета */}
                <AnimatePresence>
                    {showDescription && subject?.description && (
                        <motion.div
                            initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                            animate={{ height: 'auto', opacity: 1, marginBottom: '1.5rem' }} // mb-6
                            exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden"
                        >
                            <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200 prose prose-sm md:prose-base max-w-none">
                                <ReactMarkdown>{subject.description}</ReactMarkdown>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Индикатор Прогресса */}
                <VprProgressIndicator
                    current={currentQuestionIndex}
                    total={questions.length}
                    // answerStatuses={[]} // Пока не передаем статусы для простоты
                />

                {/* Отображение Вопроса */}
                <QuestionDisplay
                     questionText={currentQuestionData?.text}
                     questionNumber={currentQuestionIndex + 1}
                     totalQuestions={questions.length}
                 />

                {/* Варианты Ответов */}
                <div className="space-y-3 mb-6">
                     {answersForCurrent.map((answer) => {
                         const isSelected = answer.id === selectedAnswerId;
                         // Правильность показываем только если этот ответ выбран ИЛИ если он верный (для подсветки верного при неверном выборе)
                         const showCorrectness = showFeedback && answer.is_correct;
                         const showIncorrectness = showFeedback && isSelected && !answer.is_correct;

                         return (
                             <AnswerOption
                                 key={answer.id}
                                 answer={answer}
                                 isSelected={isSelected}
                                 showCorrectness={showCorrectness}
                                 showIncorrectness={showIncorrectness}
                                 isDisabled={showFeedback} // Блокируем после выбора
                                 onClick={handleAnswer}
                             />
                         );
                     })}
                 </div>

                {/* Объяснение и Кнопка "Далее" (появляются после ответа) */}
                <AnimatePresence>
                    {showFeedback && (
                        <ExplanationDisplay
                            explanation={feedbackExplanation}
                            isCorrect={isCorrect}
                            onNext={handleNextQuestion}
                            isLastQuestion={currentQuestionIndex >= questions.length - 1}
                        />
                    )}
                </AnimatePresence>

                {/* Кнопка сброса (для отладки или если нужна) */}
                 {/* <button onClick={resetTest} className="mt-8 text-xs text-gray-500 underline">Сбросить тест</button> */}

            </div>
        </motion.div>
    );
}


// --- Не забудьте добавить обработку isLoading, error, isTestComplete ---
// --- как в предыдущем примере, чтобы показать лоадер, ошибку или результаты ---

// Пример экранов (добавить в return выше):

/*
    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                <span className="ml-4 text-lg text-gray-700">Загрузка теста...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-md p-6 text-center max-w-md border border-red-300">
                    <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-red-700 mb-2">Ошибка</h2>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
                    >
                        Обновить страницу
                    </button>
                </div>
            </div>
        );
    }

    if (isTestComplete) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md w-full border border-green-300"
                >
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Тест "{subject?.name}" завершен!</h2>
                    <p className="text-lg text-gray-600 mb-6">
                        Ваш результат: <span className="font-semibold text-blue-600">{finalScore}</span> из {questions.length} ({((finalScore / (questions.length || 1)) * 100).toFixed(0)}%)
                    </p>
                    <div className="space-y-3">
                         <button
                            onClick={resetTest}
                            className="w-full bg-blue-500 text-white px-5 py-2.5 rounded-md hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <RotateCcw className="h-5 w-5" />
                            Пройти еще раз
                        </button>
                         <button
                            onClick={() => router.push('/')} // TODO: Ссылка на список тестов
                            className="w-full bg-gray-200 text-gray-700 px-5 py-2.5 rounded-md hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
                        >
                             <BookOpen className="h-5 w-5" />
                            К списку тестов
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }
*/