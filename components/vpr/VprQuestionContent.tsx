import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Image as ImageIcon, AlertTriangle } from 'lucide-react';

import { SimpleChart } from './SimpleChart';
import { ComparisonDisplay } from './ComparisonDisplay';
import { AxisDisplay } from './AxisDisplay';
import { PlotDisplay } from './PlotDisplay';
import { TableDisplay } from './TableDisplay'; // <<< IMPORT THIS
import type { VprVisualDataType } from '@/lib/vprVisualData';

interface VprQuestionContentProps {
    questionData: {
        text: string | undefined;
        visual_data?: VprVisualDataType | any | null;
    };
    questionNumber: number;
    totalQuestions: number;
}

// Regex to clean placeholders from text
const placeholderRegex = /\[(Диаграмма|Изображение|Рисунок|График|Площадь|Коорд|Таблица).*?\]/gi;

export function VprQuestionContent({
    questionData,
    questionNumber,
    totalQuestions,
}: VprQuestionContentProps) {

    const { text: originalText, visual_data } = questionData;

    if (!originalText && !visual_data) {
        return <div className="text-center text-light-text/70 my-8 animate-pulse">Вопрос загружается...</div>;
    }

    const cleanedQuestionText = originalText ? originalText.replace(placeholderRegex, '').trim() : '';

    const renderVisualComponent = () => {
        if (!visual_data) {
            if (originalText && placeholderRegex.test(originalText)) {
                // Minimal fallback if SQL didn't have the JSON yet
                return (
                     <div className="mt-4 p-4 border border-dashed border-gray-700 rounded-lg text-center bg-gray-800/30">
                        <ImageIcon className="h-8 w-8 mx-auto mb-2 text-gray-600" />
                        <p className="text-sm text-gray-500">Визуализация данных отсутствует.</p>
                     </div>
                );
            }
            return null;
        }

        try {
            const data = visual_data as VprVisualDataType;

            switch (data?.type) {
                case 'table':
                    return <TableDisplay tableData={data} />; // <<< NEW
                case 'chart':
                    return <SimpleChart chartData={data} />;
                case 'compare':
                    return <ComparisonDisplay compareData={data} />;
                case 'axis':
                    return <AxisDisplay axisData={data} />;
                case 'plot':
                    return <PlotDisplay plotData={data} />;
                case 'image':
                    return (
                        <div className="my-6 text-center">
                            <img
                                src={data.url}
                                alt={data.alt || 'Изображение'}
                                className="max-w-full h-auto mx-auto rounded-lg border border-gray-700 shadow-md"
                                style={{
                                    maxHeight: data.height ? `${data.height}px` : '300px',
                                }}
                             />
                             {data.caption && <p className="text-xs text-gray-400 mt-2 italic">{data.caption}</p>}
                        </div>
                    );
                default:
                     return null;
            }
        } catch (e) {
            console.error("Visual render error:", e);
            return null;
        }
    };

    return (
        <div className="mb-6 md:mb-8">
            <p className="text-xs font-bold text-brand-cyan uppercase tracking-wider mb-3 opacity-80">
                Вопрос {questionNumber} / {totalQuestions}
            </p>

            <div className="prose prose-invert prose-lg max-w-none text-light-text mb-6 leading-relaxed">
                <ReactMarkdown>{cleanedQuestionText || (originalText ?? '')}</ReactMarkdown>
            </div>

            {renderVisualComponent()}
        </div>
    );
}