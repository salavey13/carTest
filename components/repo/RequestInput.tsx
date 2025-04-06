"use client";

import React, { useState, MutableRefObject, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FaClipboard, FaTrashAlt, FaUndoAlt } from 'react-icons/fa'
// TODO: Verify import for FaPoo, consider 'react-icons/fa6'; // Using FaTrashAlt and FaUndoAlt

interface RequestInputProps {
    kworkInput: string;
    setKworkInput: (value: string) => void;
    kworkInputRef: MutableRefObject<HTMLTextAreaElement | null>;
    onCopyToClipboard: () => void;
    onClearAll: () => void; // Callback to trigger clearing in parent
    isClearDisabled: boolean; // Receive disabled state from parent
}

const RequestInput: React.FC<RequestInputProps> = ({
    kworkInput,
    setKworkInput,
    kworkInputRef,
    onCopyToClipboard,
    onClearAll,
    isClearDisabled
}) => {
    const [confirmClear, setConfirmClear] = useState(false);
    const clearButtonRef = useRef<HTMLButtonElement>(null); // Ref for the clear button

    const handleClearClick = useCallback(() => {
        if (isClearDisabled) return; // Prevent action if disabled

        if (confirmClear) {
            onClearAll();
            setConfirmClear(false); // Reset confirmation state
        } else {
            setConfirmClear(true); // Enter confirmation state
            // Optional: Focus the button to allow easy second click or blur
            clearButtonRef.current?.focus();
        }
    }, [confirmClear, onClearAll, isClearDisabled]);

    const handleClearBlur = useCallback(() => {
        // Reset confirmation if the button loses focus
        // Add a small delay to allow the second click to register before blur resets it
        setTimeout(() => {
            setConfirmClear(false);
        }, 150); // 150ms delay
    }, []);

    return (
        <div id="kwork-input-section" className="relative"> {/* Added ID for scrolling */}
            {/* Consistent Label Style */}
            <p className="text-yellow-400 mb-2 text-xs md:text-sm">
                 5️⃣ Затем нажмите <FaClipboard className="inline text-base mx-1" /> для копирования запроса.
                 {/* Optional: Hint about clear button */}
                 {/* <FaPoo className="inline text-base mx-1 text-red-500/70" /> для очистки. */}
            </p>
            <textarea
                id="kwork-input" // Keep ID for label/scrolling
                ref={kworkInputRef}
                value={kworkInput}
                onChange={(e) => setKworkInput(e.target.value)}
                className="w-full p-3 pr-20 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition shadow-[0_0_8px_rgba(0,255,157,0.3)] resize-y min-h-[120px] text-sm placeholder-gray-500" // Increased pr for two buttons
                placeholder="Опишите здесь вашу задачу... Затем добавьте контекст с помощью кнопок выше. "
            />
            {/* Buttons Container */}
            <div className="absolute top-8 right-2 flex items-center space-x-1.5">
                {/* Clear Button */}
                <motion.button
                    ref={clearButtonRef}
                    onClick={handleClearClick}
                    onBlur={handleClearBlur} // Reset on blur
                    disabled={isClearDisabled && !confirmClear} // Disable if nothing to clear, unless confirming
                    className={`p-1.5 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.3)] transition-all text-white text-xs font-bold
                        ${isClearDisabled && !confirmClear ? 'opacity-40 cursor-not-allowed bg-gray-600' : 'bg-gradient-to-r from-red-600 to-orange-500 hover:shadow-[0_0_12px_rgba(239,68,68,0.5)]'}
                        ${confirmClear ? 'px-2.5 w-[60px]' : 'w-[28px]'} // Dynamic width for text/icon
                    `}
                    whileHover={{ scale: !(isClearDisabled && !confirmClear) ? 1.1 : 1 }}
                    whileTap={{ scale: !(isClearDisabled && !confirmClear) ? 0.9 : 1 }}
                    title={confirmClear ? "Нажмите еще раз для подтверждения" : "Очистить выбор и поле ввода"}
                    // Animate width change smoothly
                    layout // Enable layout animation
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                >
                    {confirmClear ? (
                        <span className='flex items-center justify-center text-[10px]'>точн?)</span>
                    ) : (
                        <FaPoo className="text-white text-base" />
                    )}
                </motion.button>

                {/* Copy Button */}
                <motion.button
                    onClick={onCopyToClipboard}
                    disabled={!kworkInput.trim()}
                    className={`p-1.5 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.3)] transition-all text-white
                        ${!kworkInput.trim() ? 'opacity-40 cursor-not-allowed bg-gray-600' : 'bg-gradient-to-r from-cyan-600 to-teal-500 hover:shadow-[0_0_12px_rgba(6,182,212,0.5)]'}
                    `}
                    whileHover={{ scale: kworkInput.trim() ? 1.1 : 1 }}
                    whileTap={{ scale: kworkInput.trim() ? 0.9 : 1 }}
                    title="Скопировать запрос в буфер"
                >
                    <FaClipboard className="text-white text-base" />
                </motion.button>
            </div>
        </div>
    );
};

export default RequestInput;