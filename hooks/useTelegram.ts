"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { debugLogger } from "@/lib/debugLogger";
import { logger } from "@/lib/logger"; // Use standard logger
// Import specific DB functions needed, ensure they use admin client correctly ONLY during init/mock setup phase
import { createOrUpdateUser as dbCreateOrUpdateUser, fetchUserData as dbFetchUserData } from "@/hooks/supabase";
import type { TelegramWebApp, WebAppUser } from "@/types/telegram";
import type { Database } from "@/types/database.types";
import { toast } from "sonner";

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
    debugLogger.log("Mock User Details:", MOCK_USER);
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
         // Always try to fetch first
         let userFromDb = await dbFetchUserData(userIdStr);

         if (!userFromDb) {
            debugLogger.log(`User ${userIdStr} not found in DB, creating...`);
            // Create user if not found - dbCreateOrUpdateUser handles upsert
            userFromDb = await dbCreateOrUpdateUser(userIdStr, telegramUser);
             if (!userFromDb) {
                 // If creation *still* fails, it's a more serious error
                 throw new Error(`Failed to create user ${userIdStr} in database.`);
             }
             logger.info(`New user ${userIdStr} (${telegramUser.username || ''}) created.`);
             // Optionally: Send notification for new user registration here or in the action
         } else {
            debugLogger.log(`User ${userIdStr} found in DB. Checking for updates...`);
            // Optional: Check if basic info needs updating (name, photo) and call upsert if needed
            const needsUpdate = (
                userFromDb.username !== telegramUser.username ||
                userFromDb.full_name !== `${telegramUser.first_name || ""} ${telegramUser.last_name || ""}`.trim() ||
                userFromDb.avatar_url !== telegramUser.photo_url
                // Add other fields to check if necessary
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
         setTgUser(telegramUser); // Store raw TG user info
         setDbUser(userFromDb); // Store DB user info
         setIsAuthenticated(true); // Set authenticated state
         return userFromDb;

      } catch (err) {
         logger.error(`Authentication failed for user ${telegramUser.id}:`, err);
         const authError = err instanceof Error ? err : new Error("Authentication failed due to an unknown error.");
         setError(authError);
         setIsAuthenticated(false);
         setDbUser(null); // Ensure dbUser is null on error
         // Toast handled in AppProvider
         throw authError; // Re-throw for initialization logic to catch
      }
    },
    [] // Dependencies: dbFetchUserData, dbCreateOrUpdateUser (assumed stable)
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
      setIsInTelegramContext(false);

      // Check if running inside Telegram Web App context
      if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
        const telegram = (window as any).Telegram.WebApp;
        debugLogger.log("Telegram WebApp context detected", telegram.initData ? 'with initData' : 'without initData');

        if (telegram.initDataUnsafe?.user) {
          setTgWebApp(telegram);
          setIsInTelegramContext(true);
          telegram.ready(); // Inform Telegram the app is ready
          try {
            await handleAuthentication(telegram.initDataUnsafe.user);
            // Toast notification handled centrally in AppProvider
          } catch (authError) {
             debugLogger.error("Authentication failed within Telegram context:", authError);
             // Error state already set by handleAuthentication
          } finally {
             if (isMounted) setIsLoading(false);
          }
        } else {
           debugLogger.log("Telegram context found, but no user data in initDataUnsafe.");
           // Decide handling: Use mock, show error, or wait?
           if (MOCK_USER && isMounted) {
               logger.warn("No user data in Telegram context, falling back to MOCK_USER.");
               setIsInTelegramContext(false); // Not truly in context if using mock
               try {
                   await handleAuthentication(MOCK_USER);
                   // toast.info("Используется тестовый пользователь (нет данных TG)"); // Inform user
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
        // Not in Telegram context
        debugLogger.log("Not running inside Telegram WebApp context.");
        setIsInTelegramContext(false);
        if (MOCK_USER && isMounted) {
           logger.warn("Not in Telegram context, using MOCK_USER.");
           try {
               await handleAuthentication(MOCK_USER);
               // toast.info("Используется тестовый пользователь (вне Telegram)");
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

    // Cleanup function
    return () => {
      debugLogger.log("useTelegram effect cleanup, setting isMounted=false");
      isMounted = false;
      // Potential cleanup of listeners or timers if any were added
    };
  }, [handleAuthentication]); // Rerun effect if handleAuthentication changes (should be stable)

  // --- Utility Functions ---
  const isAdmin = useCallback(() => {
    if (!dbUser) return false;
    // Using 'vprAdmin' as an example, adjust to your actual admin role name if different
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
                 toast.error(`Ошибка Telegram: Не удалось выполнить действие (${String(methodName)}).`);
                 return undefined;
            }
        } else {
            logger.warn(`Attempted to call tgWebApp.${String(methodName)} but WebApp context is not available.`);
            // Consider not showing a toast here for every non-TG call, might be too noisy.
            // Could be handled by the component attempting the call if feedback is needed.
            return undefined;
        }
    }, [tgWebApp] // Dependency on the webapp object
  );

  // --- Exposed Context Value ---
  return useMemo(() => ({
    tg: tgWebApp, // Renamed for clarity
    user: tgUser,
    dbUser,
    isInTelegramContext,
    isAuthenticated,
    isAdmin, // Pass the memoized function
    isLoading,
    error,
    // Wrapped WebApp methods
    openLink: (url: string) => safeWebAppCall('openLink', url),
    close: () => safeWebAppCall('close'),
    showPopup: (params: any) => safeWebAppCall('showPopup', params), // Use specific type if known
    sendData: (data: string) => safeWebAppCall('sendData', data),
    getInitData: () => tgWebApp?.initDataUnsafe ?? null, // Direct access if needed, null check
    expand: () => safeWebAppCall('expand'),
    setHeaderColor: (color: string) => safeWebAppCall('setHeaderColor', color),
    setBackgroundColor: (color: string) => safeWebAppCall('setBackgroundColor', color),
    // Add other methods as needed...
  }), [
      tgWebApp, tgUser, dbUser, isInTelegramContext, isAuthenticated, isAdmin, // Added isAdmin to dependencies
      isLoading, error, safeWebAppCall
  ]);
}