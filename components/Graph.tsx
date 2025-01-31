// components/Graph.tsx
'use client';
import { useEffect, useState } from 'react';
import { Question, Answer } from '@/types/supabase';
import { supabase } from '@/hooks/supabase';

interface GraphProps {
  currentQuestion: number;
  onSelect: (answer: Answer) => void;
  theme?: string;
}

const themeMap = {
  sound: 'bg-red-900/30',
  road: 'bg-blue-900/30',
  interior: 'bg-gray-900/30',
  default: 'bg-purple-900/30'
};

export const Graph = ({ currentQuestion, onSelect, theme }: GraphProps) => {
  const [questionData, setQuestionData] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);

  useEffect(() => {
    const fetchQuestionAndAnswers = async () => {
      // Fetch question
      const { data: question } = await supabase
        .from('questions')
        .select('*')
        .eq('id', currentQuestion)
        .single();

      setQuestionData(question);

      // Fetch related answers
      const { data: answers } = await supabase
        .from('answers')
        .select('*')
        .eq('question_id', currentQuestion);

      setAnswers(answers || []);
    };

    fetchQuestionAndAnswers();
  }, [currentQuestion]);

  return (
    <div className={`p-4 rounded-lg transition-colors duration-300 ${themeMap[theme] || themeMap.default}`}>
      {questionData && (
        <>
          <h2 className="text-xl mb-4">{questionData.text}</h2>
          <div className="space-y-2">
            {answers.map((answer) => (
              <button
                key={answer.id}
                onClick={() => onSelect(answer)}
                className="w-full p-2 bg-gray-800 rounded hover:bg-gray-700 transition"
              >
                {answer.text}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

