"use client";

import React from 'react';
import { ValidationStatus, ValidationIssue, IssueType } from '../../hooks/useCodeParsingAndValidation'; // Adjust path
import { FaRotate, FaCircleCheck, FaBroom, FaClipboardQuestion, FaTriangleExclamation, FaPoo } from 'react-icons/fa6'; // Changed icon, added FaPoo
import VibeContentRenderer from '@/components/VibeContentRenderer'; // Import Vibe renderer

interface ValidationStatusProps {
    status: ValidationStatus;
    issues: ValidationIssue[];
    onAutoFix: () => void;
    // REMOVED onCopyPrompt prop as the button is removed
    // onCopyPrompt: () => void;
    isFixDisabled: boolean;
}

export const ValidationStatusIndicator: React.FC<ValidationStatusProps> = ({
    status,
    issues,
    onAutoFix,
    // REMOVED onCopyPrompt prop
    // onCopyPrompt,
    isFixDisabled // Receive this prop
}) => {

    // Issues fixable by the autoFix function (icon, useClient, import)
    const fixableIssues = issues.filter(issue => issue.fixable);
    // Issues related to skipped comments '// ...' (AI should handle)
    const skippedCommentIssues = issues.filter(issue => issue.type === 'skippedComment');
    // Skipped code blocks '/* ... */' (AI should handle)
    const skippedCodeBlockIssues = issues.filter(issue => issue.type === 'skippedCodeBlock');
    // Sneaky empty blocks { /* ... */ }
    const sneakyEmptyBlockIssues = issues.filter(issue => issue.type === 'sneakyEmptyBlock');
    // Other non-fixable errors
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
                // Count only issues that are *not* handled by the CodeRestorer button (which is now removed)
                const displayableErrorCount = sneakyEmptyBlockIssues.length + otherErrors.length;
                let errorMsg = `Найдены проблемы (${displayableErrorCount}), требующие внимания`;
                if (sneakyEmptyBlockIssues.length > 0) {
                    errorMsg += ` (включая ${sneakyEmptyBlockIssues.length} пустых блоков!)`;
                }
                 if (skippedCommentIssues.length > 0) errorMsg += ` + пропущенные комменты (${skippedCommentIssues.length})`; // Also mention skipped in error tooltip
                 if (skippedCodeBlockIssues.length > 0) errorMsg += ` + пропущенные блоки (${skippedCodeBlockIssues.length})`; // Also mention skipped in error tooltip
                return errorMsg;
           default: return "Статус проверки";
       }
   }

    const getIndicatorIcon = () => {
         switch (status) {
            case 'validating': return <FaRotate size={16} className="text-blue-400 animate-spin" />;
            case 'success': return <FaCircleCheck size={16} className="text-green-500" />;
            case 'warning': return <FaTriangleExclamation size={16} className="text-yellow-500" />;
            case 'error': return <FaTriangleExclamation size={16} className="text-red-500" />;
            default: return null;
        }
    }

    // Determine if there are *any* actionable or noteworthy issues visible here
    const showActionButtons = (status === 'warning' || status === 'error') &&
                               (fixableIssues.length > 0 || sneakyEmptyBlockIssues.length > 0);


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
                    {/* REMOVED Skipped Comment Prompt Button */}
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