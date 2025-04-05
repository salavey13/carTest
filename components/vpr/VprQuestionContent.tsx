import React from 'react'; // Import React
import ReactMarkdown from 'react-markdown';
import { Image } from 'lucide-react';
// Import the visual components
import { SimpleChart } from './SimpleChart';
import { ComparisonDisplay } from './ComparisonDisplay';
import { AxisDisplay } from './AxisDisplay';
import { PlotDisplay } from './PlotDisplay';
// Import the type if you defined a specific one, otherwise use 'any'
import type { VprVisualDataType } from '@/lib/vprVisualData'; // Or remove if not using the static file

interface VprQuestionContentProps {
    questionData: { // Pass the whole object
        text: string | undefined;
        visual_data?: VprVisualDataType | null; // Use the data from DB
    };
    questionNumber: number; // Position (1-based)
    totalQuestions: number;
    // subjectId and variantNumber are no longer needed here if visual_data is passed directly
}

// Regex to find placeholders (keep for cleaning text even if visual_data exists)
const placeholderRegex = /\[(Диаграмма|Изображение|Рисунок|График|Площадь|Коорд).*?\]/gi;

export function VprQuestionContent({
    questionData,
    questionNumber,
    totalQuestions,
}: VprQuestionContentProps) {

    const { text: originalText, visual_data } = questionData;

    if (!originalText) {
        return <div className="text-center text-light-text/70 my-8">Вопрос загружается...</div>;
    }

    // Clean the text regardless of whether visual_data exists, to remove the tag
    const cleanedQuestionText = originalText.replace(placeholderRegex, '').trim();

    // Check if any placeholder tag *was* present in the original text (for generic fallback)
    const hasGenericPlaceholder = placeholderRegex.test(originalText);

    const renderVisualComponent = () => {
        // Prioritize visual_data from the database
        if (visual_data) {
            try {
                // Assuming visual_data is already parsed JSON by Supabase client
                const data = visual_data as VprVisualDataType; // Cast to the expected type

                switch (data.type) {
                    case 'chart':
                        return <SimpleChart chartData={data} />;
                    case 'compare':
                        return <ComparisonDisplay compareData={data} />;
                    case 'axis':
                         // Ensure points exist before rendering
                        return data.points && data.points.length > 0
                               ? <AxisDisplay axisData={data} />
                               : <div className="text-xs italic text-gray-500 text-center my-2">(Нет данных точек для оси)</div>; // Fallback if points are empty
                    case 'plot':
                        return data.points && data.points.length > 0
                               ? <PlotDisplay plotData={data} />
                               : <div className="text-xs italic text-gray-500 text-center my-2">(Нет данных точек для графика)</div>;
                    default:
                        console.warn("Unknown visual_data type:", (data as any)?.type);
                        return null; // Unknown type
                }
            } catch (e) {
                console.error("Error processing visual_data:", e, visual_data);
                return <div className="text-red-500 text-center my-2">Ошибка отображения визуальных данных.</div>;
            }
        }
        // Fallback: If no visual_data in DB, but a placeholder tag was found in text
        else if (hasGenericPlaceholder) {
            return (
                 <div className="mt-4 p-4 border border-dashed border-gray-600 rounded-md text-center text-gray-400 bg-dark-bg/30">
                    <Image className="h-8 w-8 mx-auto mb-2 text-gray-500" />
                    <p className="text-sm">Здесь должно быть изображение/диаграмма/рисунок/график.</p>
                 </div>
            );
        }

        return null; // No visual data and no placeholder tag found
    };

    return (
        <div className="mb-6 md:mb-8">
            {/* Question Number Header */}
            <p className="text-sm font-medium text-brand-cyan mb-2">
                Вопрос {questionNumber} из {totalQuestions}
            </p>

            {/* Question Text (Cleaned) */}
            <div className="prose prose-invert max-w-none text-light-text text-lg md:text-xl prose-headings:text-brand-cyan prose-a:text-brand-blue prose-strong:text-light-text/90">
                 {/* Use dangerouslySetInnerHTML or a safer alternative if Markdown needs complex HTML */}
                <ReactMarkdown>{cleanedQuestionText || originalText}</ReactMarkdown> {/* Fallback to original if cleaning fails */}
            </div>

            {/* Render Visual Component (or fallback) */}
            {renderVisualComponent()}
        </div>
    );
}