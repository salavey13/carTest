"use client";

import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import VibeContentRenderer from '@/components/VibeContentRenderer';
import Image from 'next/image';

// --- CONSTANTS ---
const HEADER_MAX_HEIGHT = 280;
const HEADER_MIN_HEIGHT = 90;
const AVATAR_MAX_SIZE = 120;
const AVATAR_MIN_SIZE = 44;
// This is the key to the illusion. The same image is used for the header background and the avatar.
const USER_IMAGE_URL = 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=1961&auto=format&fit=crop';


// --- SUB-COMPONENTS ---

const ActionButton = ({ icon, label }: { icon: string; label: string }) => (
  <div className="flex flex-col items-center gap-1.5 w-16">
    <div className="w-12 h-12 bg-black/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/10">
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

  const { scrollY } = useScroll({
    container: scrollContainerRef,
  });

  const scrollRange = [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT];

  // --- TRANSFORMERS ---

  // Header height animation is necessary for layout push, but other animations are optimized.
  const headerHeight = useTransform(scrollY, scrollRange, [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT]);

  // --- AVATAR TRANSFORMS ---
  // THE FIX: Animate `scale` instead of `width`/`height` for performance.
  const avatarScale = useTransform(scrollY, scrollRange, [1, AVATAR_MIN_SIZE / AVATAR_MAX_SIZE]);
  const avatarTranslateY = useTransform(scrollY, scrollRange, [
    HEADER_MAX_HEIGHT / 2 - AVATAR_MAX_SIZE / 2, // Centered vertically in expanded header
    (HEADER_MIN_HEIGHT - AVATAR_MIN_SIZE) / 2     // Centered vertically in collapsed header
  ]);

  // --- NAME & STATUS TRANSFORMS ---
  const nameTranslateY = useTransform(scrollY, scrollRange, [
    HEADER_MAX_HEIGHT / 2 + AVATAR_MAX_SIZE / 2 + 8, // Below expanded avatar
    (HEADER_MIN_HEIGHT + AVATAR_MIN_SIZE) / 2 + 5      // Below collapsed avatar
  ]);
  const nameScale = useTransform(scrollY, scrollRange, [1.2, 1], { clamp: true });

  // --- OPACITY TRANSFORMS ---
  const expandedHeaderOpacity = useTransform(scrollY, [0, scrollRange[1] * 0.75], [1, 0]);
  const collapsedHeaderOpacity = useTransform(scrollY, [scrollRange[1] * 0.5, scrollRange[1]], [0, 1]);
  const nameInCollapsedHeaderOpacity = useTransform(scrollY, [scrollRange[1] * 0.8, scrollRange[1]], [0, 1]);

  // THE FIX: Hinting the browser to use hardware acceleration for these transforms.
  const motionStyle = { willChange: 'transform, opacity' } as const;

  return (
    <div
      ref={scrollContainerRef}
      className="h-screen w-full overflow-y-auto overflow-x-hidden bg-background text-foreground simple-scrollbar"
    >
      <motion.header
        style={{ height: headerHeight, ...motionStyle }}
        className="sticky top-0 left-0 right-0 z-10"
      >
        <div className="absolute inset-0 overflow-hidden">
            <Image
                src={USER_IMAGE_URL}
                alt="Header background"
                fill
                className="object-cover"
                priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-black/10" />
        </div>

        {/* --- Floating Animated Elements --- */}
        
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2"
          style={{
            translateY: avatarTranslateY,
            scale: avatarScale,
            width: AVATAR_MAX_SIZE, // Fixed size, we scale the div
            height: AVATAR_MAX_SIZE,
            ...motionStyle,
          }}
        >
          <Image
            src={USER_IMAGE_URL}
            alt="Ronald Copper"
            fill
            className="rounded-full border-2 border-white object-cover"
            priority
          />
        </motion.div>

        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center"
          style={{
            translateY: nameTranslateY,
            scale: nameScale,
            ...motionStyle,
          }}
        >
          <h1 className="text-2xl font-bold text-white whitespace-nowrap">Ronald Copper</h1>
          <motion.p style={{ opacity: expandedHeaderOpacity, ...motionStyle }} className="text-sm text-white/80">
            online
          </motion.p>
        </motion.div>
        
        <motion.div
          style={{ opacity: expandedHeaderOpacity, ...motionStyle }}
          className="absolute bottom-5 left-0 right-0 flex justify-evenly items-center"
        >
          <ActionButton icon="::FaCommentDots::" label="Message" />
          <ActionButton icon="::FaVolumeXmark::" label="Unmute" />
          <ActionButton icon="::FaPhone::" label="Call" />
          <ActionButton icon="::FaVideo::" label="Video" />
        </motion.div>

        <motion.div
          style={{ opacity: collapsedHeaderOpacity, ...motionStyle }}
          className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 h-full"
        >
          <div className="w-10 h-10"></div>
          <motion.div style={{ opacity: nameInCollapsedHeaderOpacity, ...motionStyle }}>
            <h1 className="text-xl font-bold text-white">Ronald Copper</h1>
          </motion.div>
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