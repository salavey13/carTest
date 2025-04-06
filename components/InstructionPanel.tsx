"use client";
import React, { useState, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaLanguage, FaCircleInfo } from "react-icons/fa6"; // Import necessary icons

interface InstructionPanelProps {
  id: string;
  titleRu: string;
  titleEn: string;
  contentRu: ReactNode; // Allow JSX content
  contentEn: ReactNode; // Allow JSX content
  icon?: ReactNode;
  defaultCollapsed?: boolean;
  className?: string;
}

const InstructionPanel: React.FC<InstructionPanelProps> = ({
  id,
  titleRu,
  titleEn,
  contentRu,
  contentEn,
  icon = <FaCircleInfo />,
  defaultCollapsed = true,
  className = "",
}) => {
  const [showModal, setShowModal] = useState(false);
  const [currentLang, setCurrentLang] = useState<"ru" | "en">("ru");

  const toggleModal = () => setShowModal(!showModal);
  const toggleLang = () => setCurrentLang(currentLang === "ru" ? "en" : "ru");

  const title = currentLang === "ru" ? titleRu : titleEn;
  const content = currentLang === "ru" ? contentRu : contentEn;

  // Modal animation variants
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const modalVariants = {
    hidden: { y: "-50%", x: "-50%", opacity: 0, scale: 0.9 },
    visible: { y: "-50%", x: "-50%", opacity: 1, scale: 1, transition: { duration: 0.3 } },
    exit: { y: "-50%", x: "-50%", opacity: 0, scale: 0.9, transition: { duration: 0.2 } },
  };

  return (
    <>
      {/* Collapsed View Trigger */}
      <section id={id} className={`mb-12 w-full max-w-2xl ${className}`}>
        <div
          className="bg-gray-800 p-4 rounded-lg border border-gray-700 cursor-pointer hover:bg-gray-700 transition duration-200 flex justify-between items-center"
          onClick={toggleModal}
        >
          <div className="flex items-center space-x-3">
             <span className="text-cyan-400 text-xl">{icon}</span>
             <h2 className="text-xl font-semibold text-cyan-400">{titleRu}</h2>
             {/* Optional: Show EN title dimmed? */}
             {/* <span className="text-sm text-gray-500">/ {titleEn}</span> */}
          </div>
          <span className="text-sm text-blue-400 hover:underline">
             {currentLang === 'ru' ? 'Читать полностью...' : 'Read More...'}
          </span>
        </div>
      </section>

      {/* Modal View */}
      <AnimatePresence>
        {showModal && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-70 z-40"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              onClick={toggleModal} // Close on backdrop click
            />

            {/* Modal Content */}
            <motion.div
              className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-850 p-6 rounded-lg shadow-xl z-50 w-11/12 max-w-3xl max-h-[80vh] overflow-y-auto border border-cyan-500"
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{ transform: 'translate(-50%, -50%)' }} // Ensure transform is applied correctly with Framer Motion
            >
              <div className="flex justify-between items-center mb-4">
                 {/* Title and Language Toggle */}
                 <h2 className="text-2xl font-bold text-cyan-400">{title}</h2>
                 <div className="flex items-center space-x-4">
                    <button
                      onClick={toggleLang}
                      className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition text-white"
                      title={currentLang === 'ru' ? 'Switch to English' : 'Переключить на Русский'}
                    >
                       <FaLanguage className="text-lg" />
                    </button>
                    <button
                      onClick={toggleModal}
                      className="p-2 bg-red-600 rounded-full hover:bg-red-500 transition text-white"
                      title={currentLang === 'ru' ? 'Закрыть' : 'Close'}
                    >
                      <FaTimes className="text-lg" />
                    </button>
                 </div>
              </div>
              {/* Content */}
              <div className="text-gray-300 text-base prose prose-invert max-w-none"> {/* Added prose for better text formatting */}
                 {content}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default InstructionPanel;