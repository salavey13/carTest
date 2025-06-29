// /components/AnimatedHeader.tsx
'use client';
import React, { useState, useEffect, useRef } from 'react';
import { VibeContentRenderer } from './VibeContentRenderer'; // Assuming path is correct

const FloatingIcon = ({ startPosition, iconContent, avatarCenter, transitionProgress, isLocked, index }) => {
    const [bounces, setBounces] = useState(0);

    useEffect(() => {
        if (transitionProgress > 0 && bounces < 3) {
            const timeout = setTimeout(() => {
                setBounces(bounces + 1);
            }, (index % 5) * 50 + 100); // Stagger the bounces a little
            return () => clearTimeout(timeout);
        }
    }, [transitionProgress, bounces, index]);

    const controlPointX = startPosition.x * 0.3;
    const controlPointY = startPosition.y * 0.3;


    const translateX = (1 - transitionProgress) * startPosition.x + transitionProgress * controlPointX + (bounces > 0 ? Math.sin(bounces * Math.PI * 2) * 5 : 0);
    const translateY = (1 - transitionProgress) * startPosition.y + transitionProgress * controlPointY + (bounces > 0 ? Math.cos(bounces * Math.PI * 2) * 5 : 0);

    const finalX = controlPointX + (avatarCenter.x - controlPointX) * transitionProgress;
    const finalY = controlPointY + (avatarCenter.y - controlPointY) * transitionProgress;

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
    const [nicknameSize, setNicknameSize] = useState(16); // Initial size
    const [nicknameOpacity, setNicknameOpacity] = useState(1);

    useEffect(() => {
        const handleScroll = () => {
            setScrollPosition(window.scrollY);
            setIsFixedHeaderVisible(window.scrollY > triggerOffset);
        };

        const updateAvatarCenter = () => {
            const avatarRect = document.querySelector('.avatar-container')?.getBoundingClientRect();
            if (avatarRect) {
                setAvatarCenter({
                    x: avatarRect.left + avatarRect.width / 2,
                    y: avatarRect.top + avatarRect.height / 2,
                });
            }
        };

        window.addEventListener('scroll', handleScroll);
        window.addEventListener('resize', updateAvatarCenter);

        updateAvatarCenter();

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
    const avatarOpacity = (1 - transitionProgress);

    useEffect(() => {
        // Adjust nickname size and opacity
        const newNicknameSize = 16 * Math.max(0.3, (1 - transitionProgress)); // Minimum size
        setNicknameSize(newNicknameSize);

        const newNicknameOpacity = Math.max(0.3, (1 - transitionProgress)); // Ensure it's still somewhat visible
        setNicknameOpacity(newNicknameOpacity);


    }, [transitionProgress])


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

    const numIcons = 13;
    const floatingIcons = Array.from({ length: numIcons }, (_, index) => {
        const angle = Math.random() * 2 * Math.PI;
        const distance = 30 + Math.random() * 20; // Vary the distance

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
                className={`relative w-full h-24 bg-gray-100 flex flex-col items-center justify-center transition-all duration-300 ease-in-out overflow-hidden`} // flex-col and items-center for centering avatar and username
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
                        opacity: `${avatarOpacity}`,
                        marginBottom: '5px', // Add some space between avatar and username
                    }}
                    className="transition-all duration-300 ease-in-out avatar-container" // Add avatar-container class
                >
                    {/* Floating Sprinkled Icons */}
                    {floatingIcons.map((icon, index) => (
                        <FloatingIcon
                            key={icon.id}
                            startPosition={icon.startPosition}
                            avatarCenter={avatarCenter}
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
                    <div style={cameraCutoutStyle}></div> {/* THE Camera Cutout! */}
                </div>

                {/* Username Area */}
                <span style={{
                    fontSize: `${nicknameSize}px`,
                    opacity: nicknameOpacity,
                    transition: 'font-size 0.3s ease-in-out, opacity 0.3s ease-in-out'
                }} className=" transition-all duration-300 ease-in-out">{username}</span>
            </div>

            {/* Fixed header (Fixed Header) */}
            <div
                className={`fixed top-0 left-0 w-full h-16 bg-gray-800 text-white flex items-center p-4 transition-opacity duration-300`}
                style={{
                    opacity: isFixedHeaderVisible ? transitionProgress : 0,
                    pointerEvents: isFixedHeaderVisible ? 'auto' : 'none',
                    zIndex: 100, // Increased z-index for the fixed header
                }}
            >
                <VibeContentRenderer content="::FaUser className='mr-2'::" /> {/* Using VibeContentRenderer for User icon*/}
                <span className="text-sm font-semibold">{username}</span>
            </div>
        </div>
    );
}

export default AnimatedHeader
