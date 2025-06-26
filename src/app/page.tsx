'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import ProfileHeader from '@/components/ProfileHeader';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';

export default function Home() {
  const [isProfileVisible, setProfileVisible] = useState(false);

  const toggleProfileVisibility = () => {
    setProfileVisible((prev) => !prev);
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white font-sans p-4">
      {/* 
        COMMAND CENTER: Conditional rendering based on a single state. 
        Clean, decisive, no bullshit.
      */}
      <div className="mb-8">
        {isProfileVisible ? (
          <ProfileHeader onAvatarClick={toggleProfileVisibility} />
        ) : (
          <Header onAvatarClick={toggleProfileVisibility} />
        )}
      </div>

      {/* Main content area can go here */}
      <div className="w-full max-w-5xl mx-auto text-gray-400">
        <p>Main application content placeholder.</p>
        <p>
          The UI above is now modular. State is managed here, in the parent.
          The double scrollbar has been neutralized.
        </p>
      </div>

      {/* 
        TACTICAL BUTTON: Fixed position for the Cat Button.
        Always accessible, never in the way. Purged the rest.
      */}
      <div className="fixed bottom-5 right-5">
        <button
          className="bg-purple-600 hover:bg-purple-500 text-white w-16 h-16 rounded-full flex items-center justify-center shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-purple-400 transform hover:scale-110 transition-transform duration-300"
          aria-label="Special action"
        >
          <VibeContentRenderer content="faCat" className="h-7 w-7" />
        </button>
      </div>
    </main>
  );
}