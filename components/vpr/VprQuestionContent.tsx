import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Image as ImageIcon, AlertTriangle, BarChart3 } from 'lucide-react';

import { SimpleChart } from './SimpleChart';
import { ComparisonDisplay } from './ComparisonDisplay';
import { AxisDisplay } from './AxisDisplay';
import { PlotDisplay } from './PlotDisplay';
import { TableDisplay } from './TableDisplay';
import type { VprVisualDataType } from '@/lib/vprVisualData';

interface VprQuestionContentProps {
    questionData: {
        text: string | undefined;
        visual_data?: VprVisualDataType | any | null;
    };
    questionNumber: number;
    totalQuestions: number;
}

const placeholderRegex = /\[(Диаграмма|Изображение|Рисунок|График|Площадь|Коорд|Таблица).*?\]/gi;

export function VprQuestionContent({
    questionData,
    questionNumber,
    totalQuestions,
}: VprQuestionContentProps) {

    const { text: originalText, visual_data } = questionData;

    if (!originalText && !visual_data) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-brand-blue/60 animate-pulse">
                <BarChart3 className="h-8 w-8 mb-2" />
                <span>Загрузка данных...</span>
            </div>
        );
    }

    const cleanedQuestionText = originalText ? originalText.replace(placeholderRegex, '').trim() : '';

    const renderVisualComponent = () => {
        if (!visual_data) return null;

        try {
            const data = visual_data as VprVisualDataType;
            return (
                <div className="mt-6 mb-8 rounded-xl border border-white/10 bg-black/20 backdrop-blur-md overflow-hidden shadow-lg">
                    <div className="p-4 md:p-6">
                        {data.type === 'table' && <TableDisplay tableData={data} />}
                        {data.type === 'chart' && <SimpleChart chartData={data} />}
                        {data.type === 'compare' && <ComparisonDisplay compareData={data} />}
                        {data.type === 'axis' && <AxisDisplay axisData={data} />}
                        {data.type === 'plot' && <PlotDisplay plotData={data} />}
                        {data.type === 'image' && (
                            <div className="flex flex-col items-center">
                                <div className="relative rounded-lg overflow-hidden border-2 border-white/10 shadow-2xl max-w-full">
                                    <img
                                        src={data.url}
                                        alt={data.alt || 'Изображение'}
                                        className="max-w-full h-auto object-contain max-h-[400px]"
                                    />
                                </div>
                                {data.caption && (
                                    <p className="mt-3 text-sm text-brand-cyan/80 font-mono border-b border-brand-cyan/30 pb-1">
                                        FIG: {data.caption}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            );
        } catch (e) {
            return (
                <div className="mt-4 p-4 border border-red-500/30 rounded-lg bg-red-900/10 flex items-center gap-3 text-red-400">
                   <AlertTriangle className="h-5 w-5" />
                   <span className="text-sm">Ошибка визуализации</span>
                </div>
            );
        }
    };

    return (
        <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-4">
                <span className="px-3 py-1 rounded-full bg-brand-blue/10 border border-brand-blue/30 text-xs font-bold text-brand-blue tracking-wider">
                    ВОПРОС {questionNumber} <span className="opacity-50">/ {totalQuestions}</span>
                </span>
            </div>

            <div className="prose prose-invert prose-lg max-w-none text-light-text/90 leading-relaxed prose-strong:text-brand-cyan prose-headings:text-white">
                <ReactMarkdown>{cleanedQuestionText || (originalText ?? '')}</ReactMarkdown>
            </div>

            {renderVisualComponent()}
        </div>
    );
}