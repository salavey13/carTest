"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { FaRobot } from "react-icons/fa";

const StickyChatButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [fixClicked, setFixClicked] = useState(false);
  const currentPath = usePathname();

  const suggestions = [
    ...(fixClicked ? [] : [{ text: "Fix current page", link: `/repo-xml?path=${currentPath}` }]),
    { text: "Add something new", link: "/repo-xml" },
  ];

  const handleFixClick = (link: string) => {
    if (link.includes("path")) {
      setFixClicked(true);
      window.location.href = link; // Navigate to repo-xml with path
    }
  };

  return (
    <>
      {isOpen ? (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setIsOpen(false)}
        >
          <motion.div
            initial={{ x: 300 }}
            animate={{ x: 0 }}
            transition={{ type: "spring", stiffness: 100 }}
            className="bg-gray-800 bg-opacity-80 p-4 rounded-lg shadow-lg w-72 border border-cyan-500"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-white mb-2">Yo, need a hand?</p>
            <ul className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <li key={index}>
                  <a
                    href={suggestion.link}
                    onClick={() => handleFixClick(suggestion.link)}
                    className="text-cyan-400 hover:underline text-sm"
                  >
                    {suggestion.text}
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 bg-cyan-500 p-2 rounded-full shadow-lg"
        >
          <FaRobot className="text-white" />
        </button>
      )}
    </>
  );
};

export default StickyChatButton;