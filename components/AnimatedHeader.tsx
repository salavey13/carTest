// /components/AnimatedHeader.tsx
'use client';

import React from 'react';
import { motion, useTransform, useScroll } from 'framer-motion';
import { VibeContentRenderer } from './VibeContentRenderer';

const FloatingIcon = ({ transitionProgress, index, cameraX, cameraY, initialAvatarSize }) => {
    const angle = (index / 13) * Math.PI * 2;
    const distance = 80 + Math.random() * 62;
    const xOffset = Math.cos(angle) * distance;
    const yOffset = Math.sin(angle) * distance;
    const speedFactor = 1.5 + Math.random() * 0.75;

    return (
        <motion.div
            style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                x: useTransform(transitionProgress, [0, 1], [xOffset, 0]),
                y: useTransform(transitionProgress, [0, 1], [yOffset, -cameraY * 2]),
                transition: `all ${0.25 / speedFactor}s ease-in-out`,
            }}
        >
            <VibeContentRenderer content={`::FaStar className="${index % 2 === 0 ? 'text-purple-900 text-sm' : 'text-pink-400 text-base'}" ::`} />
        </motion.div>
    );
};

function AnimatedHeader({ avatarUrl, username }) {
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 500;
    const initialAvatarSize = screenWidth * 0.60;
    const initialHeaderHeight = initialAvatarSize;
    const triggerOffset = initialHeaderHeight * 0.75;

    const { scrollYProgress } = useScroll();

    const transitionProgress = useTransform(
        scrollYProgress,
        [0, triggerOffset / 1000],
        [0, 1],
        { clamp: true }
    );

    // Avatar Size and Position Animation
    const avatarSize = useTransform(transitionProgress, [0, 1], [initialAvatarSize, 50]);
    const avatarYPosition = useTransform(transitionProgress, [0, 1], [0, 0]);

    // Username Position and Fade Animation
    const usernameYPosition = useTransform(transitionProgress, [0, 1], [initialAvatarSize * 1.1, 0]); // Lower position
    const usernameXPosition = useTransform(transitionProgress, [0, 1], [0, -screenWidth/2 + 40]);
    const usernameFontSize = useTransform(transitionProgress, [0, 1], [48, 16]); // Reduced end-size!

    const shouldShowFixedHeader = useTransform(transitionProgress,
        [0.85, 1],
        [0, 1],
        {clamp: true}
    );

    const headerHeight = useTransform(transitionProgress, [0, 1], [initialHeaderHeight, 50]);

    return (
        <div className="w-full">

            {/* Transitioning Header */}
            <motion.div
                className="fixed top-0 left-0 w-full flex flex-col items-center overflow-hidden"
                style={{
                    height: headerHeight,
                    zIndex: 50,
                    padding: '1rem',
                    background: 'linear-gradient(to bottom, rgba(150, 80, 250,1) 0%, rgba(200, 100, 255, 1) 100%)',
                }}
            >
                {/* Avatar */}
                <motion.div
                    style={{
                        width: avatarSize,
                        height: avatarSize,
                        borderRadius: useTransform(avatarSize, (size) => `${size / 2}px`),
                        overflow: 'visible',
                        y: avatarYPosition,
                        position: 'relative',
                        backgroundImage: `url(${avatarUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                    }}
                    className="relative mb-5"
                >
                   <motion.span
                        style={{
                            fontSize: usernameFontSize,
                            fontWeight: 'bold',
                            position: 'absolute',
                            bottom: 0,
                            left: '50%',
                            x: usernameXPosition,
                            whiteSpace: 'nowrap',
                             transform: 'translate(-50%, 0%)',
                             color: 'white',
                             marginBottom: 10, // Better spacing.
                        }}
                    >
                        {username}
                    </motion.span>
                  {[...Array(13)].map((_, index) => (
                    <FloatingIcon
                      key={index}
                      transitionProgress={transitionProgress}
                      index={index}
                      cameraX={screenWidth / 2}
                      cameraY={20}
                      initialAvatarSize = {initialAvatarSize}
                    />
                  ))}
                </motion.div>
            </motion.div>

            {/* Fixed Header */}
            <motion.div
                className="fixed top-0 left-0 w-full h-16 text-white flex items-center p-4"
                style={{
                   background: 'linear-gradient(to bottom, rgba(150, 80, 250,1) 0%, rgba(200, 100, 255, 1) 100%)',
                    opacity: shouldShowFixedHeader,
                    zIndex: 100
                }}
            >
                <VibeContentRenderer content="::FaUser className='mr-2'::" />
                <span className="text-sm font-semibold" style={{fontSize:`16px`}}>{username}</span>
            </motion.div>

            {/* Filler Section */}
            <div style={{
                height: initialHeaderHeight,
                position: 'relative'
            }}>
                <div></div> {/* Removed username */}
            </div>
        </div>
    );
}

export default AnimatedHeader;
