import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Image as ImageIcon, AlertTriangle } from 'lucide-react'; // Renamed Image to ImageIcon

// Import the visual components
import { SimpleChart } from './SimpleChart';
import { ComparisonDisplay } from './ComparisonDisplay';
import { AxisDisplay } from './AxisDisplay';
import { PlotDisplay } from './PlotDisplay';
// Import the type definition
import type { VprVisualDataType } from '@/lib/vprVisualData';

interface VprQuestionContentProps {
    questionData: {
        text: string | undefined;
        visual_data?: VprVisualDataType | any | null; // Use the data from DB, allow 'any' for flexibility if parsing fails client-side
    };
    questionNumber: number;
    totalQuestions: number;
}

// Regex to find placeholders ONLY for cleaning text, not for rendering logic
const placeholderRegex = /\[(Диаграмма|Изображение|Рисунок|График|Площадь|Коорд).*?\]/gi;

export function VprQuestionContent({
    questionData,
    questionNumber,
    totalQuestions,
}: VprQuestionContentProps) {

    const { text: originalText, visual_data } = questionData;

    if (!originalText && !visual_data) {
        return <div className="text-center text-light-text/70 my-8">Вопрос загружается...</div>;
    }

    // Clean the text to remove tags like [Рисунок], [Диаграмма], etc.
    // The actual visual rendering is handled by visual_data now.
    const cleanedQuestionText = originalText ? originalText.replace(placeholderRegex, '').trim() : '';

    const renderVisualComponent = () => {
        if (!visual_data) {
            // Check if a placeholder tag existed even if visual_data is null/missing
            // This helps identify questions that *should* have visuals but don't yet.
            if (originalText && placeholderRegex.test(originalText)) {
                return (
                     <div className="mt-4 p-4 border border-dashed border-gray-600 rounded-md text-center text-gray-400 bg-dark-bg/30">
                        <ImageIcon className="h-8 w-8 mx-auto mb-2 text-gray-500" />
                        <p className="text-sm">Визуальный элемент (диаграмма/рисунок/график) для этого вопроса отсутствует в базе данных.</p>
                     </div>
                );
            }
            return null; // No visual data and no placeholder tag found
        }

        // Attempt to render based on visual_data type
        try {
            // Supabase client usually parses JSONB automatically, but double-check type
            const data = visual_data as VprVisualDataType;

            switch (data?.type) {
                case 'chart':
                    return <SimpleChart chartData={data} />;
                case 'compare':
                    return <ComparisonDisplay compareData={data} />;
                case 'axis':
                    return data.points && data.points.length > 0
                           ? <AxisDisplay axisData={data} />
                           : <div className="text-xs italic text-gray-500 text-center my-2">(Нет данных точек для оси)</div>;
                case 'plot':
                    return data.points && data.points.length > 0
                           ? <PlotDisplay plotData={data} />
                           : <div className="text-xs italic text-gray-500 text-center my-2">(Нет данных точек для графика)</div>;
                case 'image': // Handle direct image type
                    return (
                        <div className="my-4 text-center">
                            <img
                                src={data.url}
                                alt={data.alt || 'Изображение к вопросу'}
                                className="max-w-full h-auto mx-auto rounded-md border border-gray-600"
                                style={{
                                    width: data.width || 'auto',
                                    height: data.height || 'auto'
                                }}
                             />
                             {data.caption && <p className="text-xs text-gray-400 mt-2 italic">{data.caption}</p>}
                        </div>
                    );
                default:
                    console.warn("Unknown or missing visual_data type:", data?.type, data);
                     return (
                         <div className="mt-4 p-3 border border-yellow-500/50 rounded-md text-center text-yellow-400 bg-yellow-900/20">
                            <AlertTriangle className="h-6 w-6 mx-auto mb-1 text-yellow-500" />
                            <p className="text-xs">Неизвестный тип визуальных данных.</p>
                         </div>
                     );
            }
        } catch (e) {
            console.error("Error processing or rendering visual_data:", e, visual_data);
            return (
                <div className="mt-4 p-3 border border-red-500/50 rounded-md text-center text-red-400 bg-red-900/20">
                   <AlertTriangle className="h-6 w-6 mx-auto mb-1 text-red-500" />
                   <p className="text-xs">Ошибка отображения визуальных данных.</p>
                </div>
            );
        }
    };

    return (
        <div className="mb-6 md:mb-8">
            {/* Question Number Header */}
            <p className="text-sm font-medium text-brand-cyan mb-2">
                Вопрос {questionNumber} из {totalQuestions}
            </p>

            {/* Question Text (Cleaned + Markdown) */}
            {/* Added prose classes for Tailwind Typography styling */}
            <div className="prose prose-invert prose-lg md:prose-xl max-w-none text-light-text mb-4 prose-headings:text-brand-cyan prose-a:text-brand-blue prose-strong:text-light-text/90 prose-img:rounded-md prose-img:border prose-img:border-gray-600 prose-img:max-w-full prose-img:h-auto prose-img:my-3">
                 {/* Use ReactMarkdown to render text, allowing embedded images via Markdown */}
                <ReactMarkdown>
                    {cleanedQuestionText || (originalText ?? '')}
                </ReactMarkdown>
            </div>

            {/* Render Visual Component (or fallback) */}
            {renderVisualComponent()}
        </div>
    );
}