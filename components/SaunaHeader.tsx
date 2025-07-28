"use client";

import Link from "next/link";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import UserInfo from "@/components/user-info";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function SaunaHeader() {
  return (
      <motion.header
        className={cn("fixed top-0 left-0 right-0 z-40 bg-slate-900/80 border-b border-amber-800/40 shadow-md backdrop-blur-md")}
        initial={{ y: -100 }} animate={{ y: 0 }} transition={{ type: "tween", duration: 0.3 }}
      >
        <div className="container mx-auto px-4 py-2.5 sm:py-3">
          <div className="flex items-center justify-between">
            <Link
              href="/sauna-rent"
              className={cn("text-2xl md:text-3xl font-sans font-bold tracking-wider", "transition-all duration-300 hover:brightness-125 flex items-center gap-3 text-amber-100")}
            >
              <VibeContentRenderer content="::FaHotTubPerson::" className="text-amber-400" />
              LÖYLY VIBE
            </Link>
            <div className="flex items-center gap-1.5 md:gap-2">
                <ThemeToggleButton />
                <UserInfo />
            </div>
          </div>
        </div>
      </motion.header>
  );
}