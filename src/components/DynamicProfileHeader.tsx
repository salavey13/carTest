'use client';

import React, { useState, useEffect } from 'react';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';

// Configuration constants for the animation engine
const AVATAR_MAX_SCROLL = 200;
const AVATAR_INITIAL_SIZE = 96;
const AVATAR_FINAL_SCALE = 0.5;
const AVATAR_MAX_BLUR = 8;

interface ActionButtonProps {
  icon: string;
  label: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon, label }) => (
  <div className="flex flex-col items-center gap-1">
    <button className="w-12 h-12 bg-gray-500/50 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-gray-500/70 transition-colors">
      <VibeContentRenderer content={icon} className="h-6 w-6 text-white" />
    </button>
    <span className="text-xs text-white font-medium">{label}</span>
  </div>
);

interface DynamicProfileHeaderProps {
  name: string;
  status: string;
  avatarUrl: string;
  backgroundUrl: string;
}

// This component is self-contained and manages its own complex animation logic.
const DynamicProfileHeader: React.FC<DynamicProfileHeaderProps> = ({ name, status, avatarUrl, backgroundUrl }) => {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollProgress = Math.min(scrollY / AVATAR_MAX_SCROLL, 1);
  const avatarScale = 1 - scrollProgress * (1 - AVATAR_FINAL_SCALE);
  const avatarBlur = scrollProgress * AVATAR_MAX_BLUR;

  return (
    <div
      className="relative bg-cover bg-center h-72 w-full text-white"
      style={{ backgroundImage: `url(${backgroundUrl})` }}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative h-full flex flex-col justify-end p-4">
        {/* Animated Avatar */}
        <div
          className="absolute left-1/2 -translate-x-1/2 top-14"
          style={{
            width: `${AVATAR_INITIAL_SIZE}px`,
            height: `${AVATAR_INITIAL_SIZE}px`,
            transform: `scale(${avatarScale})`,
            filter: `blur(${avatarBlur}px)`,
            // --- JITTER OBLITERATION ---
            // This property commands the browser to use hardware acceleration for these changes.
            willChange: 'transform, filter',
            transition: 'transform 10ms linear, filter 10ms linear',
          }}
        >
          <img
            src={avatarUrl}
            alt="User Avatar"
            className="w-full h-full rounded-full object-cover border-4 border-gray-800/50"
          />
        </div>
        
        <div className="flex flex-col items-center text-center mt-auto" style={{ paddingTop: `${AVATAR_INITIAL_SIZE / 2}px` }}>
          <h1 className="text-3xl font-bold">{name}</h1>
          <p className="text-sm text-gray-300">{status}</p>
        </div>
        
        <div className="flex justify-center gap-6 mt-4">
          <ActionButton icon="faMessage" label="Message" />
          <ActionButton icon="faVolumeXmark" label="Unmute" />
          <ActionButton icon="faPhone" label="Call" />
          <ActionButton icon="faVideo" label="Video" />
        </div>
      </div>
    </div>
  );
};

export default DynamicProfileHeader;