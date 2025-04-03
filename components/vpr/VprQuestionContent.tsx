import ReactMarkdown from 'react-markdown';
import { Image } from 'lucide-react'; // Or use Next/Image

interface VprQuestionContentProps {
    questionText: string | undefined;
    questionNumber: number;
    totalQuestions: number;
}

export function VprQuestionContent({ questionText, questionNumber, totalQuestions }: VprQuestionContentProps) {
    if (!questionText) {
        return <div className="text-center text-light-text/70 my-8">Вопрос загружается...</div>;
    }

    // Updated Regex to be less greedy and handle multiple placeholders
    const placeholderRegex = /\[(Изображение|Диаграмма|Рисунок).*?\]/g;
    const hasPlaceholder = placeholderRegex.test(questionText);
    // Keep the placeholder text in the main display for context, but render the visual placeholder below
    // const cleanText = questionText.replace(placeholderRegex, '').trim(); // Option to remove it

    return (
        <div className="mb-6 md:mb-8">
            <p className="text-sm font-medium text-brand-cyan mb-2">
                Вопрос {questionNumber} из {totalQuestions}
            </p>
            {/* Render Markdown for question text */}
            {/* Added prose styling classes */}
            <div className="prose prose-invert max-w-none text-light-text text-lg md:text-xl prose-headings:text-brand-cyan prose-a:text-brand-blue prose-strong:text-light-text/90">
                {/* Render the original text including the placeholder tag */}
                <ReactMarkdown>{questionText}</ReactMarkdown>
            </div>

            {/* Placeholder for Image/Diagram */}
            {hasPlaceholder && (
                 // Removed check for cleanText - always show placeholder if tag exists
                 <div className="mt-4 p-4 border border-dashed border-gray-600 rounded-md text-center text-gray-400 bg-dark-bg/30">
                    <Image className="h-8 w-8 mx-auto mb-2 text-gray-500" />
                    <p className="text-sm">Здесь должно быть изображение/диаграмма/рисунок, относящееся к вопросу.</p>
                    {/* In a real app, you might fetch and display an actual image based on question ID/placeholder content */}
                </div>
            )}
        </div>
    );
}