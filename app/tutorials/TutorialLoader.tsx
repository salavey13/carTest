// /app/tutorials/TutorialLoader.tsx
"use client";

import React from 'react';
import { FaSpinner } from 'react-icons/fa6';

const TutorialLoader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black/50">
      <FaSpinner className="animate-spin text-brand-purple text-6xl mb-4" />
      <p className="text-xl font-orbitron text-light-text">Загрузка туториала...</p>
    </div>
  );
};

export default TutorialLoader;