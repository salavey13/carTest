"use client";

import Link from "next/link";
import Image from "next/image";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import UserInfo from "@/components/user-info";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { FaTelegram } from "react-icons/fa6";

export default function BikeHeader() {
  return (
      <motion.header
        className={cn("fixed top-0 left-0 right-0 z-40 bg-black/80 border-b border-brand-orange/40 shadow-md backdrop-blur-md")}
        initial={{ y: -100 }} animate={{ y: 0 }} transition={{ type: "tween", duration: 0.3 }}
      >
        <div className="container mx-auto px-4 py-2.5 sm:py-3">
          <div className="flex items-center justify-between">
            <Link
              href="/vipbikerental"
              className={cn("text-2xl md:text-3xl font-orbitron font-bold uppercase tracking-wider", "transition-all duration-300 hover:brightness-125 flex items-center gap-3")}
            >
              <Image 
                src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250725_233953_793-f4d8a590-5d2c-4416-9969-c8f9a4627eb5.jpg" 
                alt="Vip Bike Rental Logo" 
                width={36} 
                height={36} 
                className="rounded-full border-2 border-brand-orange/50"
              />
              <div className="flex items-baseline">
                <span className="text-brand-orange glitch" data-text="VIP">VIP</span>
                <span className="gta-vibe-text-effect">BIKE</span>
              </div>
            </Link>
            <div className="flex items-center gap-1.5 md:gap-2">
                <ThemeToggleButton />
                <a href="https://t.me/oneBikePlsBot" target="_blank" rel="noopener noreferrer" title="Telegram Bot">
                    <button className="p-2 text-brand-cyan hover:text-brand-cyan/70 focus:outline-none focus:ring-2 focus:ring-brand-cyan focus:ring-offset-2 focus:ring-offset-black rounded-md transition-all duration-200 hover:bg-brand-cyan/10">
                        <FaTelegram className="h-5 w-5 sm:h-6 sm:w-6" />
                    </button>
                </a>
                <UserInfo />
            </div>
          </div>
        </div>
      </motion.header>
  );
}