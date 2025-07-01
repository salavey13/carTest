// /components/AnimatedHeader.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, useTransform, useScroll } from 'framer-motion';
import { VibeContentRenderer } from './VibeContentRenderer'; // Assuming path is correct

const FloatingIcon = ({ transitionProgress, index, cameraX, cameraY }) => {
    const angle = (index / 13) * Math.PI * 2;
    const distance = 45 + Math.random() * 30; // Jittered distance
    const xOffset = Math.cos(angle) * distance;
    const yOffset = Math.sin(angle) * distance;

    const xTarget = cameraX - xOffset;
    const yTarget = cameraY - yOffset;

    return (
        <motion.div
            style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                x: useTransform(transitionProgress, [0, 1], [0, xTarget]),
                y: useTransform(transitionProgress, [0, 1], [0, yTarget]),
                opacity: useTransform(transitionProgress, [0, 1], [1, 0])
            }}
        >
            <VibeContentRenderer content={`::FaStar className="${index % 2 === 0 ? 'text-purple-900 text-sm' : 'text-pink-400 text-base'}" ::`} />
        </motion.div>
    );
};

function AnimatedHeader({ avatarUrl, username }) {
    const [fixedHeaderUsernamePosition, setFixedHeaderUsernamePosition] = useState({ x: 0, y: 0 });
    const [fixedHeaderFontSize, setFixedHeaderFontSize] = useState(14);
    const fixedHeaderUsernameRef = useRef(null);

    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 500; // Default width
    const initialAvatarSize = screenWidth * 0.69; // 69% of screen width
    const initialHeaderHeight = initialAvatarSize;

    const triggerOffset = initialHeaderHeight * 0.55; //  55% of header height

    const { scrollYProgress } = useScroll();

    // Calculate Transition Progress (0 to 1 within the triggerOffset)
    const transitionProgress = useTransform(
        scrollYProgress,
        [0, triggerOffset / 1000],
        [0, 1],
        { clamp: true }
    );

    // Avatar Size and Position Animation
    const avatarSize = useTransform(transitionProgress, [0, 1], [initialAvatarSize, 50]); // Size reduces to 50px
    const avatarYPosition = useTransform(transitionProgress, [0, 1], [0, -((initialAvatarSize - 50)/2)]); // Position above

    // Username Position and Fade Animation
     const usernameYPosition = useTransform(transitionProgress, [0, 1], [5, 0]);

      const usernameOpacity = useTransform(transitionProgress, [0, 1], [1, 0]);

    // Camera Cutout Size
     const cameraCutoutSize = useTransform(transitionProgress, [0, 1], [0, 20]);
     const cameraX = screenWidth / 2;
     const cameraY = 20; // Distance from top of container

     const setFixedHeaderUsernameElement = useCallback((node) => {
        if (node) {
            fixedHeaderUsernameRef.current = node;
            const rect = node.getBoundingClientRect();
             setFixedHeaderUsernamePosition({
                x: rect.left,
                y: rect.top,
            });
             setFixedHeaderFontSize(parseFloat(window.getComputedStyle(node).fontSize));
        }
    }, []);

    const pointerEvents = useTransform(transitionProgress, [0, 1], ["none", "auto"]);

    const shouldShowFixedHeader = useTransform(transitionProgress,
        [0.9, 1], // Start fading in at 90% progress
        [0, 1], // Opacity values
        {clamp: true}
    );

    const headerHeight = useTransform(avatarSize, size => `${size}px`);

    return (
        <div className="w-full">
            {/* Transitioning Header */}
            <motion.div
                className="fixed top-0 left-0 w-full flex flex-col items-center overflow-hidden"
                style={{
                    height: headerHeight,
                    zIndex: 50,
                    backgroundColor: `rgba(150, 80, 250,${useTransform(transitionProgress, [0, 1], [1, 0]).get()})`, // Purple Background
                    opacity: useTransform(transitionProgress, [0, 1], [1, 0])
                }}
                pointerEvents={pointerEvents}
            >
                {/* Avatar */}
                <motion.div
                    style={{
                        width: avatarSize,
                        height: avatarSize,
                        borderRadius: useTransform(avatarSize, (size) => `${size / 2}px`), // Maintain circle shape
                        overflow: 'hidden',
                        y: avatarYPosition,
                        position: 'relative',
                        backgroundImage: `url(${avatarUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                    }}
                    className="relative mb-5"
                >
                  {[...Array(13)].map((_, index) => (
                    <FloatingIcon
                      key={index}
                      transitionProgress={transitionProgress}
                      index={index}
                      cameraX={cameraX}
                      cameraY={cameraY}
                    />
                  ))}
                   {/* Nickname */}
                <motion.span
                    style={{
                        fontSize: 24,
                        fontWeight: 'bold',
                        position: 'absolute',
                        top: 20,
                        left: '50%',
                        x: '-50%',
                        y: usernameYPosition,
                        opacity: usernameOpacity,
                        zIndex: 100,
                    }}
                >
                    {username}
                </motion.span>
                {/* Camera Cutout (Fixed to Top) */}
                <motion.div
                    style={{
                        width: useTransform(cameraCutoutSize, (size) => `${20 + (size * 1.5)}px`), // Sane Camera Size
                        height: useTransform(cameraCutoutSize, (size) => `${cameraCutoutSize.get() * 0.4}px`),
                        backgroundColor: `rgba(0,0,0,${transitionProgress.get()})`,
                        borderRadius: useTransform(cameraCutoutSize, (size) => `${15 + cameraCutoutSize.get()}px`),
                        position: 'absolute',
                        top: 0,
                        left: '50%',
                        x: '-50%',
                        zIndex: 1000,
                    }}
                ></motion.div>
              
                </motion.div>

           
            </motion.div>

            {/* Fixed Header */}
            <motion.div
                className="fixed top-0 left-0 w-full h-16 bg-gray-800 text-white flex items-center p-4"
                style={{
                    opacity: shouldShowFixedHeader,
                    zIndex: 100
                }}
                pointerEvents={pointerEvents}
            >
                <VibeContentRenderer content="::FaUser className='mr-2'::" />
                <span className="text-sm font-semibold" ref={setFixedHeaderUsernameElement} style={{fontSize:`${fixedHeaderFontSize}px`, fontFamily: 'sans-serif'}}>{username}</span>
            </motion.div>

            {/* Filler Section */}
            <div style={{
                height: initialHeaderHeight,
                position: 'relative'
            }}>
                <div>{username}</div>
            </div>
        </div>
    );
}

export default AnimatedHeader;
