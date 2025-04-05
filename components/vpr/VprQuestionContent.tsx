import ReactMarkdown from 'react-markdown';
import { Image } from 'lucide-react';
import { getVisualDataForQuestion } from '@/lib/vprVisualData';
import { SimpleChart } from './SimpleChart';
import { ComparisonDisplay } from './ComparisonDisplay';
import { AxisDisplay } from './AxisDisplay';
import { PlotDisplay } from './PlotDisplay'; // Import the new PlotDisplay

interface VprQuestionContentProps {
    questionText: string | undefined;
    questionNumber: number; // Position (1-based)
    totalQuestions: number;
    subjectId: number; // Added prop
    variantNumber: number; // Added prop
}

// Regex to find placeholders that should be replaced by components
// Making it slightly more general but still looking for the K<num>V<num> pattern or similar indicators
const visualPlaceholderRegex = /\[(Диаграмма|Изображение|Рисунок|График)[^\]]*?К?\d?В?\d?.*?\]/gi;


export function VprQuestionContent({
    questionText,
    questionNumber,
    totalQuestions,
    subjectId,    // Receive subjectId
    variantNumber // Receive variantNumber
}: VprQuestionContentProps) {

    if (!questionText) {
        return <div className="text-center text-light-text/70 my-8">Вопрос загружается...</div>;
    }

    // Attempt to get specific visual data for this question
    const visualData = getVisualDataForQuestion(subjectId, variantNumber, questionNumber);

    // Remove the placeholder tag from the text if we have specific visual data
    const cleanedQuestionText = visualData
        ? questionText.replace(visualPlaceholderRegex, '').trim()
        : questionText;

    // Check if ANY placeholder exists (for the generic icon fallback if no specific component matches)
    const genericPlaceholderRegex = /\[(Изображение|Диаграмма|Рисунок|График|Площадь|Коорд).*?\]/gi;
    const hasGenericPlaceholder = genericPlaceholderRegex.test(questionText);


    const renderVisualComponent = () => {
        if (!visualData) return null;

        switch (visualData.type) {
            case 'chart':
                return <SimpleChart chartData={visualData} />;
            case 'compare':
                return <ComparisonDisplay compareData={visualData} />;
            case 'axis':
                // Only render if there are points defined
                return visualData.points.length > 0 ? <AxisDisplay axisData={visualData} /> : null;
            case 'plot':
                 return <PlotDisplay plotData={visualData} />;
            default:
                return null;
        }
    };

    return (
        <div className="mb-6 md:mb-8">
            {/* Question Number Header */}
            <p className="text-sm font-medium text-brand-cyan mb-2">
                Вопрос {questionNumber} из {totalQuestions}
            </p>

            {/* Question Text (potentially cleaned) */}
            <div className="prose prose-invert max-w-none text-light-text text-lg md:text-xl prose-headings:text-brand-cyan prose-a:text-brand-blue prose-strong:text-light-text/90">
                <ReactMarkdown>{cleanedQuestionText}</ReactMarkdown>
            </div>

            {/* Render Specific Visual Component */}
            {renderVisualComponent()}

            {/* Fallback Generic Placeholder Icon (if no specific component was rendered but a placeholder tag exists) */}
            {!visualData && hasGenericPlaceholder && (
                 <div className="mt-4 p-4 border border-dashed border-gray-600 rounded-md text-center text-gray-400 bg-dark-bg/30">
                    <Image className="h-8 w-8 mx-auto mb-2 text-gray-500" />
                    <p className="text-sm">Здесь должно быть изображение/диаграмма/рисунок/график.</p>
                 </div>
            )}
        </div>
    );
}