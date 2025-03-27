"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

interface StickyChatButtonProps {
  currentPath: string;
}

const StickyChatButton: React.FC<StickyChatButtonProps> = ({ currentPath }) => {
  const [isOpen, setIsOpen] = useState(false);

  const suggestions = [
    { text: "Fix current page", link: `/repo-xml?path=${currentPath}` },
    { text: "Add something new", link: "/repo-xml" },
  ];

  return (
    <div style={{ position: "fixed", bottom: "20px", right: "20px", zIndex: 1000 }}>
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-gradient-to-r from-purple-600 to-cyan-500 text-white px-4 py-2 rounded-full shadow-lg hover:shadow-[0_0_15px_rgba(0,255,255,0.8)] transition duration-300"
        >
          Fix Me
        </button>
      ) : (
        <motion.div
          initial={{ x: 300 }} // Slide in from right
          animate={{ x: 0 }}
          transition={{ type: "spring", stiffness: 100 }}
          className="bg-gray-800 p-4 rounded-lg shadow-lg w-72 border border-cyan-500"
        >
          <div className="flex items-center gap-2 mb-3">
            <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/character-images/public/xuinity.png" alt="Xuinity" width={160} height={90} /> {/* Add your character image */}
            <div className="bg-gray-700 p-2 rounded-lg">
              <p className="text-sm text-white">Yo, need a hand?</p> {/* Replaced "TADA" */}
            </div>
          </div>
          <ul className="space-y-2">
            {suggestions.map((suggestion, index) => (
              <li key={index}>
                <a href={suggestion.link} className="text-cyan-400 hover:underline text-sm">
                  {suggestion.text}
                </a>
              </li>
            ))}
          </ul>
          <button
            onClick={() => setIsOpen(false)}
            className="mt-3 bg-red-600 px-2 py-1 rounded text-white text-sm hover:bg-red-700 transition"
          >
            Close
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default StickyChatButton;