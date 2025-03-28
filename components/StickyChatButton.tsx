"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { FaRobot } from "react-icons/fa";
import Image from "next/image";

const StickyChatButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [fixClicked, setFixClicked] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const currentPath = usePathname();

  const suggestions = [
    ...(fixClicked ? [] : [{ text: "Исправить текущую страницу", link: `/repo-xml?path=${currentPath}` }]),
    { text: "Добавить что-то новое", link: "/repo-xml" },
    { text: "Нанять меня за звезды", link: "/selfdef" },
  ];

  useEffect(() => {
    if (!hasAutoOpened) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        setHasAutoOpened(true);
      }, 13000);
      return () => clearTimeout(timer);
    }
  }, [hasAutoOpened]);

  const getRandomSuggestion = () => {
    const randomIndex = Math.floor(Math.random() * suggestions.length);
    return suggestions[randomIndex];
  };

  const handleFixClick = (link: string) => {
    if (link.includes("path")) {
      setFixClicked(true);
      window.location.href = link;
    } else {
      window.location.href = link;
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, x: 300 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        type: "spring",
        stiffness: 120,
        damping: 15,
        when: "beforeChildren",
        staggerChildren: 0.1,
      },
    },
    exit: { opacity: 0, x: 300, transition: { duration: 0.3 } },
  };

  const childVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.4 } },
  };

  return (
    <>
      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-end"
          onClick={() => setIsOpen(false)}
        >
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="p-4 w-72 flex flex-col items-end bg-transparent"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Xuinity PNG Icon */}
            <motion.div variants={childVariants} className="mb-4 flex justify-end">
              <Image
                src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/character-images/public/x2.png" // Replace with your PNG path (e.g., in /public/)
                alt="Xuinity"
                width={169}
                height={169}
                className="drop-shadow-[0_0_10px_rgba(0,255,157,0.5)]"
              />
            </motion.div>

            {/* Random Suggestion Text */}
            <motion.p
              variants={childVariants}
              className="text-sm text-white mb-4 drop-shadow-[0_0_5px_rgba(0,255,157,0.3)] text-right"
            >
              {getRandomSuggestion().text}
            </motion.p>

            {/* Buttons */}
            <motion.div variants={childVariants} className="space-y-2 w-full">
              {suggestions.map((suggestion, index) => (
                <a
                  key={index}
                  href={suggestion.link}
                  onClick={() => handleFixClick(suggestion.link)}
                  className="block w-full text-right px-4 py-2 bg-gray-700 bg-opacity-80 rounded-lg text-cyan-400 hover:text-cyan-300 transition-all shadow-[0_0_8px_rgba(0,255,157,0.3)] hover:shadow-[0_0_12px_rgba(0,255,157,0.5)] text-sm"
                >
                  {suggestion.text}
                </a>
              ))}
            </motion.div>
          </motion.div>
        </div>
      ) : (
        <motion.button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-8 right-16 bg-transparent p-2 rounded-full shadow-[0_0_10px_rgba(0,255,157,0.5)] hover:shadow-[0_0_15px_rgba(0,255,157,0.7)] transition-all"
          initial={{ scale: 0 }}
          animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
          transition={{ duration: 0.5, rotate: { repeat: Infinity, duration: 2 } }}
        >
          <FaRobot className="text-cyan-500 text-2xl" />
        </motion.button>
      )}
    </>
  );
};

export default StickyChatButton;