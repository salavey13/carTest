"use client";

import React from 'react';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';

interface HeaderProps {
  onAvatarClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onAvatarClick }) => {
  return (
    <header className="w-full max-w-5xl mx-auto flex justify-between items-center p-4">
      <h1 className="text-2xl font-bold text-white tracking-wider">
        Vibe Studio
      </h1>
      <button
        onClick={onAvatarClick}
        className="focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-purple-500 rounded-full"
        aria-label="Open profile"
      >
        <img
          src="https://i.pravatar.cc/150?u=a042581f4e29026704d"
          alt="User Avatar"
          className="w-12 h-12 rounded-full border-2 border-gray-700 hover:border-purple-500 transition-colors duration-300"
        />
      </button>
    </header>
  );
};

export default Header;