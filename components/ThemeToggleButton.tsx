"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaMoon, FaSun } from 'react-icons/fa6';
import { useAppContext } from '@/contexts/AppContext';
import { updateUserSettings } from '@/app/actions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { debugLogger as logger } from '@/lib/debugLogger';

export function ThemeToggleButton() {
  const { dbUser, isLoading: isAppContextLoading } = useAppContext();
  
  // Default to dark mode if no user or setting is found
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (!isAppContextLoading && dbUser?.metadata?.settings_profile) {
      const userPrefersDark = dbUser.metadata.settings_profile.dark_mode_enabled;
      // Check if it's explicitly defined, otherwise default to true
      const newIsDarkMode = typeof userPrefersDark === 'boolean' ? userPrefersDark : true;
      setIsDarkMode(newIsDarkMode);
    } else if (!isAppContextLoading && !dbUser) {
      // For logged-out users, check local storage or default to dark
      const savedTheme = localStorage.getItem('theme');
      setIsDarkMode(savedTheme ? savedTheme === 'dark' : true);
    }
  }, [dbUser, isAppContextLoading]);

  useEffect(() => {
    if (isMounted) {
      document.documentElement.classList.toggle('dark', isDarkMode);
      // For logged-out users, persist choice in local storage
      if (!dbUser) {
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
      }
    }
  }, [isDarkMode, isMounted, dbUser]);

  const handleToggleTheme = useCallback(async () => {
    const newIsDarkMode = !isDarkMode;
    setIsDarkMode(newIsDarkMode);

    if (!dbUser?.user_id) {
      logger.debug("[ThemeToggle] User not logged in, saving theme to localStorage.");
      return;
    }

    logger.debug(`[ThemeToggle] Toggling theme for user ${dbUser.user_id} to ${newIsDarkMode ? 'dark' : 'light'}`);

    try {
      const currentMetadata = dbUser.metadata || {};
      const currentSettings = (currentMetadata.settings_profile || {}) as Record<string, any>;
      
      const newSettingsProfile = {
        ...currentSettings,
        dark_mode_enabled: newIsDarkMode,
      };

      const newMetadata = {
        ...currentMetadata,
        settings_profile: newSettingsProfile,
      };
      
      const result = await updateUserSettings(dbUser.user_id, newMetadata);

      if (result.success) {
        toast.success(`Тема изменена на ${newIsDarkMode ? 'темную' : 'светлую'}`);
      } else {
        toast.error("Ошибка сохранения темы");
        logger.error("[ThemeToggle] Failed to save theme setting", result.error);
        // Revert UI on failure
        setIsDarkMode(!newIsDarkMode);
      }
    } catch (error) {
      toast.error("Критическая ошибка при смене темы");
      logger.error("[ThemeToggle] Critical error on theme toggle", error);
      // Revert UI on failure
      setIsDarkMode(!newIsDarkMode);
    }
  }, [isDarkMode, dbUser]);

  if (!isMounted) {
    return (
      <div className="p-2 w-[34px] h-[34px] sm:w-[36px] sm:h-[36px] bg-black/10 rounded-md animate-pulse" />
    );
  }

  return (
    <button
      onClick={handleToggleTheme}
      className={cn(
        "p-1.5 sm:p-2 relative flex items-center justify-center rounded-md transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-offset-2 focus:ring-offset-black",
        "w-[34px] h-[34px] sm:w-[36px] sm:h-[36px]",
        "text-brand-yellow hover:bg-brand-yellow/10 focus:ring-brand-yellow"
      )}
      aria-label="Toggle dark mode"
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={isDarkMode ? 'moon' : 'sun'}
          initial={{ y: -20, opacity: 0, scale: 0.5, rotate: -90 }}
          animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
          exit={{ y: 20, opacity: 0, scale: 0.5, rotate: 90 }}
          transition={{ duration: 0.25, type: 'tween', ease: 'easeInOut' }}
          className="absolute"
        >
          {isDarkMode ? <FaMoon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" /> : <FaSun className="h-4 w-4 sm:h-5 sm:w-5" />}
        </motion.div>
      </AnimatePresence>
    </button>
  );
}