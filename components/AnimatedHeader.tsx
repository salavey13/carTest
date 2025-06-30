// /components/AnimatedHeader.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, useTransform, useScroll } from 'framer-motion';
import { VibeContentRenderer } from './VibeContentRenderer'; // Assuming path is correct


function AnimatedHeader({ avatarUrl, username }) {
    const [fixedHeaderUsernamePosition, setFixedHeaderUsernamePosition] = useState({ x: 0, y: 0 });
    const [fixedHeaderFontSize, setFixedHeaderFontSize] = useState(14);
    const fixedHeaderUsernameRef = useRef(null);
    const mainHeaderHeight = 150;
    const triggerOffset = 50;
    const floatingIconOffset = 20;

    const { scrollYProgress } = useScroll();

    // Calculate Transition Progress
    const transitionProgress = useTransform(
        scrollYProgress,
        [0, triggerOffset / 1000], // Normalize to the trigger offset
        [0, 1],
        { clamp: true }
    );

    // Avatar Size Animation
    const avatarSize = useTransform(transitionProgress, [0, 1], [70, 50]);

    // Avatar Blur Animation
    const blurAmount = useTransform(transitionProgress, [0, 1], [0, 10]);

    // Camera Cutout Size Animation
    const cameraCutoutSize = useTransform(transitionProgress, [0, 1], [0, 20]);

    // Nickname Size Animation
    const initialUsernameSize = 24;
    const targetUsernameSize = fixedHeaderFontSize;
    const usernameSize = useTransform(transitionProgress, [0, 1], [initialUsernameSize, targetUsernameSize]);

    const usernameLeft = useTransform(usernameSize, (size) => `calc(50% - ${size / 2}px)`);

    const cameraCutoutStyle = {
        width: useTransform(cameraCutoutSize, (size) => `${20 + (size * 1.5)}px`), // Sane Camera Size
        height: useTransform(cameraCutoutSize, (size) => `${size * 0.4}px`),
        backgroundColor: `rgba(0,0,0,${transitionProgress})`,
        borderRadius: useTransform(cameraCutoutSize, (size) => `${15 + size}px`),
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        opacity: transitionProgress
    };

    // Memoize Floating Icon
    const FloatingIcon = React.memo(() => (
        <motion.div
            style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%)`, // Directly to center
                opacity: useTransform(transitionProgress, [0,1], [1,0])
            }}
        >

            <VibeContentRenderer content={`::FaStar className="${transitionProgress.get() < 0.5 ? 'text-purple-500 text-sm' : 'text-yellow-400 text-base'}" ::`} />
        </motion.div>
    ));

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

    return (
        <div className="w-full">
            {/* Transitioning Header */}
            <motion.div
                className="fixed top-0 left-0 w-full flex flex-col items-center overflow-hidden"
                style={{
                    height: mainHeaderHeight,
                    zIndex: 50,
                    backgroundColor: `rgba(200,200,200,${useTransform(transitionProgress, [0, 1], [1, 0]).get()})`,
                    opacity: useTransform(transitionProgress, [0, 1], [1, 0])
                }}
            >
                {/* Avatar */}
                <div
                    className="relative mb-5"
                    style={{
                        width: 70,
                        height: 70,
                    }}
                >
                    <FloatingIcon />
                    <motion.div
                        style={{
                            width: avatarSize,
                            height: avatarSize,
                            borderRadius: '50%',
                            overflow: 'hidden',
                            filter: `blur(${blurAmount}px)`,
                        }}
                        className="absolute top-0 left-0"
                    >
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    </motion.div>
                    <motion.div style={cameraCutoutStyle}></motion.div>
                </div>

                {/* Nickname */}
                <motion.span
                    style={{
                        fontSize: usernameSize,
                        fontWeight: 'bold',
                        position: 'absolute',
                        left: usernameLeft,
                        top: 80
                    }}
                >
                    {username}
                </motion.span>
            </motion.div>

            {/* Fixed Header */}
            <motion.div
                className="fixed top-0 left-0 w-full h-16 bg-gray-800 text-white flex items-center p-4"
                style={{
                    opacity: useTransform(scrollYProgress, [0, triggerOffset/1000], [0, 1], {clamp: true}),
                    pointerEvents: useTransform(scrollYProgress, [0, triggerOffset/1000], [0, 1], {clamp: true}).interpolate(op => op === 0 ? 'none' : 'auto'),
                    zIndex: 100
                }}
            >
                <VibeContentRenderer content="::FaUser className='mr-2'::" />
                <span className="text-sm font-semibold" ref={setFixedHeaderUsernameElement} style={{fontSize:`${fixedHeaderFontSize}px`, fontFamily: 'sans-serif'}}>{username}</span>
            </motion.div>

            {/* Filler Section */}
            <div style={{
                height: mainHeaderHeight,
                position: 'relative'
            }}>
                <div style = {{height:`${initialUsernameSize * (1-transitionProgress.get()) + targetUsernameSize * transitionProgress.get()}`,overflow: 'hidden'}}>{username}</div>
            </div>
        </div>
    );
}

export default AnimatedHeader;
