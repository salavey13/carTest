'use client';

import React, { useState, useEffect } from 'react';

// --- CONFIGURATION FOR THE SCROLL ANIMATION ENGINE ---
const AVATAR_MAX_SCROLL = 200; // Pixels to scroll before animation is complete
const AVATAR_INITIAL_SIZE = 128; // in pixels (w-32 h-32)
const AVATAR_FINAL_SCALE = 0.5; // The final size will be INITIAL_SIZE * FINAL_SCALE
const AVATAR_MAX_BLUR = 8; // in pixels (blur-lg)

const DynamicProfileHeader: React.FC = () => {
  const [scrollY, setScrollY] = useState(0);

  // --- ENGINE CORE: Scroll Event Listener ---
  // Encapsulated within the component. It lives and dies with this header.
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // --- ANIMATION MAPPING ---
  const scrollProgress = Math.min(scrollY / AVATAR_MAX_SCROLL, 1);
  const avatarScale = 1 - scrollProgress * (1 - AVATAR_FINAL_SCALE);
  const avatarBlur = scrollProgress * AVATAR_MAX_BLUR;

  return (
    <div
      className="relative bg-cover bg-center h-56 w-full"
      style={{ backgroundImage: "url('/cosmic-desert.jpg')" }}
    >
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2"
        style={{
          width: `${AVATAR_INITIAL_SIZE}px`,
          height: `${AVATAR_INITIAL_SIZE}px`,
          transform: `scale(${avatarScale})`,
          filter: `blur(${avatarBlur}px)`,
          transition: 'transform 10ms ease-out, filter 10ms ease-out',
        }}
      >
        <img
          src="https://i.pravatar.cc/150?u=a042581f4e29026704d"
          alt="User Avatar"
          className="w-full h-full rounded-full object-cover border-4 border-gray-800"
        />
      </div>
    </div>
  );
};

export default DynamicProfileHeader;