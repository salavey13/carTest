import ReactMarkdown from 'react-markdown';
import { Image } from 'lucide-react';

interface VprQuestionContentProps {
    questionText: string | undefined;
    questionNumber: number;
    totalQuestions: number;
}

export function VprQuestionContent({ questionText, questionNumber, totalQuestions }: VprQuestionContentProps) {
    if (!questionText) {
        return <div className="text-center text-light-text/70 my-8">Вопрос загружается...</div>;
    }

    // Regex to find placeholders like [Изображение: ...] or [Рисунок] etc.
    const placeholderRegex = /\[(Изображение|Диаграмма|Рисунок).*?\]/g;
    const hasPlaceholder = placeholderRegex.test(questionText);

    return (
        <div className="mb-6 md:mb-8">
            <p className="text-sm font-medium text-brand-cyan mb-2">
                Вопрос {questionNumber} из {totalQuestions}
            </p>
            <div className="prose prose-invert max-w-none text-light-text text-lg md:text-xl prose-headings:text-brand-cyan prose-a:text-brand-blue prose-strong:text-light-text/90">
                {/* Render the original text including the placeholder tag for context */}
                <ReactMarkdown>{questionText}</ReactMarkdown>
            </div>

            {/* Render a visual placeholder if the tag was found */}
            {hasPlaceholder && (
                 <div className="mt-4 p-4 border border-dashed border-gray-600 rounded-md text-center text-gray-400 bg-dark-bg/30">
                    <Image className="h-8 w-8 mx-auto mb-2 text-gray-500" />
                    <p className="text-sm">Здесь должно быть изображение/диаграмма/рисунок, относящееся к вопросу.</p>
                </div>
            )}
        </div>
    );
}