"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { FaMoon, FaSun, FaSpinner } from 'react-icons/fa6';
import { useAppContext } from '@/contexts/AppContext';
import { updateUserSettings } from '@/app/actions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { debugLogger as logger } from '@/lib/debugLogger';

export function ThemeToggleButton({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { dbUser } = useAppContext();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => setIsMounted(true), []);

  // Initial Sync from DB (One-off)
  useEffect(() => {
    if (isMounted && dbUser?.metadata?.settings_profile) {
      const settings = dbUser.metadata.settings_profile as Record<string, any>;
      const dbDark = settings.dark_mode_enabled;
      if (typeof dbDark === 'boolean') {
        // If DB says dark but theme is light, force dark
        if (dbDark && resolvedTheme !== 'dark') setTheme('dark');
        // If DB says light but theme is dark, force light
        if (!dbDark && resolvedTheme === 'dark') setTheme('light');
      }
    }
  // Run this logic primarily when dbUser loads
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbUser?.user_id, isMounted]); 

  const handleToggle = useCallback(async () => {
    if (isSaving || !isMounted) return;

    const currentTheme = resolvedTheme;
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    // 1. Immediate UI feedback
    setTheme(nextTheme);

    // 2. Persist if user logged in
    if (dbUser?.user_id) {
      setIsSaving(true);
      try {
        const currentMeta = dbUser.metadata || {};
        const currentSettings = (currentMeta.settings_profile || {}) as Record<string, any>;
        
        const updatedMetadata = {
          ...currentMeta,
          settings_profile: { ...currentSettings, dark_mode_enabled: nextTheme === 'dark' }
        };

        // We just fire and forget the DB update toast unless error
        const result = await updateUserSettings(dbUser.user_id, updatedMetadata);
        if(!result.success) {
           console.error("Theme save failed:", result.error);
           // Optional: toast.error("Failed to save theme preference");
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsSaving(false);
      }
    }
  }, [resolvedTheme, dbUser, isSaving, setTheme, isMounted]);

  if (!isMounted) {
    return <div className={cn("bg-muted/20 rounded-full", size === 'md' ? "w-9 h-9" : "w-8 h-8")} />;
  }
  
  const iconSizeClass = size === 'md' ? "h-5 w-5" : "h-4 w-4";

  return (
    <button
      onClick={handleToggle}
      disabled={isSaving}
      className={cn(
        "relative flex items-center justify-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background",
        "hover:bg-accent text-foreground active:scale-90",
        size === 'md' ? "w-9 h-9" : "w-8 h-8"
      )}
      title={`Тема: ${resolvedTheme === 'dark' ? 'Темная' : 'Светлая'}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isSaving ? 'saving' : resolvedTheme}
          initial={{ y: -10, opacity: 0, rotate: -90 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: 10, opacity: 0, rotate: 90 }}
          transition={{ duration: 0.2 }}
          className="absolute"
        >
          {isSaving 
            ? <FaSpinner className={cn("animate-spin text-muted-foreground", iconSizeClass)} />
            : resolvedTheme === 'dark' 
              ? <FaMoon className={cn(iconSizeClass, "text-brand-purple")} /> 
              : <FaSun className={cn(iconSizeClass, "text-brand-orange")} />
          }
        </motion.span>
      </AnimatePresence>
    </button>
  );
}