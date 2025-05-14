"use client";
import { useState, useEffect } from "react";
import { User, Bot, LogIn } from "lucide-react"; // AlertTriangle removed
import Image from "next/image";
import Link from "next/link";
import { useAppContext } from "@/contexts/AppContext";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { debugLogger as logger } from "@/lib/debugLogger";
import { Button } from "@/components/ui/button"; 
import { VibeContentRenderer } from "@/components/VibeContentRenderer"; // Added VibeContentRenderer

export default function UserInfo() {
  const { dbUser, user, isInTelegramContext, isLoading, error } = useAppContext();
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  useEffect(() => {
    if (!isLoading && (dbUser || user || error)) setIsFirstLoad(false);
  }, [isLoading, dbUser, user, error]);

  if (isLoading && isFirstLoad) { 
    return (
      <div className="w-11 h-11 bg-muted/50 rounded-full animate-pulse shadow-[0_0_15px_rgba(var(--brand-orange-rgb),0.3)]" />
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-1"
      >
        <div className="flex items-center gap-2 p-2 bg-destructive/80 text-destructive-foreground rounded-md border border-destructive shadow-lg animate-pulse">
            <VibeContentRenderer content="::FaTriangleExclamation::" className="h-5 w-5" />
            <span className="font-mono text-xs">Auth Error!</span>
        </div>
        <Button asChild variant="outline" size="sm" className="text-xs border-destructive/50 text-destructive-foreground/80 hover:bg-destructive/70 hover:text-destructive-foreground">
            <Link href="/profile">Войти/Регистрация</Link>
        </Button>
      </motion.div>
    );
  }

  const effectiveUser = dbUser || user;

  if (!effectiveUser) {
    return ( 
      <Button 
        asChild 
        variant="ghost" 
        className={cn(
            "p-2 rounded-full transition-all",
            "bg-gradient-to-br from-brand-purple/30 via-brand-pink/30 to-brand-orange/30",
            "hover:from-brand-purple/50 hover:via-brand-pink/50 hover:to-brand-orange/50",
            "text-light-text hover:text-white",
            "shadow-[0_0_10px_rgba(var(--brand-pink-rgb),0.4)] hover:shadow-[0_0_15px_rgba(var(--brand-pink-rgb),0.6)]"
        )}
        >
        <Link href="/profile" aria-label="Профиль пользователя">
          <User className="h-6 w-6" />
        </Link>
      </Button>
    );
  }

  const displayName = effectiveUser.username || effectiveUser.full_name || effectiveUser.first_name || "Агент";
  const avatarUrl = dbUser?.avatar_url || user?.photo_url;
  const isMock = 'is_bot' in effectiveUser ? effectiveUser.is_bot : (effectiveUser.id === 413553377 && process.env.NEXT_PUBLIC_USE_MOCK_USER === 'true');

  return (
    <Link href="/profile" passHref legacyBehavior>
      <motion.a 
        className="relative flex items-center gap-2 p-1 rounded-full hover:bg-dark-card/70 transition-all duration-200 cursor-pointer group"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        aria-label={`Профиль пользователя ${displayName}`}
      >
        <div
          className="relative w-9 h-9 sm:w-10 sm:h-10"
        >
          {avatarUrl ? (
            <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-brand-pink/80 shadow-[0_0_12px_rgba(var(--brand-pink-rgb),0.6)] group-hover:scale-105 group-hover:shadow-[0_0_18px_rgba(var(--brand-pink-rgb),0.7)] transition-all duration-300">
              <Image
                src={avatarUrl}
                alt={`Аватар ${displayName}`}
                fill
                style={{objectFit:"cover"}} 
                className="rounded-full" 
              />
            </div>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-brand-purple via-brand-pink to-brand-orange rounded-full flex items-center justify-center text-white font-mono text-base sm:text-lg shadow-[0_0_15px_rgba(var(--brand-pink-rgb),0.6)] group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(var(--brand-pink-rgb),0.7)] transition-all duration-300">
              {getInitials(displayName)}
            </div>
          )}
          {isInTelegramContext && (
            <span className="absolute -top-0.5 -right-0.5 bg-brand-blue text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-md border-2 border-dark-bg">TG</span>
          )}
          {isMock && (
            <Bot className="absolute -bottom-1 -right-1 h-4 w-4 text-brand-yellow shadow-[0_0_8px_rgba(var(--brand-yellow-rgb),0.7)] bg-dark-bg/50 p-0.5 rounded-full" />
          )}
        </div>

        <span className={cn(
            "hidden md:block text-light-text font-mono text-sm truncate max-w-[120px]",
            "text-shadow-cyber group-hover:text-shadow-neon transition-all duration-300" 
        )}>
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