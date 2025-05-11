"use client";
import { useState, useEffect } from "react";
import { User, Bot, Trophy, Car, Lock } from "lucide-react"; 
import Image from "next/image";
import Link from "next/link"; // Import Link
import { useAppContext } from "@/contexts/AppContext";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { debugLogger as logger } from "@/lib/debugLogger";

export default function UserInfo() {
  const { dbUser, user, isInTelegramContext, isLoading, error } = useAppContext();
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  // const [isModalOpen, setIsModalOpen] = useState(false); // Modal logic can be removed or kept for future use

  useEffect(() => {
    if (!isLoading && (dbUser || user)) setIsFirstLoad(false);
  }, [isLoading, dbUser, user]);

  if (isLoading) {
    return (
      <div className="w-11 h-11 bg-muted rounded-full animate-pulse shadow-[0_0_15px_rgba(var(--brand-orange-rgb),0.3)]" />
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-destructive font-mono text-sm animate-[neon_2s_infinite]"
      >
        Auth Error!
      </motion.div>
    );
  }

  const effectiveUser = dbUser || user; // Prefer dbUser if available

  if (!effectiveUser) {
    return ( // Render as a button if no user, linking to /profile (which might handle auth redirect or guest view)
      <Button asChild variant="ghost" className="p-2 rounded-full text-primary hover:text-primary/80 bg-muted/20 hover:bg-muted/40 transition-all shadow-[0_0_10px_rgba(var(--brand-orange-rgb),0.3)]">
        <Link href="/profile" aria-label="Профиль пользователя">
          <User className="h-6 w-6" />
        </Link>
      </Button>
    );
  }

  const displayName = effectiveUser.username || effectiveUser.full_name || effectiveUser.first_name || "Агент";
  const avatarUrl = dbUser?.avatar_url || user?.photo_url; // dbUser might have a custom avatar
  const isMock = 'is_bot' in effectiveUser ? effectiveUser.is_bot : (effectiveUser.id === 413553377 && process.env.NEXT_PUBLIC_USE_MOCK_USER === 'true');


  return (
    <Link href="/profile" passHref legacyBehavior>
      <motion.a // Changed to motion.a for Link compatibility
        className="relative flex items-center gap-2 p-1 rounded-full hover:bg-gray-800/50 transition-all duration-200 cursor-pointer"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        aria-label={`Профиль пользователя ${displayName}`}
      >
        <div
          className="relative group w-9 h-9 sm:w-10 sm:h-10"
          // onClick={() => setIsModalOpen(true)} // Removed direct modal open, link handles navigation
        >
          {avatarUrl ? (
            <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-primary shadow-[0_0_12px_rgba(var(--brand-orange-rgb),0.5)] group-hover:scale-105 transition-transform duration-300">
              <Image
                src={avatarUrl}
                alt={`Аватар ${displayName}`}
                layout="fill"
                objectFit="cover" 
                className="rounded-full" 
              />
            </div>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center text-primary-foreground font-mono text-base sm:text-lg shadow-[0_0_15px_rgba(var(--brand-orange-rgb),0.5)] group-hover:scale-105 transition-transform duration-300">
              {getInitials(displayName)}
            </div>
          )}
          {isInTelegramContext && (
            <span className="absolute -top-0.5 -right-0.5 bg-accent text-accent-foreground text-[9px] px-1 rounded-full shadow-sm">TG</span>
          )}
          {isMock && (
            <Bot className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 text-accent shadow-[0_0_6px_rgba(var(--brand-yellow-rgb),0.5)]" />
          )}
        </div>

        <span className="hidden md:block text-primary font-mono text-sm truncate max-w-[120px] text-glow">
          {isFirstLoad ? (
            Array.from(displayName).map((char, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                {char}
              </motion.span>
            ))
          ) : (
            displayName
          )}
        </span>
      </motion.a>
    </Link>
  );
};

function getInitials(name: string): string {
  if (!name || typeof name !== 'string') return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}