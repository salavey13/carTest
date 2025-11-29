"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { FaMoon, FaSun, FaSpinner } from 'react-icons/fa6';
import { useAppContext } from '@/contexts/AppContext';
import { updateUserSettings } from '@/app/actions';
import { cn } from '@/lib/utils';
import { debugLogger as logger } from '@/lib/debugLogger';
import { toast } from 'sonner';

export function ThemeToggleButton({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { dbUser } = useAppContext();
  const { resolvedTheme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => setIsMounted(true), []);

  const handleToggle = useCallback(async () => {
    if (!isMounted) return;
    
    // 1. Определяем новую тему
    const currentTheme = resolvedTheme === 'dark' ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    // 2. МГНОВЕННО применяем визуально (Оптимистичный UI)
    setTheme(newTheme);
    
    // 3. Если есть юзер, сохраняем в фоне
    if (dbUser?.user_id) {
      setIsSaving(true);
      try {
        const currentMeta = dbUser.metadata || {};
        const currentSettings = (currentMeta.settings_profile || {}) as Record<string, any>;
        
        const updatedMetadata = {
          ...currentMeta,
          settings_profile: { 
            ...currentSettings, 
            dark_mode_enabled: newTheme === 'dark' 
          }
        };

        // Отправляем, но не блокируем интерфейс ожиданием (fire and forget, но со спиннером)
        const result = await updateUserSettings(dbUser.user_id, updatedMetadata);
        
        if (!result.success) {
           logger.error("Theme save failed:", result.error);
           // Не откатываем тему автоматически, чтобы не бесить юзера мерцанием.
           // Просто в следующий раз загрузится старая, если сейв не прошел.
           toast.error("Сбой сохранения темы в облако");
        }
      } catch (e) {
        logger.error("Theme toggle error:", e);
      } finally {
        setIsSaving(false);
      }
    }
  }, [resolvedTheme, dbUser, isMounted, setTheme]);

  if (!isMounted) {
    return <div className={cn("bg-muted/20 rounded-full animate-pulse", size === 'md' ? "w-9 h-9" : "w-8 h-8")} />;
  }
  
  const iconSizeClass = size === 'md' ? "h-5 w-5" : "h-4 w-4";
  // Используем resolvedTheme для надежности иконок
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={handleToggle}
      disabled={isSaving}
      className={cn(
        "relative flex items-center justify-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background",
        "hover:bg-accent text-foreground active:scale-90",
        size === 'md' ? "w-9 h-9" : "w-8 h-8"
      )}
      title={isDark ? "Включить светлую тему" : "Включить темную тему"}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isSaving ? 'saving' : (isDark ? 'dark' : 'light')}
          initial={{ y: -10, opacity: 0, rotate: -90 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: 10, opacity: 0, rotate: 90 }}
          transition={{ duration: 0.2 }}
          className="absolute"
        >
          {isSaving 
            ? <FaSpinner className={cn("animate-spin text-muted-foreground", iconSizeClass)} />
            : isDark 
              ? <FaMoon className={cn(iconSizeClass, "text-brand-purple")} /> 
              : <FaSun className={cn(iconSizeClass, "text-brand-orange")} />
          }
        </motion.span>
      </AnimatePresence>
    </button>
  );
}