'use client';

import React from 'react';
import DynamicProfileHeader from '@/components/DynamicProfileHeader';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-gray-900 font-sans">
      <DynamicProfileHeader
        name="Original Gangster 420"
        status="online"
        avatarUrl="https://i.pravatar.cc/150?u=a042581f4e29026704d"
        backgroundUrl="/cosmic-desert.jpg" // Using the requested colorful background
      />

      {/* Profile Content Section */}
      <div className="p-4 space-y-4">
        <div className="bg-gray-800 p-4 rounded-xl">
          <p className="text-sm text-gray-400">Bio</p>
          <p className="text-white">25 y.o, CS streamer, San Francisco</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-xl">
          <p className="text-sm text-gray-400">Username</p>
          <p className="text-white">@GG</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-xl">
          <p className="text-sm text-gray-400">Notifications</p>
          <p className="text-white">On</p>
        </div>
      </div>
      
      {/* The tactical Cat Button remains on station. */}
      <div className="fixed bottom-5 right-5 z-50">
        <button
          className="bg-purple-600 hover:bg-purple-500 text-white w-16 h-16 rounded-full flex items-center justify-center shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-purple-400 transform hover:scale-110 transition-transform duration-300"
          aria-label="Special action"
        >
          <VibeContentRenderer content="faCat" className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
}