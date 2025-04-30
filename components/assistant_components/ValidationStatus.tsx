"use client";

import React from 'react';
// REMOVED Tooltip Imports
import { ValidationStatus, ValidationIssue } from '../../hooks/useCodeParsingAndValidation'; // Adjust path
import { FaRotate, FaCircleCheck, FaCircleExclamation, FaBroom, FaClipboardQuestion, FaTriangleExclamation } from 'react-icons/fa6'; // Added FaTriangleExclamation explicitly

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
    // Other non-fixable errors
    const otherErrors = issues.filter(issue => !issue.fixable && !issue.restorable);


    const getIndicatorTooltip = (): string => {
        switch (status) {
           case 'validating': return "Идет проверка кода...";
           case 'success': return "Проверка пройдена!";
           case 'warning': return `Найдены исправимые проблемы (${fixableIssues.length})`;
           case 'error':
                const errorCount = skippedCommentIssues.length + skippedCodeBlockIssues.length + otherErrors.length;
                return `Найдены проблемы (${errorCount}), требующие внимания`;
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

    return (
        <div className="flex flex-col items-end gap-1 mt-1">
             {/* Indicator Icon */}
             <div className="h-4 flex items-center justify-center" title={getIndicatorTooltip()}>
                 {getIndicatorIcon()}
             </div>

            {/* Action Buttons for Fixable / Skipped Comments */}
            {(status === 'warning' || status === 'error') && (fixableIssues.length > 0 || skippedCommentIssues.length > 0) ? (
                 <div className="flex gap-2 items-center flex-wrap justify-end">
                     {fixableIssues.length > 0 && (
                          <button
                             onClick={onAutoFix}
                             disabled={isFixDisabled} // Use the disabled prop
                             className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-green-600 hover:bg-green-500 text-white transition shadow text-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                             title="Автоматически исправить (use client, import React, icon names)" // Updated tooltip
                         >
                             <FaBroom size={12} /> Исправить ({fixableIssues.length})
                         </button>
                     )}
                     {skippedCommentIssues.length > 0 && (
                            <button
                                onClick={onCopyPrompt}
                                disabled={isFixDisabled} // Use the disabled prop
                                className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-orange-600 hover:bg-orange-500 text-white transition shadow text-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Скопировать prompt для восстановления '// ..'"
                            >
                                <FaClipboardQuestion size={12}/> Prompt Fix '// ..' ({skippedCommentIssues.length})
                            </button>
                     )}
                 </div>
            ) : null}
        </div>
    );
};
ValidationStatusIndicator.displayName = 'ValidationStatusIndicator';