"use client";

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { FaGithub } from 'react-icons/fa6';

// Re-define profile type here or import from a shared types file
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
    variants: any; // Or define specific variant type
}

export const CharacterDisplay: React.FC<CharacterDisplayProps> = ({
    githubProfile,
    characterImageUrl,
    characterAltText,
    variants
}) => {
    return (
        <motion.div
            variants={variants}
            className="flex-shrink-0 self-center sm:self-end"
            style={{ perspective: '500px' }} // Enable 3D perspective for hover effect
        >
            <motion.div
                whileHover={{ scale: 1.05, rotateY: 10 }} // Subtle 3D rotation on hover
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            >
                <Image
                    // Use GitHub avatar if found, otherwise default
                    src={githubProfile?.avatar_url || characterImageUrl}
                    alt={githubProfile?.login || characterAltText}
                    width={120}
                    height={120}
                    priority // Preload/prioritize this image
                    className="rounded-full drop-shadow-[0_0_12px_rgba(0,255,157,0.6)] border-2 border-cyan-400/50" // Added border
                    // Prevent Next.js optimizing external URL if it's from GitHub
                    unoptimized={!!githubProfile?.avatar_url}
                />
            </motion.div>
            {/* Optional link to GitHub profile */}
            {githubProfile && (
                <a
                    href={githubProfile.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-center justify-center text-xs text-cyan-400 hover:text-cyan-300 transition opacity-80 hover:opacity-100"
                    title={`GitHub: ${githubProfile.login}`}
                >
                    <FaGithub className="mr-1"/> {githubProfile.login}
                </a>
            )}
        </motion.div>
    );
};

CharacterDisplay.displayName = 'CharacterDisplay';