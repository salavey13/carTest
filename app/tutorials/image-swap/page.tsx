"use client";

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import ScrollControlledVideoPlayer from '@/components/ScrollControlledVideoPlayer';
import VibeContentRenderer from '@/components/VibeContentRenderer';

const tutorialVideos = [
  {
    id: 1,
    title: "Step 1: Snag the Old Image URL",
    description: "Your first task, Agent: locate the image you want to replace within the codebase. Once found, copy its full URL. This is your primary target!",
    src: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//1_copy_image_link.mp4",
    icon: "FaCopy",
    color: "brand-pink"
  },
  {
    id: 2,
    title: "Step 2: Deploy Your New Asset",
    description: "Next up, upload your shiny new replacement image. We recommend Supabase Storage for seamless integration, but any publicly accessible URL will do. Secure that new link!",
    src: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//2_upload_new_image.mp4",
    icon: "FaUpload",
    color: "brand-blue"
  },
  {
    id: 3,
    title: "Step 3: Unleash the VIBE Swap!",
    description: "Time for the magic. Head to the SUPERVIBE Studio. Input the old image URL, then the new one. Our AI operative will handle the code modifications and prepare the swap.",
    src: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//3_sitback_and_relax_its_swappin.mp4",
    icon: "FaWandMagicSparkles",
    color: "brand-purple"
  },
  {
    id: 4,
    title: "Step 4: Operation Success! Review PR",
    description: "Mission complete! A Pull Request is automatically generated with the image swap. All that's left is to review, merge, and admire your handiwork. Profit!",
    src: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//4_profit_check.mp4",
    icon: "FaCheckDouble",
    color: "brand-green"
  }
];

const colorClasses: Record<string, { text: string; border: string; shadow: string }> = {
  "brand-pink": { text: "text-brand-pink", border: "border-brand-pink/50", shadow: "shadow-brand-pink/40" },
  "brand-blue": { text: "text-brand-blue", border: "border-brand-blue/50", shadow: "shadow-brand-blue/40" },
  "brand-purple": { text: "text-brand-purple", border: "border-brand-purple/50", shadow: "shadow-brand-purple/40" },
  "brand-green": { text: "text-brand-green", border: "border-brand-green/50", shadow: "shadow-brand-green/40" },
};


export default function ImageSwapTutorialPage() {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-gray-200 pt-24 pb-20 overflow-x-hidden">
      {/* Background Grid */}
      <div
        className="absolute inset-0 bg-repeat opacity-5 -z-10"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(0, 255, 157, 0.1) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(0, 255, 157, 0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      ></div>

      <div className="container mx-auto px-4">
        <header className="text-center mb-12 md:mb-20">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-orbitron font-bold text-brand-green cyber-text glitch mb-4" data-text="Image Swap Initiation">
            Image Swap Initiation
          </h1>
          <p className="text-md sm:text-lg md:text-xl text-gray-300 font-mono max-w-3xl mx-auto">
            <VibeContentRenderer content="Welcome, Agent! Your mission: master image replacement. Think GTA ambulance runs ::FaCarCrash:: -> ::FaTools:: -> ::FaSmileBeam::, but for code! No accounts, just instant skill-ups." />
          </p>
        </header>

        <div className="space-y-16 md:space-y-24">
          {tutorialVideos.map((video, index) => {
            const stepColor = colorClasses[video.color] || colorClasses["brand-purple"];
            return (
              <section key={video.id} className={cn(index > 0 && "border-t border-gray-700/50 pt-12 md:pt-16")}>
                <div className={cn(
                  "flex flex-col gap-6 md:gap-10",
                  index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                )}>
                  <div className="md:w-2/5 lg:w-1/3 space-y-4 flex flex-col items-start justify-center">
                    <h2 className={cn("text-3xl md:text-4xl font-orbitron flex items-center gap-3", stepColor.text)}>
                      <VibeContentRenderer content={`::${video.icon}::`} className="text-3xl opacity-90" />
                      {video.title}
                    </h2>
                    <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                      {video.description}
                    </p>
                    {video.id === 3 && (
                      <Link href="/repo-xml?flow=imageSwap" className={cn(
                        "inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-black transition-colors shadow-lg mt-4",
                        "bg-brand-yellow hover:bg-brand-yellow/80 hover:shadow-yellow-glow/50"
                        )}>
                        Go to SUPERVIBE Studio <VibeContentRenderer content="::FaExternalLinkAlt::" className="ml-2" />
                      </Link>
                    )}
                  </div>

                  <div className="md:w-3/5 lg:w-2/3">
                    <div className={cn("rounded-xl overflow-hidden border-2 shadow-2xl", stepColor.border, stepColor.shadow, "bg-black")}>
                      <div className="aspect-video">
                        <ScrollControlledVideoPlayer 
                          src={video.src}
                          className="w-full h-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <section className="mt-20 md:mt-32 text-center border-t border-brand-green/40 pt-12 md:pt-16">
          <h2 className="text-3xl md:text-4xl font-orbitron text-brand-green mb-6">
             <VibeContentRenderer content="::FaPlayCircle:: Next Level Unlocked!" />
          </h2>
          <p className="text-lg md:text-xl text-gray-300 font-mono max-w-2xl mx-auto mb-8">
            You've got the basics, Agent! Ready to apply these skills for real? 
            The <Link href="/repo-xml" className="text-brand-blue hover:underline font-semibold">SUPERVIBE Studio</Link> awaits your command.
          </p>
          <Link href="/repo-xml?flow=imageSwap" className={cn(
             "inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-semibold rounded-full text-black transition-transform transform hover:scale-105",
             "bg-brand-green hover:bg-brand-green/80 shadow-xl hover:shadow-green-glow/60"
             )}>
            <VibeContentRenderer content="::FaWandMagicSparkles::" className="mr-3 text-xl" /> Try It Live in Studio
          </Link>
        </section>

      </div>
    </div>
  );
}