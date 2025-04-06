import React, { MutableRefObject } from 'react';
import { motion } from 'framer-motion';
import { FaClipboard } from 'react-icons/fa6';

interface RequestInputProps {
    kworkInput: string;
    setKworkInput: (value: string) => void;
    kworkInputRef: MutableRefObject<HTMLTextAreaElement | null>;
    onCopyToClipboard: () => void;
}

const RequestInput: React.FC<RequestInputProps> = ({
    kworkInput,
    setKworkInput,
    kworkInputRef,
    onCopyToClipboard,
}) => {
    return (
        <div className="relative">
            {/* Consistent Label Style */}
            <p className="text-yellow-400 mb-2 text-xs md:text-sm"> 5️⃣ Опишите здесь вашу задачу ИЛИ вставьте полный ответ от AI. Затем нажмите <FaClipboard className="inline text-base mx-1" /> для копирования запроса ИЛИ '➡️' (на панели ниже) для обработки ответа.</p>
            <textarea
                id="kwork-input"
                ref={kworkInputRef}
                value={kworkInput}
                onChange={(e) => setKworkInput(e.target.value)}
                className="w-full p-3 pr-10 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition shadow-[0_0_8px_rgba(0,255,157,0.3)] resize-y min-h-[120px] text-sm placeholder-gray-500"
                placeholder="Опишите здесь вашу задачу... Затем добавьте контекст с помощью кнопок выше. Или вставьте сюда ПОЛНЫЙ ОТВЕТ от вашего AI для обработки."
            />
            <motion.button
                onClick={onCopyToClipboard}
                disabled={!kworkInput.trim()}
                className={`absolute top-8 right-2 p-1.5 bg-gradient-to-r from-cyan-600 to-teal-500 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.3)] transition-all ${!kworkInput.trim() ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-[0_0_12px_rgba(6,182,212,0.5)]'}`}
                whileHover={{ scale: kworkInput.trim() ? 1.1 : 1 }}
                whileTap={{ scale: kworkInput.trim() ? 0.9 : 1 }}
                title="Скопировать запрос/ответ в буфер"
            >
                <FaClipboard className="text-white text-base" />
            </motion.button>
        </div>
    );
};

export default RequestInput;