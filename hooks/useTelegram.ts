"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { debugLogger } from "@/lib/debugLogger";
import { logger } from "@/lib/logger"; 
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
    logger.warn("Using mock Telegram user for development. Ensure NEXT_PUBLIC_USE_MOCK_USER is 'false' or unset in production.");
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
      debugLogger.log("[handleAuthentication] Started for:", telegramUserToAuth.id);
      
      if (!telegramUserToAuth?.id) {
         throw new Error("Invalid Telegram user data received.");
      }
      const userIdStr = telegramUserToAuth.id.toString();

      try {
         let userFromDb = await dbFetchUserData(userIdStr);

         if (!userFromDb) {
            debugLogger.log(`[handleAuthentication] User ${userIdStr} not found in DB, creating...`);
            userFromDb = await dbCreateOrUpdateUser(userIdStr, telegramUserToAuth);
             if (!userFromDb) {
                 throw new Error(`Failed to create user ${userIdStr} in database.`);
             }
             logger.info(`[handleAuthentication] New user ${userIdStr} (${telegramUserToAuth.username || ''}) created.`);
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
                 if (!userFromDb) {
                     throw new Error(`Failed to update user ${userIdStr} in database.`);
                 }
                 logger.info(`[handleAuthentication] User ${userIdStr} (${telegramUserToAuth.username || ''}) updated.`);
            } else {
                 debugLogger.log(`[handleAuthentication] User ${userIdStr} data is up-to-date.`);
            }
         }
         debugLogger.log(`[handleAuthentication] Successful for user ${userIdStr}. Returning auth data.`);
         return { 
            tgUserToSet: telegramUserToAuth, 
            dbUserToSet: userFromDb, 
            isAuthenticatedToSet: true 
        };

      } catch (err) {
         logger.error(`[handleAuthentication] Failed for user ${telegramUserToAuth.id}:`, err);
         const authError = err instanceof Error ? err : new Error("Authentication failed due to an unknown error.");
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

      setIsLoading(true); 
      setIsAuthenticating(true);
      setError(null);
      setIsAuthenticated(false);
      setDbUser(null); // Crucial to reset dbUser here
      setTgUser(null);
      setTgWebApp(null);
      setIsInTelegramContext(false); 

      let authCandidate: WebAppUser | null = null;
      let inTgContextReal = false;
      let tempTgWebApp: TelegramWebApp | null = null;

      try {
        if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
          const telegram = (window as any).Telegram.WebApp;
          tempTgWebApp = telegram; 
          debugLogger.log("[useTelegram Initialize] Telegram WebApp context detected", telegram.initDataUnsafe?.user ? 'with user data' : 'without user data');
          
          if (telegram.initDataUnsafe?.user) {
            inTgContextReal = true;
            authCandidate = telegram.initDataUnsafe.user;
            telegram.ready(); 
          } else {
             debugLogger.log("[useTelegram Initialize] Telegram context found, but no user data in initDataUnsafe.");
             if (MOCK_USER) {
                 logger.warn("[useTelegram Initialize] No user data in Telegram context, will use MOCK_USER.");
                 authCandidate = MOCK_USER;
                 inTgContextReal = false; 
             }
          }
        } else {
          debugLogger.log("[useTelegram Initialize] Not running inside Telegram WebApp context.");
          inTgContextReal = false;
          if (MOCK_USER) {
             logger.warn("[useTelegram Initialize] Not in Telegram context, will use MOCK_USER.");
             authCandidate = MOCK_USER;
          }
        }
        
        if (isMounted) {
          setTgWebApp(tempTgWebApp);
          setIsInTelegramContext(inTgContextReal);
        }
        
        if (authCandidate) {
            debugLogger.log(`[useTelegram Initialize] Calling handleAuthentication for user: ${authCandidate.id}`);
            const authData = await handleAuthentication(authCandidate);
            if (isMounted) {
              setTgUser(authData.tgUserToSet);
              setDbUser(authData.dbUserToSet); 
              setIsAuthenticated(authData.isAuthenticatedToSet);
              logger.log(`[useTelegram Initialize] Auth success, dbUser set with ID: ${authData.dbUserToSet?.id}. isMounted: ${isMounted}`);
            }
        } else {
           if (isMounted) {
             setError(new Error("Application must be run inside Telegram or have mock user enabled for authentication."));
             logger.warn("[useTelegram Initialize] No auth candidate, setting error.");
           }
        }
      } catch (authProcessError: any) {
        debugLogger.error("[useTelegram Initialize] Error during auth process:", authProcessError.message);
        if (isMounted) setError(authProcessError);
      } finally {
        // This block runs regardless of try/catch outcome for authCandidate processing
        if (isMounted) {
          setIsAuthenticating(false); 
          // isLoading will be set to false in the separate effect below,
          // AFTER dbUser and isAuthenticating have been processed by React.
          debugLogger.log("[useTelegram Initialize] Auth process finished (setIsAuthenticating(false)). isMounted:", isMounted);
        }
      }
    };

    initialize();

    return () => {
      debugLogger.log("[useTelegram Effect Cleanup] Setting isMounted=false");
      isMounted = false;
    };
  }, [handleAuthentication]); 

  // New useEffect to set isLoading = false AFTER dbUser and isAuthenticating have been updated.
  useEffect(() => {
    if (!isAuthenticating) { // Only when authentication process is fully done
      setIsLoading(false);
      logger.log(`[useTelegram Effect dbUser/isAuth] isAuthenticating is false. Setting isLoading to false. dbUser ID: ${dbUser?.id}`);
    }
  }, [dbUser, isAuthenticating]);


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
    return baseData;
  }, [
      tgWebApp, tgUser, dbUser, isInTelegramContext, isAuthenticated, isAuthenticating, isAdmin, 
      isLoading, error, safeWebAppCall
  ]);
}