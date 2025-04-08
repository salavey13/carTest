// /components/repo/RequestInput.tsx
import React, { MutableRefObject } from 'react';
import { motion } from 'framer-motion';
import { FaClipboard, FaBroom } from 'react-icons/fa6'; // Import FaBroom

interface RequestInputProps {
    kworkInput: string;
    setKworkInput: (value: string) => void;
    kworkInputRef: MutableRefObject<HTMLTextAreaElement | null>;
    onCopyToClipboard: () => void;
    onClearAll: () => void; // Add prop for clearing
    isCopyDisabled: boolean; // Add prop for disabling copy
    isClearDisabled: boolean; // Add prop for disabling clear
}

const RequestInput: React.FC<RequestInputProps> = ({
    kworkInput,
    setKworkInput,
    kworkInputRef,
    onCopyToClipboard,
    onClearAll, // Destructure new prop
    isCopyDisabled, // Destructure new prop
    isClearDisabled, // Destructure new prop
}) => {
    return (
        <div className="relative">
            {/* Consistent Label Style */}
            <p className="text-yellow-400 mb-2 text-xs md:text-sm"> 5️⃣ Затем нажмите <FaClipboard className="inline text-base mx-1" /> для копирования запроса или <FaBroom className="inline text-base mx-1"/> для очистки.</p>
            <textarea
                id="kwork-input"
                ref={kworkInputRef}
                value={kworkInput}
                onChange={(e) => setKworkInput(e.target.value)}
                className="w-full p-3 pr-14 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition shadow-[0_0_8px_rgba(0,255,157,0.3)] resize-y min-h-[120px] text-sm placeholder-gray-500" // Increased pr for two buttons
                placeholder="Опишите здесь вашу задачу... Затем добавьте контекст с помощью кнопок выше. "
            />
            {/* Container for buttons */}
            <div className="absolute top-8 right-2 flex flex-col gap-2">
                {/* Copy Button */}
                <motion.button
                    onClick={onCopyToClipboard}
                    disabled={isCopyDisabled} // Use prop
                    // *** Already rounded-full ***
                    className={`p-1.5 bg-gradient-to-r from-cyan-600 to-teal-500 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.3)] transition-all ${isCopyDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-[0_0_12px_rgba(6,182,212,0.5)]'}`}
                    whileHover={{ scale: !isCopyDisabled ? 1.1 : 1 }}
                    whileTap={{ scale: !isCopyDisabled ? 0.9 : 1 }}
                    title="Скопировать запрос/ответ в буфер"
                >
                    <FaClipboard className="text-white text-base" />
                </motion.button>

                {/* Clear All Button */}
                <motion.button
                    onClick={onClearAll} // Use prop
                    disabled={isClearDisabled} // Use prop
                    // *** Add rounded-full ***
                    className={`p-1.5 bg-gradient-to-r from-red-600 to-orange-500 rounded-full shadow-[0_0_8px_rgba(220,38,38,0.3)] transition-all ${isClearDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-[0_0_12px_rgba(220,38,38,0.5)]'}`}
                    whileHover={{ scale: !isClearDisabled ? 1.1 : 1 }}
                    whileTap={{ scale: !isClearDisabled ? 0.9 : 1 }}
                    title="Очистить поле ввода и выбор файлов"
                >
                    <FaBroom className="text-white text-base" />
                </motion.button>
            </div>
        </div>
    );
};

export default RequestInput;