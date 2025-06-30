// /components/AnimatedHeader.tsx
'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VibeContentRenderer } from './VibeContentRenderer'; // Assuming path is correct

const FloatingIcon = ({ startPosition, transitionProgress, isLocked }) => {
    const centerX = 35; // Center of the avatar container
    const centerY = 35;
    const x = centerX + startPosition.x * (1 - transitionProgress * 0.8); // Less Overshoot
    const y = centerY + startPosition.y * (1 - transitionProgress * 0.8);

    let colorClass = isLocked ? 'text-purple-500' : 'text-yellow-400';
    let iconSize = isLocked ? 'text-sm' : 'text-base';

    return (
        <div
            style={{
                position: 'absolute',
                left: 0,
                top: 0,
                transform: `translate(${x}px, ${y}px)`, // Move towards avatar center
                opacity: 1 - transitionProgress,
                zIndex: 10,
                pointerEvents: 'none',
            }}
        >
            <VibeContentRenderer content={isLocked ? `::FaStar className="${colorClass} ${iconSize}" ::` : `::FaStar className="${colorClass} ${iconSize}" ::`} />
        </div>
    );
};


function AnimatedHeader({ avatarUrl, username }) {
    const [scrollPosition, setScrollPosition] = useState(0);
    const headerRef = useRef(null);
    const [isFixedHeaderVisible, setIsFixedHeaderVisible] = useState(false);
    const [fixedHeaderUsernamePosition, setFixedHeaderUsernamePosition] = useState({ x: 0, y: 0 });
    const [fixedHeaderFontSize, setFixedHeaderFontSize] = useState(14);
    const [initialAvatarRect, setInitialAvatarRect] = useState({left: 0, top: 0, width: 0, height: 0});
    const fixedHeaderUsernameRef = useRef(null);
    const mainHeaderHeight = 150;
    const triggerOffset = 50;

    // Ref for Nickname in the main section
    const nicknameRef = useRef<HTMLSpanElement>(null);

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

    useEffect(() => {
        const handleScroll = () => {
            setScrollPosition(window.scrollY);

            setIsFixedHeaderVisible(window.scrollY > triggerOffset);
        };

        const updateAvatarPosition = () => {
            const avatarRect = document.querySelector('.avatar-container')?.getBoundingClientRect();
            if (avatarRect) {
                setInitialAvatarRect({
                    left: avatarRect.left,
                    top: avatarRect.top,
                    width: avatarRect.width,
                    height: avatarRect.height
                });
            }
        };

        window.addEventListener('scroll', handleScroll);
        window.addEventListener('resize', updateAvatarPosition);

        updateAvatarPosition();

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', updateAvatarPosition);
        };
    }, []);


    const transitionProgress = Math.min(1, Math.max(0, scrollPosition / triggerOffset));
    const avatarSize = 70 * (1 + 0.3 * (1 - transitionProgress)); // Simplified Avatar size calc
    const blurAmount = 10 * transitionProgress;
    const cameraCutoutSize = 20 * transitionProgress; // Proportional camera cutout size
    const initialUsernameSize = 24;
    const targetUsernameSize = fixedHeaderFontSize;
    const usernameSize = initialUsernameSize * (1 - transitionProgress) + (transitionProgress * targetUsernameSize);

    const iconOffset = 20;
    const usernameLeftTarget = fixedHeaderUsernamePosition.x - 35 + iconOffset;
    const usernameLeft = initialAvatarRect.left + initialAvatarRect.width / 2 + (usernameLeftTarget - (initialAvatarRect.left + initialAvatarRect.width / 2)) * transitionProgress;


    const cameraCutoutStyle = {
        width: `${20 + (cameraCutoutSize * 1.5)}px`, // Sane Camera Size
        height: `${cameraCutoutSize * 0.4}px`,
        backgroundColor: `rgba(0,0,0,${transitionProgress})`,
        borderRadius: `${15 + cameraCutoutSize}px`,
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        transition: 'all 0.3s ease-in-out',
        opacity: `${transitionProgress}` // Fade In Gradually
    };

    const numIcons = 13;
    const floatingIcons = Array.from({ length: numIcons }, (_, index) => {
        const angle = (index / numIcons) * Math.PI * 2;
        const distance = 30 + Math.random() * 20;

        // Simplified Icon Positions
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;

        const isLocked = index % 2 === 0;

        return {
            id: index,
            startPosition: { x, y },
            isLocked: isLocked,
        };
    });


     const mainNicknameStyle = {
        fontSize: `${usernameSize}px`,
        fontWeight: 'bold',
        transition: 'font-size 0.3s ease-in-out, left 0.3s ease-in-out',
        position: 'absolute',
        left: `${usernameLeft}px`,
        top: '80px'
    };

    const fillerNicknameStyle = {
        height: `${initialUsernameSize * (1-transitionProgress) + targetUsernameSize * transitionProgress}`,
        overflow: 'hidden'
    }


    return (
        <div className="w-full">
            {/* Relative positioned element (Transition Header) */}
            <div
                ref={headerRef}
                className={`fixed top-0 left-0 w-full flex flex-col items-center transition-all duration-300 ease-in-out overflow-hidden`}
                style={{
                    height: `${mainHeaderHeight}px`,
                    backgroundColor: 'rgba(200,200,200,${(1 - transitionProgress)})`,
                    zIndex: 50,
                    opacity: `${1 - transitionProgress}`
                }}
            >
                {/* Avatar Area - transitions into cutout */}
                <div
                    style={{
                        width: 70,
                        height: 70,
                        position: 'relative',
                        marginBottom: '5px',
                    }}
                    className="transition-all duration-300 ease-in-out avatar-container"
                >
                    {/* Floating Sprinkled Icons */}
                    {floatingIcons.map((icon, index) => (
                        <FloatingIcon
                            key={icon.id}
                            startPosition={icon.startPosition}
                            transitionProgress={transitionProgress}
                            isLocked={icon.isLocked}
                        />
                    ))}

                    <div
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
                    </div>
                    <div style={cameraCutoutStyle}></div>
                </div>

                {/* Username Area */}
                 <span
                    ref={nicknameRef}
                    style={mainNicknameStyle}
                    className="transition-all duration-300 ease-in-out"
                >
                   {username}
                </span>
            </div>

           {/* Fixed header (Fixed Header) */}
            <div
                className={`fixed top-0 left-0 w-full h-16 bg-gray-800 text-white flex items-center p-4 transition-opacity duration-300`}
                style={{
                    opacity: isFixedHeaderVisible ? 1 : 0, // Always show
                    pointerEvents: isFixedHeaderVisible ? 'auto' : 'none',
                    zIndex: 100,
                }}
            >
                <VibeContentRenderer content="::FaUser className='mr-2'::" />
                <span className="text-sm font-semibold fixed-header-username" ref={setFixedHeaderUsernameElement} style={{fontSize:`${fixedHeaderFontSize}px`, fontFamily: 'sans-serif'}}>{username}</span>
            </div>
             {/* filler section: scale name*/}
            <div style={{
                height: `${mainHeaderHeight}px`,
                position: 'relative'
            }}>
                 <div style = {fillerNicknameStyle}>{username}</div>
             </div>
        </div>
    );
}

export default AnimatedHeader
