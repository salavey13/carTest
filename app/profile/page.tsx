"use client";

import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';
import VibeContentRenderer from '@/components/VibeContentRenderer';
import Image from 'next/image';

// --- CONSTANTS ---
// These define the start and end states of our animation.
const HEADER_MAX_HEIGHT = 280;
const HEADER_MIN_HEIGHT = 90;
const AVATAR_MAX_SIZE = 120;
const AVATAR_MIN_SIZE = 44;

// --- SUB-COMPONENTS ---

const ActionButton = ({ icon, label }: { icon: string; label: string }) => (
  <div className="flex flex-col items-center gap-1.5 w-16">
    <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
        <VibeContentRenderer content={icon} className="text-white/90 text-2xl" />
    </div>
    <span className="text-white text-xs font-medium">{label}</span>
  </div>
);

const InfoSection = ({ title, content }: { title: string, content: string }) => (
  <div className="bg-card border border-border p-4 rounded-lg">
    <p className="text-sm text-muted-foreground">{title}</p>
    <p className="text-base text-foreground font-medium">{content}</p>
  </div>
);

// --- MAIN COMPONENT ---

export default function ProfilePage() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // useScroll gives us scrollY which is the raw pixel value.
  const { scrollY } = useScroll({
    container: scrollContainerRef,
  });

  // This is the range of scroll over which the animation will occur.
  const scrollRange = [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT];

  // --- TRANSFORMERS ---
  // Each `useTransform` maps the scrollY value to a specific CSS property.

  // Header height shrinks from MAX to MIN.
  const headerHeight = useTransform(scrollY, scrollRange, [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT]);

  // Avatar size shrinks.
  const avatarSize = useTransform(scrollY, scrollRange, [AVATAR_MAX_SIZE, AVATAR_MIN_SIZE]);
  
  // Avatar moves from the center of the expanded header to the left of the collapsed header.
  const avatarTranslateY = useTransform(scrollY, scrollRange, [
    HEADER_MAX_HEIGHT / 2 - AVATAR_MAX_SIZE / 2, // Centered vertically initially
    (HEADER_MIN_HEIGHT - AVATAR_MIN_SIZE) / 2     // Centered in smaller header
  ]);
  const avatarTranslateX = useTransform(scrollY, scrollRange, [
    0, // Starts centered via CSS (left-1/2 -translate-x-1/2)
    -(window.innerWidth / 2) + (AVATAR_MIN_SIZE / 2) + 24 // Moves to left padding
  ]);

  // Name moves from below the avatar to its right.
  const nameTranslateY = useTransform(scrollY, scrollRange, [
    HEADER_MAX_HEIGHT / 2 + AVATAR_MAX_SIZE / 2 + 8, // Below avatar
    (HEADER_MIN_HEIGHT - 28) / 2                      // Vertically centered in collapsed
  ]);
  const nameTranslateX = useTransform(scrollY, scrollRange, [
    0, // Starts centered via CSS
    -(window.innerWidth / 2) + AVATAR_MIN_SIZE + 24 + 80 // To the right of avatar
  ]);
  const nameScale = useTransform(scrollY, scrollRange, [1.2, 1]);

  // Opacity for elements that fade in/out.
  const expandedHeaderOpacity = useTransform(scrollY, [0, scrollRange[1] * 0.75], [1, 0]);
  const collapsedHeaderOpacity = useTransform(scrollY, [scrollRange[1] * 0.5, scrollRange[1]], [0, 1]);

  return (
    <div
      ref={scrollContainerRef}
      className="h-screen w-full overflow-y-auto overflow-x-hidden bg-background text-foreground simple-scrollbar"
    >
      {/* Animated Header: Positioned sticky to stay at the top. */}
      <motion.header
        style={{ height: headerHeight }}
        className="sticky top-0 left-0 right-0 z-10"
      >
        <div className="absolute inset-0 bg-[#4a2c82]" />

        {/* --- Floating Animated Elements --- */}
        {/* These are absolute within the header and transform based on scroll */}
        
        {/* Avatar */}
        <motion.div
          className="absolute top-0 left-1/2"
          style={{
            translateY: avatarTranslateY,
            translateX: avatarTranslateX,
            width: avatarSize,
            height: avatarSize,
          }}
        >
          <Image
            src="https://i.pravatar.cc/300?u=ronaldcopper"
            alt="Ronald Copper"
            width={AVATAR_MAX_SIZE}
            height={AVATAR_MAX_SIZE}
            className="rounded-full border-2 border-white object-cover w-full h-full"
            priority
          />
        </motion.div>

        {/* Name and Status */}
        <motion.div
          className="absolute top-0 left-1/2 flex flex-col items-center"
          style={{
            translateY: nameTranslateY,
            translateX: nameTranslateX,
            scale: nameScale,
          }}
        >
          <h1 className="text-2xl font-bold text-white whitespace-nowrap">Ronald Copper</h1>
          <motion.p style={{ opacity: expandedHeaderOpacity }} className="text-sm text-white/80">
            online
          </motion.p>
        </motion.div>
        
        {/* Expanded Header Action Buttons */}
        <motion.div
          style={{ opacity: expandedHeaderOpacity }}
          className="absolute bottom-5 left-0 right-0 flex justify-evenly items-center"
        >
          <ActionButton icon="::FaCommentDots::" label="Message" />
          <ActionButton icon="::FaVolumeXmark::" label="Unmute" />
          <ActionButton icon="::FaPhone::" label="Call" />
          <ActionButton icon="::FaVideo::" label="Video" />
        </motion.div>

        {/* Collapsed Header Top Bar */}
        <motion.div
          style={{ opacity: collapsedHeaderOpacity }}
          className="absolute top-0 left-0 right-0 flex items-center justify-between px-4"
          // This div's height should be the minimum header height.
          // Using translate to ensure it's vertically centered.
          // The top value will be derived from SafeArea, if any. For web, we can use a fixed value.
          // Here, top-1/2 and y of -50% ensures it's in the middle of HEADER_MIN_HEIGHT
          // This is a simple way without safe-area. A real app might need padding.
          css={{top: 'calc(var(--safe-area-inset-top, 0px) + 45px)', transform: 'translateY(-50%)'}}
        >
          <button className="p-2 text-white/90 rounded-full hover:bg-white/10 transition-colors">
            <VibeContentRenderer content="::FaArrowLeft::" className="text-2xl" />
          </button>
          <button className="p-2 text-white/90 rounded-full hover:bg-white/10 transition-colors">
            <VibeContentRenderer content="::FaEllipsisVertical::" className="text-2xl" />
          </button>
        </motion.div>
      </motion.header>

      {/* Static page content that pushes the scroll */}
      <main className="relative z-0 p-4 space-y-3">
        <InfoSection title="Bio" content="25 y.o, CS streamer, San Francisco" />
        <InfoSection title="Username" content="@ronald_copper" />
        <InfoSection title="Notifications" content="On" />
        {/* Dummy content to make the page scrollable */}
        <div className="h-40 bg-card border border-border rounded-lg p-4">
          <p className="text-muted-foreground">Recent Media</p>
        </div>
        <div className="h-60 bg-card border border-border rounded-lg p-4">
          <p className="text-muted-foreground">Shared Groups</p>
        </div>
        <div className="h-80 bg-card border border-border rounded-lg p-4">
          <p className="text-muted-foreground">Links</p>
        </div>
      </main>
    </div>
  );
}