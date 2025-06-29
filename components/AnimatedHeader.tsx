// /components/AnimatedHeader.tsx
'use client';
import React, { useState, useEffect, useRef } from 'react';
import { VibeContentRenderer } from './VibeContentRenderer'; // Assuming path is correct

const FloatingIcon = ({ startPosition, iconContent, avatarCenter, transitionProgress, isLocked, index }) => {
    const controlPointX = startPosition.x * 0.3;
    const controlPointY = startPosition.y * 0.3;

    const translateX = (1 - transitionProgress) * startPosition.x + transitionProgress * controlPointX;
    const translateY = (1 - transitionProgress) * startPosition.y + transitionProgress * controlPointY;

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
    const [avatarCenter, setAvatarCenter] = useState({ x: 0, y: 0 });
    const [nicknameSize, setNicknameSize] = useState(16);
    const [nicknameOpacity, setNicknameOpacity] = useState(1);
    const [fixedHeaderUsernamePosition, setFixedHeaderUsernamePosition] = useState({ x: 0, y: 0 }); // Store fixed header username position
    const [fixedHeaderFontSize, setFixedHeaderFontSize] = useState(16); // Store fixed header font size
    const [initialAvatarRect, setInitialAvatarRect] = useState({left: 0, top: 0, width: 0, height: 0});


    useEffect(() => {
        const handleScroll = () => {
            setScrollPosition(window.scrollY);
            setIsFixedHeaderVisible(window.scrollY > triggerOffset);
        };

        const updatePositions = () => {
            const avatarRect = document.querySelector('.avatar-container')?.getBoundingClientRect();

            const fixedUsernameRect = document.querySelector('.fixed-header-username')?.getBoundingClientRect();

            if (avatarRect) {
                setAvatarCenter({
                    x: avatarRect.left + avatarRect.width / 2,
                    y: avatarRect.top + avatarRect.height / 2,
                });
                setInitialAvatarRect({
                    left: avatarRect.left,
                    top: avatarRect.top,
                    width: avatarRect.width,
                    height: avatarRect.height
                });
            }

            if (fixedUsernameRect) {
                setFixedHeaderUsernamePosition({
                    x: fixedUsernameRect.left,
                    y: fixedUsernameRect.top,
                });
                setFixedHeaderFontSize(parseFloat(window.getComputedStyle(fixedUsernameRect).fontSize)); // Get actual font size

            }


        };

        window.addEventListener('scroll', handleScroll);
        window.addEventListener('resize', updatePositions);

        updatePositions();

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', updatePositions);
        };
    }, []);

    const triggerOffset = 50;
    const transitionProgress = Math.min(1, Math.max(0, scrollPosition / triggerOffset));
    const avatarSize = 70 * (1 - transitionProgress);
    const blurAmount = 10 * (1 - transitionProgress); //Reverse Blur
    const cameraCutoutSize = 30 * transitionProgress;
    const initialUsernameSize = 16;
    const usernameSize = initialUsernameSize * (Math.max(0.3, (1 - transitionProgress))); // Ensure not zero
    const usernameLeftStart = initialAvatarRect.left + initialAvatarRect.width / 2;

    const usernameLeft = usernameLeftStart + (fixedHeaderUsernamePosition.x - usernameLeftStart) * transitionProgress;

    const avatarCenterX = initialAvatarRect.left + initialAvatarRect.width / 2;
    const avatarCenterY = initialAvatarRect.top + initialAvatarRect.height / 2;

    const avatarTargetX = fixedHeaderUsernamePosition.x - initialAvatarRect.width / 2 //Approx target for calculations

    const [containerOpacity, setContainerOpacity] = useState(1); //Начальное значение

    
    useEffect(() => {
        const newNicknameSize = initialUsernameSize * Math.max(0.3, (1 - transitionProgress)); // Minimum size
        setNicknameSize(newNicknameSize);

        const newNicknameOpacity = Math.max(0.3, (1 - transitionProgress));
        setNicknameOpacity(newNicknameOpacity);
  
        setContainerOpacity(Math.max(0, 1 - transitionProgress)); // Пример вычисления - затухание контейнера вместе с переходом
      }, [transitionProgress]);


    const cameraCutoutStyle = {
        width: `${50 + (cameraCutoutSize * 1.5)}px`,
        height: `${cameraCutoutSize * 0.4}px`, // Narrower
        backgroundColor: 'rgba(0,0,0,${transitionProgress})', // Visible and opacity based on progress
        borderRadius: `${15 + cameraCutoutSize}px`,
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        transition: 'all 0.3s ease-in-out',
        filter: `blur(${blurAmount}px)`, // Reverse Blur
        opacity: `${transitionProgress}` // Added opacity
    };

    const numIcons = 13;
    const floatingIcons = Array.from({ length: numIcons }, (_, index) => {
        const angle = Math.random() * 2 * Math.PI;
        const distance = 30 + Math.random() * 20;

        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;

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
                className={`relative w-full h-24 bg-gray-100 flex flex-col items-center justify-center transition-all duration-300 ease-in-out overflow-hidden`}
                style={{
                    opacity: isFixedHeaderVisible ? (1 - transitionProgress) : 1,
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
                            avatarCenter={{x:avatarCenterX, y: avatarCenterY}} //Corrected center
                            transitionProgress={transitionProgress}
                            isLocked={icon.isLocked}
                            index={index}
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
                    fontSize: `${nicknameSize}px`,
                    opacity: nicknameOpacity,
                    transition: 'font-size 0.3s ease-in-out, opacity 0.3s ease-in-out, left 0.3s ease-in-out',
                    position: 'relative', // Needed for left positioning
                    left: `${(fixedHeaderUsernamePosition.x > 0) ? (usernameLeft - avatarCenterX) : 0}px`, // Move left

                }} className=" transition-all duration-300 ease-in-out">{username}</span>
            </div>

            {/* Fixed header (Fixed Header) */}
            <div
                className={`fixed top-0 left-0 w-full h-16 bg-gray-800 text-white flex items-center p-4 transition-opacity duration-300`}
                style={{
                    opacity: isFixedHeaderVisible ? transitionProgress : 0,
                    pointerEvents: isFixedHeaderVisible ? 'auto' : 'none',
                    zIndex: 100,
                }}
            >
                <VibeContentRenderer content="::FaUser className='mr-2'::" />
                <span className="text-sm font-semibold fixed-header-username" style={{fontSize:`${fixedHeaderFontSize}px`, fontFamily: 'sans-serif'}}>{username}</span> {/* Added class and font style */}
            </div>
        </div>
    );
}

export default AnimatedHeader
