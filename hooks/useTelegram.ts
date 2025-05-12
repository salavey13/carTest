"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { debugLogger } from "@/lib/debugLogger";
import { logger as globalLogger } from "@/lib/logger"; // Renamed to avoid conflict with local logger alias
import { createOrUpdateUser as dbCreateOrUpdateUser, fetchUserData as dbFetchUserData } from "@/hooks/supabase";
import type { TelegramWebApp, WebAppUser } from "@/types/telegram";
import type { Database } from "@/types/database.types";

type DatabaseUser = Database["public"]["Tables"]["users"]["Row"] | null;
interface AuthResult {
    tgUserToSet: WebAppUser | null;
    dbUserToSet: DatabaseUser;
    isAuthenticatedToSet: boolean;
}

const MOCK_USER: WebAppUser | null = process.env.NEXT_PUBLIC_USE_MOCK_USER === 'true' ? {
  id: parseInt(process.env.NEXT_PUBLIC_MOCK_USER_ID || "413553377"),
  first_name: process.env.NEXT_PUBLIC_MOCK_USER_FIRST_NAME || "Mock",
  last_name: process.env.NEXT_PUBLIC_MOCK_USER_LAST_NAME || "User",
  username: process.env.NEXT_PUBLIC_MOCK_USER_USERNAME || "mockuser",
  language_code: process.env.NEXT_PUBLIC_MOCK_USER_LANG || "ru",
  photo_url: process.env.NEXT_PUBLIC_MOCK_USER_PHOTO || "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions//pooh.png",
} : null;

if (MOCK_USER) {
    globalLogger.warn("Using mock Telegram user for development. Ensure NEXT_PUBLIC_USE_MOCK_USER is 'false' or unset in production.");
}

export function useTelegram() {
  const [tgWebApp, setTgWebApp] = useState<TelegramWebApp | null>(null);
  const [tgUser, setTgUser] = useState<WebAppUser | null>(null); 
  const [dbUser, setDbUser] = useState<DatabaseUser>(null); 
  const [isInTelegramContext, setIsInTelegramContext] = useState(false);
  const [isLoading, setIsLoading] = useState(true); 
  const [isAuthenticating, setIsAuthenticating] = useState(true); 
  const [error, setError] = useState<Error | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false); 

  const handleAuthentication = useCallback(
    async (telegramUserToAuth: WebAppUser): Promise<AuthResult> => {
      debugLogger.log("[handleAuthentication] Started for:", telegramUserToAuth?.id);
      
      if (!telegramUserToAuth?.id) {
         globalLogger.error("[handleAuthentication] Invalid Telegram user data received.");
         throw new Error("Invalid Telegram user data received.");
      }
      const userIdStr = telegramUserToAuth.id.toString();

      try {
         let userFromDb = await dbFetchUserData(userIdStr);

         if (!userFromDb) {
            debugLogger.log(`[handleAuthentication] User ${userIdStr} not found in DB, creating...`);
            userFromDb = await dbCreateOrUpdateUser(userIdStr, telegramUserToAuth);
             if (!userFromDb) { // Explicitly check if creation failed
                 globalLogger.error(`[handleAuthentication] Failed to create user ${userIdStr} in database.`);
                 throw new Error(`Failed to create user ${userIdStr} in database.`);
             }
             globalLogger.info(`[handleAuthentication] New user ${userIdStr} (${telegramUserToAuth.username || ''}) created.`);
         } else {
            debugLogger.log(`[handleAuthentication] User ${userIdStr} found in DB. Checking for updates...`);
            const needsUpdate = (
                userFromDb.username !== telegramUserToAuth.username ||
                userFromDb.full_name !== `${telegramUserToAuth.first_name || ""} ${telegramUserToAuth.last_name || ""}`.trim() ||
                userFromDb.avatar_url !== telegramUserToAuth.photo_url
            );
            if(needsUpdate) {
                debugLogger.log(`[handleAuthentication] User ${userIdStr} data differs, updating...`);
                userFromDb = await dbCreateOrUpdateUser(userIdStr, telegramUserToAuth);
                 if (!userFromDb) { // Explicitly check if update failed
                     globalLogger.error(`[handleAuthentication] Failed to update user ${userIdStr} in database.`);
                     throw new Error(`Failed to update user ${userIdStr} in database.`);
                 }
                 globalLogger.info(`[handleAuthentication] User ${userIdStr} (${telegramUserToAuth.username || ''}) updated.`);
            } else {
                 debugLogger.log(`[handleAuthentication] User ${userIdStr} data is up-to-date.`);
            }
         }
         // At this point, userFromDb MUST be a valid user object if no error was thrown
         debugLogger.log(`[handleAuthentication] Successful for user ${userIdStr}. dbUser.id: ${userFromDb.id}, username: ${userFromDb.username}`);
         return { 
            tgUserToSet: telegramUserToAuth, 
            dbUserToSet: userFromDb, 
            isAuthenticatedToSet: true 
        };

      } catch (err) {
         globalLogger.error(`[handleAuthentication] Auth FAILED for user ${telegramUserToAuth.id}:`, err);
         const authError = err instanceof Error ? err : new Error("Authentication failed due to an unknown error in handleAuthentication.");
         throw authError; 
      }
    },
    [] 
  );

  useEffect(() => {
    let isMounted = true;
    debugLogger.log("[useTelegram Effect] Running, isMounted:", isMounted);

    const initialize = async () => {
      debugLogger.log("[useTelegram Initialize] Started");
      if (!isMounted) {
          debugLogger.log("[useTelegram Initialize] Aborted: component unmounted");
          return;
      }

      // Initial state before any async work
      setIsLoading(true); 
      setIsAuthenticating(true);
      setError(null);
      setIsAuthenticated(false);
      setDbUser(null); 
      setTgUser(null);
      setTgWebApp(null);
      setIsInTelegramContext(false); 

      let authCandidate: WebAppUser | null = null;
      let inTgContextReal = false;
      let tempTgWebApp: TelegramWebApp | null = null;

      // Determine authCandidate and context (sync part)
      if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
        const telegram = (window as any).Telegram.WebApp;
        tempTgWebApp = telegram; 
        debugLogger.log("[useTelegram Initialize] Telegram WebApp context detected", {
            initDataUnsafeUserExists: !!telegram.initDataUnsafe?.user,
            initDataUnsafeUser: telegram.initDataUnsafe?.user, // Log the actual user object
            initData: telegram.initData // Log the raw initData string
        });
        
        if (telegram.initDataUnsafe?.user && telegram.initDataUnsafe.user.id) { // Check for user and user.id
          inTgContextReal = true;
          authCandidate = telegram.initDataUnsafe.user;
          telegram.ready(); 
          debugLogger.log("[useTelegram Initialize] Auth candidate from Telegram:", authCandidate);
        } else {
           debugLogger.warn("[useTelegram Initialize] Telegram context found, but no valid user data in initDataUnsafe. Mock user check next.");
           if (MOCK_USER) {
               globalLogger.warn("[useTelegram Initialize] No user data in Telegram context, WILL use MOCK_USER.");
               authCandidate = MOCK_USER;
               inTgContextReal = false; 
               debugLogger.log("[useTelegram Initialize] Auth candidate from MOCK_USER:", authCandidate);
           }
        }
      } else {
        debugLogger.log("[useTelegram Initialize] Not running inside Telegram WebApp context. Mock user check next.");
        inTgContextReal = false;
        if (MOCK_USER) {
           globalLogger.warn("[useTelegram Initialize] Not in Telegram context, WILL use MOCK_USER.");
           authCandidate = MOCK_USER;
           debugLogger.log("[useTelegram Initialize] Auth candidate from MOCK_USER:", authCandidate);
        }
      }
      
      if (isMounted) { // Set non-auth-critical states early
        setTgWebApp(tempTgWebApp);
        setIsInTelegramContext(inTgContextReal);
      }
      
      // Async authentication part
      if (authCandidate) {
        try {
          debugLogger.log(`[useTelegram Initialize] Calling handleAuthentication for user: ${authCandidate.id}`);
          const authData = await handleAuthentication(authCandidate);
          if (isMounted) {
            const oldDbUser = dbUser;
            setTgUser(authData.tgUserToSet);
            setDbUser(authData.dbUserToSet); 
            setIsAuthenticated(authData.isAuthenticatedToSet);
            setError(null);
            globalLogger.log(`[useTelegram Initialize] States set after successful auth. Prev dbUser.id: ${oldDbUser?.id}, New dbUser.id: ${authData.dbUserToSet?.id}, isAuthenticated: ${authData.isAuthenticatedToSet}`);
          }
        } catch (authProcessError: any) {
          debugLogger.error("[useTelegram Initialize] Error during handleAuthentication or state setting:", authProcessError.message);
          if (isMounted) {
            setError(authProcessError);
            setTgUser(authCandidate); // Keep original TG user if available, even if DB ops failed
            setDbUser(null);          
            setIsAuthenticated(false); 
          }
        } finally {
          if (isMounted) {
            setIsAuthenticating(false); 
            debugLogger.log("[useTelegram Initialize] Auth process finished (setIsAuthenticating(false)). isMounted:", isMounted);
          }
        }
      } else { 
        if (isMounted) {
          const noAuthError = new Error("No authentication candidate: Not in Telegram, MOCK_USER disabled, or Telegram.WebApp.initDataUnsafe.user is missing/invalid.");
          setError(noAuthError);
          globalLogger.warn(`[useTelegram Initialize] ${noAuthError.message}`);
          setTgUser(null);
          setDbUser(null);
          setIsAuthenticated(false);
          setIsAuthenticating(false);
        }
      }
    };

    initialize();

    return () => {
      debugLogger.log("[useTelegram Effect Cleanup] Setting isMounted=false");
      isMounted = false;
    };
  }, [handleAuthentication]); 

  useEffect(() => {
    if (!isAuthenticating) { 
      setIsLoading(false);
      globalLogger.log(`[useTelegram Effect dbUser/isAuth] isAuthenticating is false. Setting isLoading to false. dbUser ID: ${dbUser?.id}, isAuthenticated: ${isAuthenticated}`);
    }
  }, [dbUser, isAuthenticated, isAuthenticating]); // Added isAuthenticated dependency for completeness

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
                 globalLogger.error(`Error calling tgWebApp.${String(methodName)}:`, callError);
                 return undefined;
            }
        } else {
            globalLogger.warn(`Attempted to call tgWebApp.${String(methodName)} but WebApp context is not available or method is not a function.`);
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
        isAuthenticating, 
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
        platform: tgWebApp?.platform ?? 'unknown',
        themeParams: tgWebApp?.themeParams ?? { bg_color: '#000000', text_color: '#ffffff', hint_color: '#888888', link_color: '#007aff', button_color: '#007aff', button_text_color: '#ffffff', secondary_bg_color: '#1c1c1d', header_bg_color: '#000000', accent_text_color: '#007aff', section_bg_color: '#1c1c1d', section_header_text_color: '#8e8e93', subtitle_text_color: '#8e8e93', destructive_text_color: '#ff3b30' },
        initData: tgWebApp?.initData,
        initDataUnsafe: tgWebApp?.initDataUnsafe,
        colorScheme: tgWebApp?.colorScheme ?? 'dark',
    };
    debugLogger.log("[useTelegram useMemo] Creating baseData.", {
        isLoading: baseData.isLoading,
        isAuthenticating: baseData.isAuthenticating,
        dbUserId: baseData.dbUser?.id,
        isAuthenticated: baseData.isAuthenticated,
        tgUserId: baseData.user?.id,
    });
    return baseData;
  }, [
      tgWebApp, tgUser, dbUser, isInTelegramContext, isAuthenticated, isAuthenticating, isAdmin, 
      isLoading, error, safeWebAppCall
  ]);
}