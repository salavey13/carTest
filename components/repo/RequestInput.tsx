// /components/repo/RequestInput.tsx
import React, { MutableRefObject, ChangeEventHandler } from 'react'; // Added ChangeEventHandler
import { motion } from 'framer-motion';
import { FaClipboard, FaBroom } from 'react-icons/fa6';

interface RequestInputProps {
    // Removed controlled props: kworkInput, setKworkInput
    kworkInputRef: MutableRefObject<HTMLTextAreaElement | null>;
    onCopyToClipboard: () => void;
    onClearAll: () => void;
    isCopyDisabled: boolean;
    isClearDisabled: boolean;
    onInputChange?: (value: string) => void; // Optional callback for parent
    initialValue?: string; // Optional initial value
}

const RequestInput: React.FC<RequestInputProps> = ({
    kworkInputRef,
    onCopyToClipboard,
    onClearAll,
    isCopyDisabled,
    isClearDisabled,
    onInputChange, // Destructure optional callback
    initialValue = "" // Default initial value
}) => {

    const handleChange: ChangeEventHandler<HTMLTextAreaElement> = (e) => {
        if (onInputChange) {
            onInputChange(e.target.value);
        }
    };

    return (
        <div className="relative">
            <p className="text-yellow-400 mb-2 text-xs md:text-sm"> 4/5. Опиши задачу и нажми <FaClipboard className="inline text-base mx-1" /> или <FaBroom className="inline text-base mx-1"/> или <span className="text-blue-400 font-semibold mx-1">🤖 Спросить AI</span>.</p>
            <textarea
                id="kwork-input"
                ref={kworkInputRef}
                defaultValue={initialValue} // Use defaultValue for uncontrolled with ref
                onChange={handleChange} // Notify parent on change
                className="w-full p-3 pr-14 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition shadow-[0_0_8px_rgba(0,255,157,0.3)] resize-y min-h-[120px] text-sm placeholder-gray-500"
                placeholder="Опиши здесь вашу задачу... Затем добавь контекст кнопками ИЛИ нажми 'Спросить AI'."
                disabled={isCopyDisabled && isClearDisabled} // Disable textarea if both actions are disabled (e.g., during loading)
            />
            <div className="absolute top-8 right-2 flex flex-col gap-2">
                <motion.button
                    onClick={onCopyToClipboard}
                    disabled={isCopyDisabled}
                    className={`p-1.5 bg-gradient-to-r from-cyan-600 to-teal-500 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.3)] transition-all ${isCopyDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-[0_0_12px_rgba(6,182,212,0.5)]'}`}
                    whileHover={{ scale: !isCopyDisabled ? 1.1 : 1 }}
                    whileTap={{ scale: !isCopyDisabled ? 0.9 : 1 }}
                    title="Скопировать запрос в буфер (для ручной вставки в AI)"
                >
                    <FaClipboard className="text-white text-base" />
                </motion.button>

                <motion.button
                    onClick={onClearAll}
                    disabled={isClearDisabled}
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