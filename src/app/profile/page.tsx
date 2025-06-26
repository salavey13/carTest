'use client';

import React from 'react';
import DynamicProfileHeader from '@/components/DynamicProfileHeader';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';

export default function ProfilePage() {
  return (
    // The main container. Clean. Simple. Effective.
    <div className="min-h-screen bg-gray-900 font-sans">
      {/* 
        The dynamic header is now a single, self-contained component. 
        The page just deploys it. It doesn't need to know how it works.
        This is proper abstraction. This is strength.
      */}
      <DynamicProfileHeader />

      {/* Spacer to push content below the oversized avatar */}
      <div className="mt-20" />

      {/* Profile Content Section. The data here is now correctly personalized. */}
      <div className="px-4 pb-16">
        <h1 className="text-center text-3xl font-bold text-white">Original Gangster 420</h1>
        <p className="text-center text-gray-400 mb-8">online</p>

        <div className="max-w-md mx-auto space-y-4">
          <div className="bg-gray-800/70 p-4 rounded-xl">
            <p className="text-sm text-gray-400">Username</p>
            <p className="text-white">@GG</p>
          </div>
          <div className="bg-gray-800/70 p-4 rounded-xl">
            <p className="text-sm text-gray-400">Notifications</p>
            <p className="text-white">On</p>
          </div>
          <div className="bg-gray-800/70 p-4 rounded-xl">
            <p className="text-sm text-gray-400">Recent Media</p>
            <p className="text-white mt-1">...</p>
          </div>
        </div>
      </div>
      
      {/* The tactical Cat Button remains on station. */}
      <div className="fixed bottom-5 right-5">
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