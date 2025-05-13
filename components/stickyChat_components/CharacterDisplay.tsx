"use client";

import React, { useState, useEffect } from 'react'; // Import useState, useEffect
import { motion } from 'framer-motion';
import Image from 'next/image';
import { FaGithub } from 'react-icons/fa6';

interface GitHubProfile {
    login: string;
    avatar_url: string;
    html_url: string;
    name?: string | null;
}

interface CharacterDisplayProps {
    githubProfile: GitHubProfile | null;
    characterImageUrl: string;
    characterAltText: string;
    variants: any;
}

export const CharacterDisplay: React.FC<CharacterDisplayProps> = ({
    githubProfile,
    characterImageUrl,
    characterAltText,
    variants
}) => {
    const [profileJustLoaded, setProfileJustLoaded] = useState(false);

    // Effect to detect when profile loads *after* initial render
    useEffect(() => {
        if (githubProfile) {
            // Trigger animation only once when it loads
            const timer = setTimeout(() => setProfileJustLoaded(true), 100); // Short delay ensures it's post-load
            const clearTimer = setTimeout(() => setProfileJustLoaded(false), 1100); // Animation duration + buffer
            return () => {
                clearTimeout(timer);
                clearTimeout(clearTimer);
            }
        }
    }, [githubProfile]); // Run only when githubProfile changes

    const imageSrc = githubProfile?.avatar_url || characterImageUrl;
    const imageAlt = githubProfile?.login || characterAltText;

    return (
        <motion.div
            variants={variants}
            className="flex-shrink-0 self-center sm:self-end"
            style={{ perspective: '500px' }}
        >
            {/* Image container with conditional pulse & ensured rounded-full */}
            <motion.div
                whileHover={{ scale: 1.05, rotateY: 10 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                animate={profileJustLoaded ? {
                    scale: [1, 1.1, 1],
                    boxShadow: ["0 0 12px hsl(var(--brand-green)/0.6)", "0 0 25px hsl(var(--brand-green)/0.9)", "0 0 12px hsl(var(--brand-green)/0.6)"] // Use theme color
                } : {}}
                initial={{ scale: 1, boxShadow: "0 0 12px hsl(var(--brand-green)/0.6)" }} // Use theme color
                // Apply rounded-full directly here to ensure the container crops the glow
                className="rounded-full"
            >
                <Image
                    key={imageSrc}
                    src={imageSrc}
                    alt={imageAlt}
                    width={120}
                    height={120}
                    priority
                    // Ensure image itself is rounded, use theme color for border
                    className="rounded-full drop-shadow-[0_0_12px_hsl(var(--brand-green)/0.6)] border-2 border-brand-cyan/50"
                    unoptimized={!!githubProfile?.avatar_url}
                />
            </motion.div>
            {/* GitHub Link */}
            {githubProfile && (
                <motion.a
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    href={githubProfile.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-center justify-center text-xs text-brand-cyan hover:text-brand-cyan/80 transition opacity-80 hover:opacity-100" // Use theme color
                    title={`GitHub: ${githubProfile.login}`}
                >
                    <FaGithub className="mr-1"/> {githubProfile.login}
                </motion.a>
            )}
        </motion.div>
    );
};

CharacterDisplay.displayName = 'CharacterDisplay';