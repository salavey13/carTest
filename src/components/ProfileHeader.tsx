"use client";

import React from 'react';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';

interface ProfileHeaderProps {
  onAvatarClick: () => void;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({ onAvatarClick }) => {
  // NOTE: This container is now clean. No `overflow` property.
  // The double scrollbar bug was executed here.
  //
  // STRATEGIC VISUAL UPDATE:
  // The outer div now controls the background image.
  // The inner div creates a dark, blurred overlay to ensure text is always readable.
  // This is how you layer visuals without compromising function.
  return (
    <div
      className="w-full max-w-5xl mx-auto rounded-2xl border border-gray-700 shadow-lg bg-cover bg-center overflow-hidden"
      style={{ backgroundImage: "url('/cosmic-desert.jpg')" }} // ASSUMING IMAGE IS IN /public/cosmic-desert.jpg
    >
      <div className="bg-black/60 backdrop-blur-sm p-6">
        <div className="flex items-center">
          <button
            onClick={onAvatarClick}
            className="focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-purple-500 rounded-full"
            aria-label="Close profile"
          >
            <img
              src="https://i.pravatar.cc/150?u=a042581f4e29026704d"
              alt="User Avatar"
              className="w-24 h-24 rounded-full border-4 border-gray-600 hover:border-purple-500 transition-colors duration-300"
            />
          </button>
          <div className="ml-6">
            <h2 className="text-3xl font-bold text-white">Original Gangster 420</h2>
            <p className="text-purple-400">ghost.in.the.machine@cybervibe.dev</p>
          </div>
        </div>
        <div className="mt-6 border-t border-gray-700 pt-6">
          <p className="text-gray-300">
            This is where additional profile information, stats, or other relevant data would be rendered. The container will now grow vertically as needed, letting the main page handle all scrolling.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;