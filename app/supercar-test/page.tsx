// app/page.tsx
'use client';
import { useTelegram } from '@/hooks/useTelegram';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/hooks/supabase';
import { Graph } from '@/components/Graph';
export default function SupercarTest() {
  const { user } = useTelegram();
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [selectedAnswers, setSelectedAnswers] = useState([]);
  const [testProgress, setTestProgress] = useState(null);

  // Загрузка прогресса при старте
  useEffect(() => {
    const loadProgress = async () => {
      if (user?.id) {
        const { data } = await supabase
          .from('users')
          .select('test_progress')
          .eq('user_id', user.id)
          .single();

        if (data?.test_progress) {
          setCurrentQuestion(data.test_progress.currentQuestion);
          setSelectedAnswers(data.test_progress.selectedAnswers);
          setTestProgress(data.test_progress);
        }
      }
    };
    
    loadProgress();
  }, [user]);

  // Проверка прав администратора
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

  // Обработчик выбора ответа
  const handleAnswer = async (answer) => {
    const updatedAnswers = [...selectedAnswers, answer];
    
    // Сохранение прогресса
    const progress = {
      currentQuestion: answer.nextQuestion || currentQuestion + 1,
      selectedAnswers: updatedAnswers
    };

    await supabase
      .from('users')
      .update({ test_progress: progress })
      .eq('user_id', user?.id);

    setSelectedAnswers(updatedAnswers);
    setCurrentQuestion(progress.currentQuestion);
  };

  // Сброс теста
  const resetTest = () => {
    setCurrentQuestion(1);
    setSelectedAnswers([]);
    setTestProgress(null);
  };

/*  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState([])
  const [result, setResult] = useState(null)

  const handleAnswer = (answer) => {
    const newAnswers = [...answers, answer]
    setAnswers(newAnswers)

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    } else {
      // Calculate result
      const resultCounts = newAnswers.reduce((acc, curr) => {
        acc[curr] = (acc[curr] || 0) + 1
        return acc
      }, {})
      const finalResult = Object.keys(resultCounts).reduce((a, b) => (resultCounts[a] > resultCounts[b] ? a : b))
      setResult(finalResult)
    }
  }

  if (result) {
    return <ResultDisplay result={result} />
  }

  const question = questions[currentQuestion]*/

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <nav className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">🚀 Supercar Match</h1>
        {isAdmin && (
          <Link href="/admin" className="bg-cyan-500 px-4 py-2 rounded-lg">
            Панель администратора
          </Link>
        )}
      </nav>

      {testProgress && (
        <div className="mb-4">
          <button 
            onClick={() => {
              supabase
                .from('users')
                .update({ test_progress: null })
                .eq('id', user?.id);
              resetTest();
            }}
            className="bg-red-500 p-2 rounded"
          >
            Начать заново
          </button>
        </div>
      )}

      <Graph 
        currentQuestion={currentQuestion} 
        onSelect={handleAnswer}
        theme={currentQuestion.theme}
      />
    </div>
    
  )
}

/*<div className="min-h-screen bg-black text-[#00ff9d] pt-20 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none select-none overflow-hidden whitespace-nowrap text-[8px] leading-none binary-background">
        {Array(100).fill("01").join("")}
      </div>
      <div className="container mx-auto px-4 py-8 relative z-10">
        <Card className="bg-black/50 border-[#00ff9d]/20 max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center text-[#00ff9d] font-mono">
              ТЕСТ_НА_ПОДБОР_КИБЕР-СУПЕРКАРА//
            </CardTitle>
          </CardHeader>
          <CardContent>
            <h2 className="text-xl mb-4 font-mono">{question.text}</h2>
            <div className="space-y-4">
              {question.answers.map((answer, index) => (
                <Button
                  key={index}
                  onClick={() => handleAnswer(answer.result)}
                  className="w-full bg-[#00ff9d] text-black hover:bg-[#00ffff] font-mono"
                >
                  {answer.text}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>*/