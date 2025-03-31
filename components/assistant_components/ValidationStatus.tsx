import React from 'react';
import { Tooltip } from '../AICodeAssistant'; // Adjust path
import { ValidationStatus, ValidationIssue } from '../../hooks/useCodeParsingAndValidation'; // Adjust path
import { FaRotate, FaCircleCheck, FaCircleExclamation, FaBroom, FaClipboardQuestion } from 'react-icons/fa6';

interface ValidationStatusProps {
    status: ValidationStatus;
    issues: ValidationIssue[];
    onAutoFix: () => void;
    onCopyPrompt: () => void;
    // Removed onOpenRestoreModal - CodeRestorer handles its own modal now
}

export const ValidationStatusIndicator: React.FC<ValidationStatusProps> = ({
    status,
    issues,
    onAutoFix,
    onCopyPrompt,
}) => {

    // Issues fixable by the autoFix function (icon, useClient, import)
    const fixableIssues = issues.filter(issue => issue.fixable);
    // Issues related to skipped comments (cannot be restored or auto-fixed currently)
    const skippedCommentIssues = issues.filter(issue => issue.type === 'skippedComment');
    // Other non-fixable, non-restorable issues
    const otherErrors = issues.filter(issue => !issue.fixable && issue.type !== 'skippedCodeBlock' && issue.type !== 'skippedComment');

    const getIndicator = () => {
         switch (status) {
            case 'validating': return <Tooltip text="Проверка..." position="left"><FaRotate size={16} className="text-blue-400 animate-spin" /></Tooltip>;
            case 'success': return <Tooltip text="OK!" position="left"><FaCircleCheck size={16} className="text-green-500" /></Tooltip>;
            case 'warning': return <Tooltip text={`Есть авто-исправления (${fixableIssues.length})`} position="left"><FaCircleExclamation size={16} className="text-yellow-500" /></Tooltip>;
            case 'error': return <Tooltip text={`Есть проблемы (${issues.filter(i => !i.fixable).length})`} position="left"><FaCircleExclamation size={16} className="text-red-500" /></Tooltip>;
            default: return null;
        }
    }

    return (
        <div className="flex flex-col items-end gap-1 mt-1">
             <div className="h-4 flex items-center justify-center"> {getIndicator()} </div>
            {/* Action Buttons for Fixable / Skipped Comments */}
            {(status === 'warning' || status === 'error') && (fixableIssues.length > 0 || skippedCommentIssues.length > 0) ? (
                 <div className="flex gap-2 items-center flex-wrap justify-end">
                     {fixableIssues.length > 0 && (
                         <button onClick={onAutoFix} className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-green-600 hover:bg-green-500 text-white transition shadow text-nowrap">
                             <FaBroom size={12} /> Исправить ({fixableIssues.length})
                         </button>
                     )}
                     {skippedCommentIssues.length > 0 && (
                          <button onClick={onCopyPrompt} className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-orange-600 hover:bg-orange-500 text-white transition shadow text-nowrap">
                              <FaClipboardQuestion size={12}/> Prompt Fix '//...' ({skippedCommentIssues.length})
                          </button>
                     )}
                 </div>
            ) : null}
        </div>
    );
};
ValidationStatusIndicator.displayName = 'ValidationStatusIndicator';