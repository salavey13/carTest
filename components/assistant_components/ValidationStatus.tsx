"use client";

import React from 'react';
import { ValidationStatus, ValidationIssue, IssueType } from '../../hooks/useCodeParsingAndValidation'; // Adjust path
import { FaRotate, FaCircleCheck, FaBroom, FaClipboardQuestion, FaTriangleExclamation, FaPoo } from 'react-icons/fa6'; // Changed icon, added FaPoo
import VibeContentRenderer from '@/components/VibeContentRenderer'; // Import Vibe renderer

interface ValidationStatusProps {
    status: ValidationStatus;
    issues: ValidationIssue[];
    onAutoFix: () => void;
    onCopyPrompt: () => void;
    isFixDisabled: boolean;
}

export const ValidationStatusIndicator: React.FC<ValidationStatusProps> = ({
    status,
    issues,
    onAutoFix,
    onCopyPrompt,
    isFixDisabled // Receive this prop
}) => {

    // Issues fixable by the autoFix function (icon, useClient, import)
    const fixableIssues = issues.filter(issue => issue.fixable);
    // Issues related to skipped comments (cannot be restored or auto-fixed currently)
    const skippedCommentIssues = issues.filter(issue => issue.type === 'skippedComment');
    // Skipped code blocks (handled by CodeRestorer component)
    const skippedCodeBlockIssues = issues.filter(issue => issue.type === 'skippedCodeBlock');
    // Sneaky empty blocks { /* ... */ }
    const sneakyEmptyBlockIssues = issues.filter(issue => issue.type === 'sneakyEmptyBlock');
    // Other non-fixable errors
    const otherErrors = issues.filter(issue => !issue.fixable && !issue.restorable && issue.type !== 'sneakyEmptyBlock');


    const getIndicatorTooltip = (): string => {
        switch (status) {
           case 'validating': return "Идет проверка кода...";
           case 'success': return "Проверка пройдена!";
           case 'warning': return `Найдены исправимые проблемы (${fixableIssues.length})`;
           case 'error':
                // Count only issues that are *not* handled by the CodeRestorer button
                const displayableErrorCount = skippedCommentIssues.length + sneakyEmptyBlockIssues.length + otherErrors.length;
                let errorMsg = `Найдены проблемы (${displayableErrorCount}), требующие внимания`;
                if (sneakyEmptyBlockIssues.length > 0) {
                    errorMsg += ` (включая ${sneakyEmptyBlockIssues.length} пустых блоков!)`;
                }
                return errorMsg;
           default: return "Статус проверки";
       }
   }

    const getIndicatorIcon = () => {
         switch (status) {
            case 'validating': return <FaRotate size={16} className="text-blue-400 animate-spin" />;
            case 'success': return <FaCircleCheck size={16} className="text-green-500" />;
            case 'warning': return <FaTriangleExclamation size={16} className="text-yellow-500" />; // Changed to correct icon
            case 'error': return <FaTriangleExclamation size={16} className="text-red-500" />; // Changed to correct icon
            default: return null;
        }
    }

    // Determine if there are *any* actionable or noteworthy issues visible here
    const showActionButtons = (status === 'warning' || status === 'error') &&
                               (fixableIssues.length > 0 || skippedCommentIssues.length > 0 || sneakyEmptyBlockIssues.length > 0);


    return (
        <div className="flex flex-col items-end gap-1 mt-1">
             {/* Indicator Icon */}
             <div className="h-4 flex items-center justify-center" title={getIndicatorTooltip()}>
                 {getIndicatorIcon()}
             </div>

            {/* Action Buttons Container - uses flex-wrap */}
            {showActionButtons && (
                 <div className="flex gap-2 items-center flex-wrap justify-end">
                     {/* Auto-Fix Button */}
                     {fixableIssues.length > 0 && (
                          <button
                             onClick={onAutoFix}
                             disabled={isFixDisabled}
                             className="flex items-center justify-center gap-1 px-2 py-1 text-xs rounded bg-green-600 hover:bg-green-500 text-white transition shadow text-nowrap disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]" // Added min-width
                             title="Автоматически исправить (use client, import React, icon names)"
                         >
                             <FaBroom size={12} /> Исправить ({fixableIssues.length})
                         </button>
                     )}
                     {/* Skipped Comment Prompt Button */}
                     {skippedCommentIssues.length > 0 && (
                            <button
                                onClick={onCopyPrompt}
                                disabled={isFixDisabled}
                                className="flex items-center justify-center gap-1 px-2 py-1 text-xs rounded bg-orange-600 hover:bg-orange-500 text-white transition shadow text-nowrap disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]" // Added min-width
                                title="Скопировать prompt для восстановления '// ..'"
                            >
                                <FaClipboardQuestion size={12}/> Prompt Fix '// ..' ({skippedCommentIssues.length})
                            </button>
                     )}
                    {/* Sneaky Skip Indicator */}
                     {sneakyEmptyBlockIssues.length > 0 && (
                         <div
                             className="flex items-center justify-center gap-1 px-2 py-1 text-xs rounded bg-red-700/50 text-red-300 shadow border border-red-600/50 text-nowrap min-w-[100px] cursor-help" // Added min-width and cursor-help
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