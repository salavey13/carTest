"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { FaMoon, FaSun, FaSpinner } from 'react-icons/fa6';
import { useAppContext } from '@/contexts/AppContext';
import { saveThemePreference } from '@/app/actions'; // <-- ИСПОЛЬЗУЕМ НОВЫЙ ЭКШЕН
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { debugLogger as logger } from '@/lib/debugLogger';

export function ThemeToggleButton({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { dbUser } = useAppContext();
  const { resolvedTheme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => setIsMounted(true), []);

  const handleToggle = useCallback(async () => {
    if (isSaving) return;

    const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    
    // 1. Оптимистичное обновление UI
    setTheme(newTheme);

    // 2. Если нет пользователя, просто выходим
    if (!dbUser?.user_id) {
      logger.debug("[ThemeToggle] User not logged in, theme changed locally.");
      return;
    }

    // 3. Сохранение в БД
    setIsSaving(true);
    const result = await saveThemePreference(dbUser.user_id, newTheme);

    if (result.success) {
      toast.success(`Тема сохранена: ${newTheme === 'dark' ? 'Темная' : 'Светлая'}`);
    } else {
      toast.error("Ошибка сохранения темы");
      logger.error("[ThemeToggle] Failed to save theme setting", result.error);
      // Откатываем UI в случае ошибки
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    }
    setIsSaving(false);
  }, [resolvedTheme, dbUser, isSaving, setTheme]);

  if (!isMounted) {
    return <div className={cn("bg-muted/50 rounded-md animate-pulse", size === 'md' ? "w-9 h-9" : "w-8 h-8")} />;
  }
  
  const iconSizeClass = size === 'md' ? "h-5 w-5" : "h-4 w-4";

  return (
    <button
      onClick={handleToggle}
      disabled={isSaving}
      className={cn(
        "relative flex items-center justify-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background",
        "hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 active:scale-90",
        size === 'md' ? "w-9 h-9" : "w-8 h-8",
        "text-brand-yellow focus:ring-brand-yellow"
      )}
      aria-label="Переключить тему"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isSaving ? 'saving' : resolvedTheme}
          initial={{ y: -15, opacity: 0, rotate: -45 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: 15, opacity: 0, rotate: 45 }}
          transition={{ duration: 0.2, type: 'tween', ease: 'easeInOut' }}
          className="absolute"
        >
          {isSaving 
            ? <FaSpinner className={cn("animate-spin text-muted-foreground", iconSizeClass)} />
            : resolvedTheme === 'dark' 
              ? <FaMoon className={cn(iconSizeClass)} /> 
              : <FaSun className={cn(iconSizeClass, "text-brand-deep-indigo dark:text-brand-yellow")} />
          }
        </motion.span>
      </AnimatePresence>
    </button>
  );
}