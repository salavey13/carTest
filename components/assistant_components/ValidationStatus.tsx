"use client";

import React from 'react';
import { ValidationStatus, ValidationIssue, IssueType } from '../../hooks/useCodeParsingAndValidation'; // Adjust path
import { FaRotate, FaCircleCheck, FaBroom, FaClipboardQuestion, FaTriangleExclamation, FaPoo } from 'react-icons/fa6'; 
import VibeContentRenderer from '@/components/VibeContentRenderer'; 

interface ValidationStatusProps {
    status: ValidationStatus;
    issues: ValidationIssue[];
    onAutoFix: () => void;
    isFixDisabled: boolean;
}

export const ValidationStatusIndicator: React.FC<ValidationStatusProps> = ({
    status,
    issues,
    onAutoFix,
    isFixDisabled 
}) => {

    const fixableIssues = issues.filter(issue => issue.fixable);
    const skippedCommentIssues = issues.filter(issue => issue.type === 'skippedComment');
    const skippedCodeBlockIssues = issues.filter(issue => issue.type === 'skippedCodeBlock');
    const sneakyEmptyBlockIssues = issues.filter(issue => issue.type === 'sneakyEmptyBlock');
    const otherErrors = issues.filter(issue => !issue.fixable && issue.type !== 'sneakyEmptyBlock' && issue.type !== 'skippedCodeBlock' && issue.type !== 'skippedComment');

    const getIndicatorTooltip = (): string => {
        switch (status) {
           case 'validating': return "Идет проверка кода...";
           case 'success': return "Проверка пройдена!";
           case 'warning':
                let warnMsg = `Найдены исправимые проблемы (${fixableIssues.length})`;
                if (skippedCommentIssues.length > 0) warnMsg += ` + пропущенные комменты (${skippedCommentIssues.length})`;
                if (skippedCodeBlockIssues.length > 0) warnMsg += ` + пропущенные блоки (${skippedCodeBlockIssues.length})`;
                return warnMsg;
           case 'error':
                const displayableErrorCount = sneakyEmptyBlockIssues.length + otherErrors.length;
                let errorMsg = `Найдены проблемы (${displayableErrorCount}), требующие внимания`;
                if (sneakyEmptyBlockIssues.length > 0) {
                    errorMsg += ` (включая ${sneakyEmptyBlockIssues.length} пустых блоков!)`;
                }
                 if (skippedCommentIssues.length > 0) errorMsg += ` + пропущенные комменты (${skippedCommentIssues.length})`; 
                 if (skippedCodeBlockIssues.length > 0) errorMsg += ` + пропущенные блоки (${skippedCodeBlockIssues.length})`; 
                return errorMsg;
           default: return "Статус проверки";
       }
   }

    const getIndicatorIcon = () => {
         switch (status) {
            case 'validating': return <FaRotate size={16} className="text-brand-blue animate-spin" />; // Use theme color
            case 'success': return <FaCircleCheck size={16} className="text-brand-green" />; // Use theme color
            case 'warning': return <FaTriangleExclamation size={16} className="text-brand-yellow" />; // Use theme color
            case 'error': return <FaTriangleExclamation size={16} className="text-destructive" />; // Use theme color
            default: return null;
        }
    }

    const showActionButtons = (status === 'warning' || status === 'error') &&
                               (fixableIssues.length > 0 || sneakyEmptyBlockIssues.length > 0);

    return (
        <div className="flex flex-col items-end gap-1 mt-1">
             <div className="h-4 flex items-center justify-center" title={getIndicatorTooltip()}>
                 {getIndicatorIcon()}
             </div>

            {showActionButtons && (
                 <div className="flex gap-2 items-center flex-wrap justify-end">
                     {fixableIssues.length > 0 && (
                          <button
                             onClick={onAutoFix}
                             disabled={isFixDisabled}
                             className="flex items-center justify-center gap-1 px-2 py-1 text-xs rounded bg-brand-green hover:bg-brand-green/80 text-primary-foreground transition shadow text-nowrap disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]" // Use theme colors
                             title="Автоматически исправить (use client, import React, icon names)"
                         >
                             <FaBroom size={12} /> Исправить ({fixableIssues.length})
                         </button>
                     )}
                     {sneakyEmptyBlockIssues.length > 0 && (
                         <div
                             className="flex items-center justify-center gap-1 px-2 py-1 text-xs rounded bg-destructive/70 text-destructive-foreground shadow border border-destructive/50 text-nowrap min-w-[100px] cursor-help" // Use theme colors
                             title={`Найдены пустые блоки { /* ... */ } (${sneakyEmptyBlockIssues.length}). Это почти наверняка ошибка AI. Удалите их или замените кодом.`}
                         >
                             <FaPoo size={12} /> Пуст. блоки ({sneakyEmptyBlockIssues.length})
                         </div>
                     )}
                 </div>
            )}
        </div>
    );
};
ValidationStatusIndicator.displayName = 'ValidationStatusIndicator';