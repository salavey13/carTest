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

    // Animation control points
    const collapseStart = 0;
    const collapseEnd = 0.2;
    const finalHeaderFadeInStart = 0.15;
    const finalHeaderFadeInEnd = 0.25;

    // --- HERO ELEMENTS (Animate OUT) ---
    const heroOpacity = useTransform(scrollYProgress, [collapseStart, collapseEnd], [1, 0]);
    const heroScale = useTransform(scrollYProgress, [collapseStart, collapseEnd], [1, 0.5]);

    // --- ORBITING ICONS (Animate IN and then OUT) ---
    const orbitDistance = useTransform(scrollYProgress, [collapseStart, collapseEnd * 0.8], [110, 0], { clamp: true });
    const orbitOpacity = useTransform(scrollYProgress, [collapseStart, collapseEnd * 0.7], [0.8, 0], { clamp: true });
    const orbitRotation = useTransform(scrollYProgress, [0, 1], [0, 360]);

    // --- FINAL FIXED HEADER (Animate IN) ---
    const finalHeaderOpacity = useTransform(scrollYProgress, [finalHeaderFadeInStart, finalHeaderFadeInEnd], [0, 1]);

    // --- CONTINUOUS TRANSITIONING ELEMENTS ---
    const usernameFontSize = useTransform(scrollYProgress, [collapseStart, collapseEnd], [28, 16], { clamp: true });
    const usernameY = useTransform(scrollYProgress, [collapseStart, collapseEnd], [INITIAL_HEADER_HEIGHT / 2 + 80, FINAL_HEADER_HEIGHT / 2], { clamp: true });
    const usernameX = useTransform(scrollYProgress, [collapseStart, collapseEnd], ['50%', '76px'], { clamp: true });
    const translateX = useTransform(scrollYProgress, [collapseStart, collapseEnd], ['-50%', '0%'], { clamp: true });

    return (
        <>
            <div style={{ height: INITIAL_HEADER_HEIGHT }} />

            <div className="fixed top-0 left-0 w-full z-50" style={{ height: INITIAL_HEADER_HEIGHT }}>
                
                {/* Static Background for the final header */}
                <motion.div
                    className="absolute top-0 left-0 w-full bg-gradient-to-b from-dark-card to-dark-bg/95 backdrop-blur-md shadow-lg shadow-black/30 border-b border-brand-purple/30"
                    style={{ 
                        height: FINAL_HEADER_HEIGHT,
                        opacity: finalHeaderOpacity 
                    }}
                />

                {/* Hero Avatar - Collapses and Fades */}
                <motion.div
                    className="absolute top-1/2 left-1/2"
                    style={{
                        x: '-50%',
                        y: '-50%',
                        opacity: heroOpacity,
                        scale: heroScale,
                    }}
                >
                    <div className="relative w-36 h-36 rounded-full border-4 border-brand-pink shadow-lg shadow-brand-pink/30">
                        <Image src={avatarUrl} alt={`${username}'s Avatar`} fill className="rounded-full object-cover" priority />
                    </div>
                </motion.div>

                {/* Orbiting Icons - Collapse into the center */}
                <motion.div className="absolute top-1/2 left-1/2" style={{ x: useTransform(orbitDistance, v => Math.cos(1) * v - 12), y: useTransform(orbitDistance, v => Math.sin(1) * v - 12), opacity: orbitOpacity, rotate: orbitRotation }}>
                    <VibeContentRenderer content="::FaTools className='text-2xl text-brand-purple'::" />
                </motion.div>
                <motion.div className="absolute top-1/2 left-1/2" style={{ x: useTransform(orbitDistance, v => Math.cos(4) * v - 12), y: useTransform(orbitDistance, v => Math.sin(4) * v - 12), opacity: orbitOpacity, rotate: useTransform(orbitRotation, v => -v) }}>
                    <VibeContentRenderer content="::FaDiceD20 className='text-2xl text-neon-lime'::" />
                </motion.div>

                {/* Fixed Avatar - Fades in for the final header */}
                <motion.div
                    className="absolute rounded-full border-2 border-brand-pink"
                    style={{
                        width: 48,
                        height: 48,
                        top: 8,
                        left: 16,
                        opacity: finalHeaderOpacity,
                    }}
                >
                    <Image src={avatarUrl} alt={`${username}'s Avatar`} fill className="rounded-full object-cover" sizes="48px" />
                </motion.div>
                
                {/* Username - Continuously transitions */}
                <motion.h1
                    className="absolute font-orbitron font-bold text-brand-cyan"
                    style={{
                        fontSize: usernameFontSize,
                        top: usernameY,
                        left: usernameX,
                        x: translateX,
                        y: '-50%',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {username}
                </motion.h1>

                {/* Fixed Settings Icon - Fades in */}
                <motion.div
                    className="absolute top-1/2 right-4 -translate-y-1/2"
                    style={{ opacity: finalHeaderOpacity, top: FINAL_HEADER_HEIGHT / 2 }}
                >
                    <Link href="/settings" aria-label="Settings">
                        <VibeContentRenderer content="::FaTools className='text-2xl text-brand-purple/80 hover:text-brand-purple hover:rotate-90 transition-all duration-300'::" />
                    </Link>
                </motion.div>
            </div>
        </>
    );
}