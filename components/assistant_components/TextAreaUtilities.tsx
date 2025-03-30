import React from "react";
import { motion } from "framer-motion";
import { FaCopy, FaTrashAlt, FaRightLeft, FaArrowRight, FaRotate } from "react-icons/fa6";
import { Tooltip } from "../AICodeAssistant"; // Adjust import path if Tooltip is moved

interface TextAreaUtilitiesProps {
    response: string;
    isLoading: boolean;
    onParse: () => void;
    onSwap: () => void;
    onCopy: () => void;
    onClear: () => void;
}

export const TextAreaUtilities: React.FC<TextAreaUtilitiesProps> = ({
    response,
    isLoading,
    onParse,
    onSwap,
    onCopy,
    onClear
}) => {
    const hasResponse = !!response;

    return (
        <>
            {/* Utility Icons */}
            <div className="absolute top-2 right-10 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 z-10">
                <Tooltip text="Заменить текст" position="left">
                    <motion.button className="p-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md" onClick={onSwap} disabled={!hasResponse || isLoading} whileHover={{ scale: (!hasResponse || isLoading) ? 1 : 1.1 }} whileTap={{ scale: (!hasResponse || isLoading) ? 1 : 0.95 }}>
                        <FaRightLeft size={14}/>
                    </motion.button>
                </Tooltip>
                <Tooltip text="Скопировать все" position="left">
                    <motion.button className="p-1.5 rounded-full bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md" onClick={onCopy} disabled={!hasResponse || isLoading} whileHover={{ scale: (!hasResponse || isLoading) ? 1 : 1.1 }} whileTap={{ scale: (!hasResponse || isLoading) ? 1 : 0.95 }}>
                        <FaCopy size={14}/>
                    </motion.button>
                </Tooltip>
                <Tooltip text="Очистить поле" position="left">
                    <motion.button className="p-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md" onClick={onClear} disabled={!hasResponse || isLoading} whileHover={{ scale: (!hasResponse || isLoading) ? 1 : 1.1 }} whileTap={{ scale: (!hasResponse || isLoading) ? 1 : 0.95 }}>
                        <FaTrashAlt size={14}/> {/* Assuming FaTrashAlt from fa6 */}
                    </motion.button>
                </Tooltip>
            </div>

            {/* Parse Button */}
            <div className="absolute top-2 right-2 flex flex-col gap-1.5 z-10">
                <Tooltip text="Разобрать и Проверить Ответ AI" position="left">
                    <motion.button
                        className="p-1.5 rounded-full bg-gradient-to-r from-purple-600 to-cyan-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_8px_rgba(0,255,157,0.3)] hover:shadow-[0_0_12px_rgba(0,255,157,0.5)]"
                        onClick={onParse}
                        disabled={isLoading || !hasResponse}
                        whileHover={{ scale: (isLoading || !hasResponse) ? 1 : 1.1 }}
                        whileTap={{ scale: (isLoading || !hasResponse) ? 1 : 0.95 }}
                    >
                      {isLoading ? <FaRotate size={14} className="animate-spin"/> : <FaArrowRight size={14}/> }
                    </motion.button>
                </Tooltip>
                 {/* Validation indicator will be placed separately */}
            </div>
        </>
    );
};
TextAreaUtilities.displayName = 'TextAreaUtilities';