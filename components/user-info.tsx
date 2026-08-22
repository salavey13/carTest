"use client";
import { useState, useEffect } from "react";
import { Bot, Send, ChevronDown, Moon, Sun, Settings } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useAppContext } from "@/contexts/AppContext";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { debugLogger as logger } from "@/lib/debugLogger";
import { Button } from "@/components/ui/button";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { useTheme } from "next-themes";

const TELEGRAM_WEB_APP_URL = "https://t.me/oneBikePlsBot/app";

// Исправление 1: Делаем именованный экспорт (убрано default)
export function UserInfo() {
  const { dbUser, user, isInTelegramContext, isLoading, error } = useAppContext();
  const { theme, setTheme } = useTheme();
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <Button
          asChild
          variant="ghost"
          className={cn(
            "rounded-full px-3 py-2 transition-all",
            "bg-gradient-to-br from-brand-purple/30 via-brand-pink/30 to-brand-orange/30",
            "hover:from-brand-purple/50 hover:via-brand-pink/50 hover:to-brand-orange/50",
            "text-light-text hover:text-white",
            "shadow-[0_0_10px_rgba(var(--brand-pink-rgb),0.4)] hover:shadow-[0_0_15px_rgba(var(--brand-pink-rgb),0.6)]",
          )}
        >
          <a href={TELEGRAM_WEB_APP_URL} target="_blank" rel="noopener noreferrer" aria-label="Открыть Telegram WebApp" className="inline-flex items-center gap-2">
            <Send className="h-5 w-5" />
            <span className="hidden text-xs font-semibold sm:inline">WebApp</span>
          </a>
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
            "rounded-full px-3 py-2 transition-all",
            "bg-gradient-to-br from-brand-purple/30 via-brand-pink/30 to-brand-orange/30",
            "hover:from-brand-purple/50 hover:via-brand-pink/50 hover:to-brand-orange/50",
            "text-light-text hover:text-white",
            "shadow-[0_0_10px_rgba(var(--brand-pink-rgb),0.4)] hover:shadow-[0_0_15px_rgba(var(--brand-pink-rgb),0.6)]"
        )}
      >
        <a href={TELEGRAM_WEB_APP_URL} target="_blank" rel="noopener noreferrer" aria-label="Открыть Telegram WebApp" className="inline-flex items-center gap-2">
          <Send className="h-5 w-5" />
          <span className="hidden text-xs font-semibold sm:inline">WebApp</span>
        </a>
      </Button>
    );
  }

  // Исправление 3: Безопасное чтение свойств через приведение типов (Any)
  const eUserAny = effectiveUser as any;
  const displayName = eUserAny.username || eUserAny.full_name || eUserAny.first_name || "Агент";
  const avatarUrl = dbUser?.avatar_url || user?.photo_url;
  const isMock = 'is_bot' in effectiveUser ? effectiveUser.is_bot : (eUserAny.id === 413553377 && process.env.NEXT_PUBLIC_USE_MOCK_USER === 'true');

  const handleThemeToggle = () => {
    setTheme(theme === "dark" ? "light" : "dark");
    setIsDropdownOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="relative flex items-center gap-2 p-1 rounded-full hover:bg-dark-card/70 transition-all duration-200 cursor-pointer group"
        aria-label={`Профиль пользователя ${displayName}`}
        aria-expanded={isDropdownOpen}
      >
        <div className="relative w-9 h-9 sm:w-10 sm:h-10">
          {avatarUrl ? (
            <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-brand-pink/80 shadow-[0_0_12px_rgba(var(--brand-pink-rgb),0.6)] group-hover:scale-105 group-hover:shadow-[0_0_18px_rgba(var(--brand-pink-rgb),0.7)] transition-all duration-300">
              {/* Исправление 2: Добавлен unoptimized */}
              <Image
                src={avatarUrl}
                alt={`Аватар ${displayName}`}
                fill
                style={{objectFit:"cover"}}
                className="rounded-full"
                unoptimized
              />
            </div>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-brand-purple via-brand-pink to-brand-orange rounded-full flex items-center justify-center text-white font-mono text-base sm:text-lg shadow-[0_0_15px_rgba(var(--brand-pink-rgb),0.6)] group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(var(--brand-pink-rgb),0.7)] transition-all duration-300">
              {getInitials(displayName)}
            </div>
          )}
          {isInTelegramContext && (
            <VibeContentRenderer content="::FaTelegram::" className="absolute -bottom-1 -right-1 h-5 w-5 text-[#2AABEE] bg-white rounded-full p-0.5 border border-dark-bg shadow-lg" />
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
                {char as React.ReactNode}
              </motion.span>
            ))
          ) : (
            displayName
          )}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isDropdownOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsDropdownOpen(false)}
            />

            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 z-50 w-56 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
            >
              {/* Theme Toggle */}
              <button
                onClick={handleThemeToggle}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
              >
                {theme === "dark" ? (
                  <Sun className="h-5 w-5 text-yellow-500" />
                ) : (
                  <Moon className="h-5 w-5 text-blue-500" />
                )}
                <span className="text-sm font-medium">
                  {theme === "dark" ? "Светлая тема" : "Темная тема"}
                </span>
              </button>

              {/* Settings Link */}
              <Link
                href="/settings"
                onClick={() => setIsDropdownOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left border-t border-border"
              >
                <Settings className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Настройки</span>
              </Link>

              {/* Profile Link */}
              <Link
                href="/profile"
                onClick={() => setIsDropdownOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left border-t border-border"
              >
                <VibeContentRenderer content="::FaCircleUser className='h-5 w-5 text-muted-foreground'::" />
                <span className="text-sm font-medium">Профиль агента</span>
              </Link>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function getInitials(name: string): string {
  if (!name || typeof name !== 'string') return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}