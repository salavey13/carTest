// /components/AnimatedHeader.tsx
'use client';
import React, { useState, useEffect, useRef } from 'react';
import { VibeContentRenderer } from './VibeContentRenderer'; // Assuming path is correct

const FloatingIcon = ({ startPosition, iconContent, avatarCenter, transitionProgress }) => {
    // Calculate curved path: towards avatarCenter
    const controlPointX = startPosition.x * 0.5; // Adjust for curve
    const controlPointY = startPosition.y * 0.5; // Adjust for curve

    const translateX = (1 - transitionProgress) * startPosition.x + transitionProgress * controlPointX;
    const translateY = (1 - transitionProgress) * startPosition.y + transitionProgress * controlPointY;

    const finalX = controlPointX + (avatarCenter.x - controlPointX) * transitionProgress;
    const finalY = controlPointY + (avatarCenter.y - controlPointY) * transitionProgress;

    const opacity = 1 - transitionProgress;

    return (
        <div
            style={{
                position: 'absolute',
                left: 0,
                top: 0,
                transform: `translate(${translateX}px, ${translateY}px)`,
                opacity: opacity,
                transition: 'transform 0.3s ease-in-out, opacity 0.3s ease-in-out',
                zIndex: 10, // Ensure icons are above other elements
            }}
        >
            <VibeContentRenderer content={iconContent} />
        </div>
    );
};


function AnimatedHeader({ avatarUrl, username }) {
    const [scrollPosition, setScrollPosition] = useState(0);
    const headerRef = useRef(null);
    const [isFixedHeaderVisible, setIsFixedHeaderVisible] = useState(false);
    const [avatarCenter, setAvatarCenter] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleScroll = () => {
            setScrollPosition(window.scrollY);
            setIsFixedHeaderVisible(window.scrollY > triggerOffset);
        };

        const updateAvatarCenter = () => {
            // Get the avatar's position relative to the viewport
            const avatarRect = document.querySelector('.avatar-container')?.getBoundingClientRect();
            if (avatarRect) {
                setAvatarCenter({
                    x: avatarRect.left + avatarRect.width / 2,
                    y: avatarRect.top + avatarRect.height / 2,
                });
            }
        };

        window.addEventListener('scroll', handleScroll);
        window.addEventListener('resize', updateAvatarCenter); // Update on resize too

        updateAvatarCenter(); // Initial call to set the initial position

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', updateAvatarCenter);
        };
    }, []);

    const triggerOffset = 50;
    const transitionProgress = Math.min(1, Math.max(0, scrollPosition / triggerOffset));
    const avatarSize = 70 * (1 - transitionProgress);
    const blurAmount = 10 * transitionProgress;
    const cameraCutoutSize = 30 * transitionProgress;
    const usernameSize = 20 * (1 - transitionProgress);
    const usernameLeft = 100 * transitionProgress;
    const avatarOpacity = (1 - transitionProgress)

    const cameraCutoutStyle = {
        width: `${50 + (cameraCutoutSize * 1.5)}px`,
        height: `${cameraCutoutSize * 0.8}px`,
        backgroundColor: 'black',
        borderRadius: `${15 + cameraCutoutSize}px`,
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        transition: 'all 0.3s ease-in-out',
        filter: `blur(${blurAmount / 5}px)`,
    };

    const numIcons = 13; // Number of icons
    const floatingIcons = Array.from({ length: numIcons }, (_, index) => {
        const angle = Math.random() * 2 * Math.PI;
        const distance = 40; // Distance from the avatar center

        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;

        const isLocked = index % 2 === 0; // Half locked, half unlocked

        return {
            id: index,
            startPosition: { x, y },
            iconContent: isLocked ? `::FaLock className="text-gray-500 text-sm" ::` : `::FaStar className="text-gray-500 text-sm" ::`,
        };
    });


    return (
        <div className="w-full">
            {/* Relative positioned element (Transition Header) */}
            <div
                ref={headerRef}
                className={`relative w-full h-24 bg-gray-100 flex items-center justify-start transition-all duration-300 ease-in-out overflow-hidden`}
                style={{
                    opacity: isFixedHeaderVisible ? (1 - transitionProgress) : 1,
                }}
            >
                {/* Avatar Area - transitions into cutout */}
                <div
                    style={{ width: 70, height: 70, position: 'relative', opacity: `${avatarOpacity}` }}
                    className="ml-4 transition-all duration-300 ease-in-out avatar-container" // Add avatar-container class
                >
                    {/* Floating Sprinkled Icons */}
                    {floatingIcons.map((icon) => (
                        <FloatingIcon
                            key={icon.id}
                            startPosition={icon.startPosition}
                            iconContent={icon.iconContent}
                            avatarCenter={avatarCenter}
                            transitionProgress={transitionProgress}
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
                    <div style={cameraCutoutStyle}></div> {/* THE Camera Cutout! */}
                </div>

                {/* Username Area */}
                <span style={{ fontSize: `${usernameSize}px`, left: `${usernameLeft}px`, opacity: 1 }} className="transition-all duration-300 ease-in-out ml-2">{username}</span>
            </div>

            {/* Fixed header (Fixed Header) */}
            <div
                className={`fixed top-0 left-0 w-full h-16 bg-gray-800 text-white flex items-center p-4 transition-opacity duration-300`}
                style={{
                    opacity: isFixedHeaderVisible ? transitionProgress : 0,
                    pointerEvents: isFixedHeaderVisible ? 'auto' : 'none', // prevent clicks when not visible
                }}
            >
                <VibeContentRenderer content="::FaUser className='mr-2'::" /> {/* Using VibeContentRenderer for User icon*/}
                <span className="text-sm font-semibold">{username}</span>
            </div>
        </div>
    );
}

export default AnimatedHeader
