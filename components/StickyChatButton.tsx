"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FaRobot, FaStar } from "react-icons/fa";
import Image from "next/image";

const StickyChatButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [fixClicked, setFixClicked] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const currentPath = usePathname();
  const router = useRouter();

  // Determine the folder path (not the full file path)
  const folderPath = currentPath === "/" ? "app" : `app${currentPath}`;

  const suggestions = [
    ...(fixClicked ? [] : [{ text: "Исправить текущую страницу", link: `/repo-xml?path=${folderPath}` }]),
    { text: "Добавить что-то новое", link: "/repo-xml" },
    { text: "Нанять меня за звезды", link: "/selfdev" },
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

  const handleClick = (link: string) => {
    if (link.includes("path")) setFixClicked(true);
    router.push(link);
  };

  const containerVariants = {
    hidden: { opacity: 0, x: -300 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        type: "spring",
        stiffness: 120,
        damping: 15,
        when: "beforeChildren",
        staggerChildren: 0.3,
      },
    },
    exit: { opacity: 0, x: -300, transition: { duration: 0.3 } },
  };

  const childVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.4 } },
  };

  return (
    <>
      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-start"
          onClick={() => setIsOpen(false)}
        >
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="p-4 w-72 flex flex-col items-start bg-transparent"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Comic-Style Balloon for Suggestion */}
            <motion.div
              variants={childVariants}
              className="relative mb-4 bg-white bg-opacity-90 p-3 rounded-lg shadow-[0_0_10px_rgba(0,255,157,0.5)]"
            >
              <p className="text-sm text-gray-800 font-comic font-bold">
                {getRandomSuggestion().text}
              </p>
              <div className="absolute -bottom-2 left-4 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white" />
            </motion.div>
{/* Xuinity PNG Icon */}
            <motion.div variants={childVariants} className="mb-4 pl-0">
              <Image
                src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/character-images/public/x13.png"
                alt="Xuinity"
                width={169}
                height={169}
                className="drop-shadow-[0_0_10px_rgba(0,255,157,0.5)]"
              />
            </motion.div>

            {/* Buttons */}
            <motion.div variants={childVariants} className="space-y-2 w-full">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleClick(suggestion.link)}
                  className={`block w-full text-left px-4 py-2 rounded-full text-sm font-semibold transition-all shadow-[0_0_8px_rgba(0,255,157,0.3)] hover:shadow-[0_0_12px_rgba(0,255,157,0.5)] ${
                    suggestion.text === "Нанять меня за звезды"
                      ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-white"
                      : "bg-gray-700 bg-opacity-80 text-cyan-400 hover:text-cyan-300"
                  }`}
                >
                  {suggestion.text === "Нанять меня за звезды" && <FaStar className="inline mr-1" />}
                  {suggestion.text}
                </button>
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