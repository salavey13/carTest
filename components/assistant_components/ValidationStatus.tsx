import React from 'react';
import { motion } from 'framer-motion';
import { Tooltip } from '../AICodeAssistant'; // Adjust path
import { ValidationStatus, ValidationIssue } from '../../hooks/useCodeParsingAndValidation'; // Adjust path
import { FaRotate, FaCircleCheck, FaCircleExclamation, FaBroom, FaClipboardQuestion } from 'react-icons/fa6';

interface ValidationStatusProps {
    status: ValidationStatus;
    issues: ValidationIssue[];
    onAutoFix: () => void;
    onCopyPrompt: () => void;
}

export const ValidationStatusIndicator: React.FC<ValidationStatusProps> = ({
    status,
    issues,
    onAutoFix,
    onCopyPrompt
}) => {

    const canAutoFix = issues.some(issue => issue.fixable);
    const hasSkippedContent = issues.some(issue => issue.type === 'skippedContent');
    const hasOtherErrors = issues.some(issue => !issue.fixable && issue.type !== 'skippedContent');

    const getIndicator = () => {
         switch (status) {
            case 'validating':
                return <Tooltip text="Идет проверка кода..." position="left"><FaRotate size={16} className="text-blue-400 animate-spin" /></Tooltip>;
            case 'success':
                return <Tooltip text="Проверка пройдена!" position="left"><FaCircleCheck size={16} className="text-green-500" /></Tooltip>;
            case 'warning': // Fixable issues only
                return <Tooltip text={`Найдены исправимые проблемы (${issues.length})`} position="left"><FaCircleExclamation size={16} className="text-yellow-500" /></Tooltip>;
            case 'error': // Unfixable issues found
                 return <Tooltip text={`Найдены проблемы (${issues.length}), требующие внимания`} position="left"><FaCircleExclamation size={16} className="text-red-500" /></Tooltip>;
            case 'idle':
            default:
                 return null; // Hide indicator when idle
        }
    }

    return (
        <div className="flex flex-col items-end gap-1 mt-1">
             {/* Indicator Icon */}
             <div className="h-4 flex items-center justify-center">
                {getIndicator()}
             </div>

            {/* Action Buttons */}
            {status === 'warning' || status === 'error' ? (
                 <div className="flex gap-2 items-center flex-wrap justify-end">
                     {canAutoFix && (
                         <button
                             onClick={onAutoFix}
                             className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-green-600 hover:bg-green-500 text-white transition shadow text-nowrap"
                         >
                             <FaBroom size={12} /> Исправить
                         </button>
                     )}
                     {hasSkippedContent && (
                          <button
                              onClick={onCopyPrompt}
                              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-orange-600 hover:bg-orange-500 text-white transition shadow text-nowrap"
                          >
                              <FaClipboardQuestion size={12}/> Prompt Fix (AI)
                          </button>
                     )}
                    {/* Maybe add a button to view details later */}
                 </div>
            ) : null}
        </div>
    );
};
ValidationStatusIndicator.displayName = 'ValidationStatusIndicator';