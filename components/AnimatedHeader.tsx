// /components/AnimatedHeader.tsx
'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VibeContentRenderer } from './VibeContentRenderer'; // Assuming path is correct

const FloatingIcon = ({ startPosition, iconContent, transitionProgress, isLocked }) => {
    const translateX = startPosition.x * (1 - transitionProgress);
    const translateY = startPosition.y * (1 - transitionProgress);
    const opacity = 1 - transitionProgress;

    let colorClass = isLocked ? 'text-purple-800' : 'text-yellow-500';
    let iconSize = isLocked ? 'text-sm' : 'text-base';

    return (
        <div
            style={{
                position: 'absolute',
                left: 0,
                top: 0,
                transform: `translate(${translateX}px, ${translateY}px)`,
                opacity: opacity,
                transition: 'transform 0.15s ease-in-out, opacity 0.15s ease-in-out',
                zIndex: 10,
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
    const [nicknameSize, setNicknameSize] = useState(24);
    const [nicknameOpacity, setNicknameOpacity] = useState(1);
    const [fixedHeaderUsernamePosition, setFixedHeaderUsernamePosition] = useState({ x: 0, y: 0 });
    const [fixedHeaderFontSize, setFixedHeaderFontSize] = useState(14);
    const [initialAvatarRect, setInitialAvatarRect] = useState({left: 0, top: 0, width: 0, height: 0});
    const fixedHeaderUsernameRef = useRef(null);
    const [initialHeaderScale, setInitialHeaderScale] = useState(1.3);
    const [mainHeaderHeight, setMainHeaderHeight] = useState(150);
    const [headerScale, setHeaderScale] = useState(1); // For scaling the initial header.


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

    const triggerOffset = 50;
    const transitionProgress = Math.min(1, Math.max(0, scrollPosition / triggerOffset));
    const avatarSize = 70 * (initialHeaderScale - (initialHeaderScale - 1) * (1 - transitionProgress));
    const blurAmount = 10 * (transitionProgress);
    const cameraCutoutSize = 30 * transitionProgress;
    const initialUsernameSize = 24;
    const targetUsernameSize = fixedHeaderFontSize

    const usernameSize = initialUsernameSize * (1 - transitionProgress) + (transitionProgress * targetUsernameSize);
    const usernameLeftStart = initialAvatarRect.left + initialAvatarRect.width / 2;

    const iconOffset = 20; // Approximate width of the icon in the fixed header
    const usernameLeftTarget = fixedHeaderUsernamePosition.x - initialAvatarRect.width / 2 + iconOffset;

    const usernameLeft = usernameLeftStart + (usernameLeftTarget - usernameLeftStart) * transitionProgress;

    const avatarCenterX = initialAvatarRect.left + initialAvatarRect.width / 2; // Initial Avatar Center
    const avatarCenterY = initialAvatarRect.top + initialAvatarRect.height / 2;

    const avatarTargetX = fixedHeaderUsernamePosition.x + initialAvatarRect.width / 2  // Destination Avatar Center

    const [containerOpacity, setContainerOpacity] = useState(1);


    useEffect(() => {
        setContainerOpacity(Math.max(0, 1 - transitionProgress));
    }, [transitionProgress]);


    const cameraCutoutStyle = {
        width: `${50 + (cameraCutoutSize * 1.5)}px`,
        height: `${cameraCutoutSize * 0.4}px`,
        backgroundColor: `rgba(0,0,0,${transitionProgress})`,
        borderRadius: `${15 + cameraCutoutSize}px`,
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        transition: 'all 0.3s ease-in-out',
        filter: `blur(${blurAmount}px)`,
        opacity: `${transitionProgress}`
    };

    const numIcons = 13;
    const floatingIcons = Array.from({ length: numIcons }, (_, index) => {
        const angle = (index / numIcons) * Math.PI * 2; // Spread more evenly around circle
        let distance = 30 + Math.random() * 20;

        // Restrict to bottom and side areas
        const adjustedAngle = angle * 0.6 + Math.PI/2 + Math.PI/4; // More to bottom
        const x = Math.cos(adjustedAngle) * distance * 1.5; // Wider spread
        const y = Math.sin(adjustedAngle) * distance;


        const isLocked = index % 2 === 0;

        return {
            id: index,
            startPosition: { x, y },
            isLocked: isLocked,
        };
    });


    return (
        <div className="w-full">
            {/* Relative positioned element (Transition Header) */}
            <div
                ref={headerRef}
                className={`fixed top-0 left-0 w-full flex flex-col items-center justify-center transition-all duration-300 ease-in-out overflow-hidden`}
                style={{
                    height: `${mainHeaderHeight}px`,
                    backgroundColor: 'rgba(200,200,200,${(1 - transitionProgress)})',
                   // transform: `scale(${headerScale})`,
                    transformOrigin: 'top center',
                    zIndex: 50, // Below fixed header
                    opacity: `${1 - transitionProgress}` // Fade Out


                }}
            >
                {/* Avatar Area - transitions into cutout */}
                <div
                    style={{
                        width: 70,
                        height: 70,
                        position: 'relative',
                        opacity: `${containerOpacity}`,
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
                <span style={{
                    fontSize: `${usernameSize}px`,
                    opacity: nicknameOpacity,
                    fontWeight: 'bold',
                    transition: 'font-size 0.3s ease-in-out, opacity 0.3s ease-in-out, left 0.3s ease-in-out',
                    position: 'relative', // Needed for left positioning
                    left: `${usernameLeft}px`,

                }} className=" transition-all duration-300 ease-in-out">{username}</span>
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
                <span className="text-sm font-semibold fixed-header-username" ref={setFixedHeaderUsernameElement} style={{fontSize:`${fixedHeaderFontSize}px`, fontFamily: 'sans-serif'}}>{username}</span> {/* Added ref and font style */}
            </div>
           <div style={{ height: `${mainHeaderHeight}px` }} />

        </div>
    );
}

export default AnimatedHeader
