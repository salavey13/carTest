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

  // Prevent hydration mismatch
  useEffect(() => setIsMounted(true), []);

  // Sync DB setting to local theme on load (one-way sync from DB)
  useEffect(() => {
    if (dbUser?.metadata?.settings_profile) {
      const dbSettings = dbUser.metadata.settings_profile as Record<string, any>;
      const dbWantsDark = dbSettings.dark_mode_enabled;
      
      // Only sync if explicit preference exists and differs from current
      if (typeof dbWantsDark === 'boolean') {
        const currentIsDark = resolvedTheme === 'dark';
        if (dbWantsDark !== currentIsDark) {
           logger.debug(`[ThemeToggle] Syncing theme from DB: ${dbWantsDark ? 'dark' : 'light'}`);
           setTheme(dbWantsDark ? 'dark' : 'light');
        }
      }
    }
  }, [dbUser, resolvedTheme, setTheme]);

  const handleToggle = useCallback(async () => {
    if (isSaving || !isMounted) return;

    const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    
    // 1. UI Update
    setTheme(newTheme);

    // 2. Save to DB
    if (dbUser?.user_id) {
      setIsSaving(true);
      try {
        const currentMetadata = dbUser.metadata || {};
        const currentSettings = (currentMetadata.settings_profile || {}) as Record<string, any>;
        const updatedMetadata = {
           ...currentMetadata, 
           settings_profile: { ...currentSettings, dark_mode_enabled: newTheme === 'dark' }
        };

        // We don't await the toast to make UI snappy, but we await the action
        await updateUserSettings(dbUser.user_id, updatedMetadata);
        logger.debug(`[ThemeToggle] Saved theme preference: ${newTheme}`);
      } catch (e) {
        logger.error("[ThemeToggle] Failed to save:", e);
        toast.error("Сбой сохранения темы");
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
      aria-label={resolvedTheme === 'dark' ? "Включить светлую тему" : "Включить темную тему"}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isSaving ? 'loading' : resolvedTheme}
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