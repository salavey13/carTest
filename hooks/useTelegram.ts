"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { debugLogger } from "@/lib/debugLogger";
import { logger } from "@/lib/logger"; // Use standard logger
// Import specific DB functions needed, ensure they use admin client correctly ONLY during init/mock setup phase
import { createOrUpdateUser as dbCreateOrUpdateUser, fetchUserData as dbFetchUserData } from "@/hooks/supabase";
import type { TelegramWebApp, WebAppUser } from "@/types/telegram";
import type { Database } from "@/types/database.types";
// import { toast } from "sonner"; // Toasts are now handled in AppContext

type DatabaseUser = Database["public"]["Tables"]["users"]["Row"] | null;

// Define a more realistic mock user or allow configuration via env vars for dev
const MOCK_USER: WebAppUser | null = process.env.NEXT_PUBLIC_USE_MOCK_USER === 'true' ? {
  id: parseInt(process.env.NEXT_PUBLIC_MOCK_USER_ID || "413553377"),
  first_name: process.env.NEXT_PUBLIC_MOCK_USER_FIRST_NAME || "Mock",
  last_name: process.env.NEXT_PUBLIC_MOCK_USER_LAST_NAME || "User",
  username: process.env.NEXT_PUBLIC_MOCK_USER_USERNAME || "mockuser",
  language_code: process.env.NEXT_PUBLIC_MOCK_USER_LANG || "ru",
  photo_url: process.env.NEXT_PUBLIC_MOCK_USER_PHOTO || "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions//pooh.png",
  // Add other fields if needed by your app logic during mock auth
} : null;

if (MOCK_USER) {
    logger.warn("Using mock Telegram user for development. Ensure NEXT_PUBLIC_USE_MOCK_USER is 'false' or unset in production.");
    // debugLogger.log("Mock User Details:", MOCK_USER); // Logged from AppContext if needed
}

export function useTelegram() {
  const [tgWebApp, setTgWebApp] = useState<TelegramWebApp | null>(null);
  const [tgUser, setTgUser] = useState<WebAppUser | null>(null); // Raw Telegram user
  const [dbUser, setDbUser] = useState<DatabaseUser>(null); // User data from your DB
  const [isInTelegramContext, setIsInTelegramContext] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Derived state

  // --- Authentication Logic ---
  const handleAuthentication = useCallback(
    async (telegramUser: WebAppUser): Promise<DatabaseUser> => {
      debugLogger.log("handleAuthentication started for:", telegramUser.id);
      setError(null); // Clear previous errors

      if (!telegramUser?.id) {
         throw new Error("Invalid Telegram user data received.");
      }
      const userIdStr = telegramUser.id.toString();

      try {
         let userFromDb = await dbFetchUserData(userIdStr);

         if (!userFromDb) {
            debugLogger.log(`User ${userIdStr} not found in DB, creating...`);
            userFromDb = await dbCreateOrUpdateUser(userIdStr, telegramUser);
             if (!userFromDb) {
                 throw new Error(`Failed to create user ${userIdStr} in database.`);
             }
             logger.info(`New user ${userIdStr} (${telegramUser.username || ''}) created.`);
         } else {
            debugLogger.log(`User ${userIdStr} found in DB. Checking for updates...`);
            const needsUpdate = (
                userFromDb.username !== telegramUser.username ||
                userFromDb.full_name !== `${telegramUser.first_name || ""} ${telegramUser.last_name || ""}`.trim() ||
                userFromDb.avatar_url !== telegramUser.photo_url
            );
            if(needsUpdate) {
                debugLogger.log(`User ${userIdStr} data differs, updating...`);
                userFromDb = await dbCreateOrUpdateUser(userIdStr, telegramUser);
                 if (!userFromDb) {
                     throw new Error(`Failed to update user ${userIdStr} in database.`);
                 }
                 logger.info(`User ${userIdStr} (${telegramUser.username || ''}) updated.`);
            } else {
                 debugLogger.log(`User ${userIdStr} data is up-to-date.`);
            }
         }

         debugLogger.log(`Authentication successful for user ${userIdStr}`);
         setTgUser(telegramUser); 
         setDbUser(userFromDb); 
         setIsAuthenticated(true); 
         return userFromDb;

      } catch (err) {
         logger.error(`Authentication failed for user ${telegramUser.id}:`, err);
         const authError = err instanceof Error ? err : new Error("Authentication failed due to an unknown error.");
         setError(authError);
         setIsAuthenticated(false);
         setDbUser(null); 
         throw authError; 
      }
    },
    [] 
  );

  // --- Initialization Effect ---
  useEffect(() => {
    let isMounted = true;
    debugLogger.log("useTelegram effect running, isMounted:", isMounted);

    const initialize = async () => {
      debugLogger.log("initialize function started");
      if (!isMounted) {
          debugLogger.log("initialize aborted: component unmounted");
          return;
      }

      setIsLoading(true);
      setError(null);
      setIsAuthenticated(false);
      setDbUser(null);
      setTgUser(null);
      setIsInTelegramContext(false); // Default to false

      if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
        const telegram = (window as any).Telegram.WebApp;
        debugLogger.log("Telegram WebApp context detected", telegram.initData ? 'with initData' : 'without initData');

        if (telegram.initDataUnsafe?.user) {
          setTgWebApp(telegram);
          setIsInTelegramContext(true); // Truly in TG context
          telegram.ready(); 
          try {
            await handleAuthentication(telegram.initDataUnsafe.user);
          } catch (authError) {
             debugLogger.error("Authentication failed within Telegram context:", authError);
          } finally {
             if (isMounted) setIsLoading(false);
          }
        } else {
           debugLogger.log("Telegram context found, but no user data in initDataUnsafe.");
           if (MOCK_USER && isMounted) {
               logger.warn("No user data in Telegram context, falling back to MOCK_USER.");
               setIsInTelegramContext(false); // Using mock, so not in real TG context
               try {
                   await handleAuthentication(MOCK_USER);
               } catch (mockAuthError) {
                  debugLogger.error("Failed to authenticate MOCK_USER:", mockAuthError);
               } finally {
                  if (isMounted) setIsLoading(false);
               }
           } else if (isMounted) {
               setError(new Error("Telegram context detected, but user data is missing."));
               setIsLoading(false);
           }
        }
      } else {
        debugLogger.log("Not running inside Telegram WebApp context.");
        setIsInTelegramContext(false); // Explicitly false
        if (MOCK_USER && isMounted) {
           logger.warn("Not in Telegram context, using MOCK_USER.");
           try {
               await handleAuthentication(MOCK_USER);
           } catch (mockAuthError) {
               debugLogger.error("Failed to authenticate MOCK_USER:", mockAuthError);
           } finally {
              if (isMounted) setIsLoading(false);
           }
        } else if (isMounted) {
           setError(new Error("Application must be run inside Telegram or have mock user enabled."));
           setIsLoading(false);
        }
      }
    };

    initialize();

    return () => {
      debugLogger.log("useTelegram effect cleanup, setting isMounted=false");
      isMounted = false;
    };
  }, [handleAuthentication]); 

  const isAdmin = useCallback(() => {
    if (!dbUser) return false;
    return dbUser.status === "admin" || dbUser.role === "vprAdmin";
  }, [dbUser]);


  const safeWebAppCall = useCallback(
    <T extends (...args: any[]) => any>(methodName: keyof TelegramWebApp, ...args: Parameters<T>): ReturnType<T> | undefined => {
        if (tgWebApp && typeof tgWebApp[methodName] === 'function') {
            try {
                 debugLogger.log(`Calling tgWebApp.${String(methodName)} with args:`, args);
                return (tgWebApp[methodName] as T)(...args);
            } catch (callError) {
                 logger.error(`Error calling tgWebApp.${String(methodName)}:`, callError);
                 // Toast handled in AppContext or component
                 return undefined;
            }
        } else {
            logger.warn(`Attempted to call tgWebApp.${String(methodName)} but WebApp context is not available or method is not a function.`);
            return undefined;
        }
    }, [tgWebApp] 
  );

  return useMemo(() => {
    const baseData = {
        tg: tgWebApp, 
        user: tgUser,
        dbUser,
        isInTelegramContext,
        isAuthenticated,
        isAdmin, 
        isLoading,
        error,
        openLink: (url: string) => safeWebAppCall('openLink', url),
        close: () => safeWebAppCall('close'),
        showPopup: (params: any) => safeWebAppCall('showPopup', params), 
        sendData: (data: string) => safeWebAppCall('sendData', data),
        getInitData: () => tgWebApp?.initDataUnsafe ?? null, 
        expand: () => safeWebAppCall('expand'),
        setHeaderColor: (color: string) => safeWebAppCall('setHeaderColor', color),
        setBackgroundColor: (color: string) => safeWebAppCall('setBackgroundColor', color),
        // Defaulting other fields as per their types
        platform: tgWebApp?.platform ?? 'unknown',
        themeParams: tgWebApp?.themeParams ?? { bg_color: '#000000', text_color: '#ffffff', hint_color: '#888888', link_color: '#007aff', button_color: '#007aff', button_text_color: '#ffffff', secondary_bg_color: '#1c1c1d', header_bg_color: '#000000', accent_text_color: '#007aff', section_bg_color: '#1c1c1d', section_header_text_color: '#8e8e93', subtitle_text_color: '#8e8e93', destructive_text_color: '#ff3b30' },
        initData: tgWebApp?.initData,
        initDataUnsafe: tgWebApp?.initDataUnsafe,
        colorScheme: tgWebApp?.colorScheme ?? 'dark',
    };
    debugLogger.log("[useTelegram] Memoizing context output. isAdmin is function:", typeof baseData.isAdmin === 'function', "dbUser exists:", !!baseData.dbUser);
    return baseData;
  }, [
      tgWebApp, tgUser, dbUser, isInTelegramContext, isAuthenticated, isAdmin, 
      isLoading, error, safeWebAppCall
  ]);
}