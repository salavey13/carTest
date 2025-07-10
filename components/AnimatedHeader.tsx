'use client';

import React from 'react';
import { motion, useTransform, useScroll } from 'framer-motion';
import { VibeContentRenderer } from './VibeContentRenderer';
import Link from 'next/link';
import Image from 'next/image';

const INITIAL_HEADER_HEIGHT = 250;
const FINAL_HEADER_HEIGHT = 64;

export default function AnimatedHeader({ avatarUrl, username }: { avatarUrl: string; username: string }) {
    const { scrollYProgress } = useScroll();

    // --- Animation Control Points (as fractions of a screen height, roughly) ---
    const collapseStart = 0;
    const collapseEnd = 0.2; // The animation happens quickly at the top of the page
    const finalHeaderFadeInStart = 0.15;
    const finalHeaderFadeInEnd = 0.25;

    // --- ANIMATED "HERO" HEADER ELEMENTS ---
    // These elements exist only for the initial, large state and animate OUT.

    // The entire hero section fades out as it collapses
    const heroOpacity = useTransform(scrollYProgress, [collapseStart, collapseEnd], [1, 0]);
    
    // The large avatar moves up and shrinks into nothingness
    const heroAvatarY = useTransform(scrollYProgress, [collapseStart, collapseEnd], [0, -100]);
    const heroAvatarScale = useTransform(scrollYProgress, [collapseStart, collapseEnd], [1, 0]);
    
    // The large username also moves up and fades out
    const heroUsernameY = useTransform(scrollYProgress, [collapseStart, collapseEnd], [0, -80]);

    // --- FINAL "FIXED" HEADER ELEMENTS ---
    // These elements animate IN to form the final, compact header.

    const finalHeaderOpacity = useTransform(scrollYProgress, [finalHeaderFadeInStart, finalHeaderFadeInEnd], [0, 1]);

    return (
        <>
            {/* Placeholder to push content down */}
            <div style={{ height: INITIAL_HEADER_HEIGHT }} />

            {/* Main container that sticks to the top. Its height doesn't change. */}
            <div className="fixed top-0 left-0 w-full z-50" style={{ height: INITIAL_HEADER_HEIGHT }}>
                
                {/* HERO STATE: This part is visible initially and animates out */}
                <motion.div
                    className="absolute inset-0 flex flex-col items-center justify-center"
                    style={{ opacity: heroOpacity, y: heroAvatarY }} // Animate the whole group
                >
                    <motion.div
                        className="relative rounded-full border-4 border-brand-pink shadow-lg shadow-brand-pink/30"
                        style={{ width: 144, height: 144, scale: heroAvatarScale }}
                    >
                        <Image
                            src={avatarUrl}
                            alt={`${username}'s Hero Avatar`}
                            fill
                            className="rounded-full object-cover"
                            priority
                        />
                    </motion.div>
                    <motion.h1
                        className="mt-4 text-3xl font-orbitron font-bold text-brand-cyan"
                        style={{ y: heroUsernameY }}
                    >
                        {username}
                    </motion.h1>
                </motion.div>

                {/* FINAL FIXED STATE: This part is invisible initially and animates in */}
                <motion.div
                    className="absolute top-0 left-0 w-full flex items-center bg-gradient-to-b from-dark-card to-dark-bg/95 backdrop-blur-md shadow-lg shadow-black/30 border-b border-brand-purple/30"
                    style={{ 
                        height: FINAL_HEADER_HEIGHT,
                        opacity: finalHeaderOpacity 
                    }}
                >
                    <div className="container mx-auto max-w-3xl flex items-center justify-between px-4">
                        <div className="flex items-center gap-3">
                            <div className="relative w-12 h-12 rounded-full border-2 border-brand-pink">
                                <Image
                                    src={avatarUrl}
                                    alt={`${username}'s Avatar`}
                                    fill
                                    className="rounded-full object-cover"
                                    sizes="48px"
                                />
                            </div>
                            <span className="font-orbitron font-semibold text-light-text">{username}</span>
                        </div>
                        <Link href="/settings" aria-label="Settings">
                             <VibeContentRenderer content="::FaCog className='text-2xl text-brand-purple/80 hover:text-brand-purple hover:rotate-90 transition-all duration-300'::" />
                        </Link>
                    </div>
                </motion.div>

            </div>
        </>
    );
}