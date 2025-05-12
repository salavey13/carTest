"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { debugLogger } from "@/lib/debugLogger";
import { logger as globalLogger } from "@/lib/logger"; 
import { createOrUpdateUser as dbCreateOrUpdateUser, fetchUserData as dbFetchUserData } from "@/hooks/supabase";
import type { TelegramWebApp, WebAppUser, WebAppInitData } from "@/types/telegram";
import type { Database } from "@/types/database.types";

type DatabaseUser = Database["public"]["Tables"]["users"]["Row"] | null;
interface AuthResult {
    tgUserToSet: WebAppUser | null;
    dbUserToSet: DatabaseUser;
    isAuthenticatedToSet: boolean;
}
interface ValidatedUserData extends WebAppUser {
  // Placeholder for any additional fields backend might return or parse
}


const MOCK_USER_ID_STR = process.env.NEXT_PUBLIC_MOCK_USER_ID || "413553377";
const MOCK_USER: WebAppUser | null = process.env.NEXT_PUBLIC_USE_MOCK_USER === 'true' ? {
  id: parseInt(MOCK_USER_ID_STR, 10),
  first_name: process.env.NEXT_PUBLIC_MOCK_USER_FIRST_NAME || "Mock",
  last_name: process.env.NEXT_PUBLIC_MOCK_USER_LAST_NAME || "User",
  username: process.env.NEXT_PUBLIC_MOCK_USER_USERNAME || "mockuser",
  language_code: process.env.NEXT_PUBLIC_MOCK_USER_LANG || "ru",
  photo_url: process.env.NEXT_PUBLIC_MOCK_USER_PHOTO || "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions//pooh.png",
} : null;

if (MOCK_USER) {
    globalLogger.warn("Using mock Telegram user for development. Ensure NEXT_PUBLIC_USE_MOCK_USER is 'false' or unset in production.");
}

// Updated to call Next.js API route
async function validateTelegramAuthWithApi(initDataString: string): Promise<ValidatedUserData | null> {
  if (!initDataString) {
    debugLogger.warn("[validateTelegramAuthWithApi] initDataString is empty.");
    return null;
  }
  try {
    debugLogger.log("[validateTelegramAuthWithApi] Calling Next.js API route '/api/validate-telegram-auth'");
    const response = await fetch('/api/validate-telegram-auth', { // Changed endpoint
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: initDataString }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      globalLogger.error(`[validateTelegramAuthWithApi] Validation failed. Status: ${response.status}`, errorBody);
      throw new Error(`Telegram data validation API failed: ${errorBody || response.statusText}`);
    }

    const result = await response.json();
    if (result.isValid && result.user) {
      debugLogger.log("[validateTelegramAuthWithApi] Telegram data successfully validated via API. User:", result.user);
      const tgUser = result.user as WebAppInitData['user'];
      if (!tgUser || typeof tgUser.id !== 'number') {
          globalLogger.error("[validateTelegramAuthWithApi] Validated user data is missing id or id is not a number.", tgUser);
          throw new Error("Validated user data is malformed (missing or invalid id).");
      }
      return { 
          id: tgUser.id,
          first_name: tgUser.first_name,
          last_name: tgUser.last_name,
          username: tgUser.username,
          language_code: tgUser.language_code,
          photo_url: tgUser.photo_url,
          is_premium: tgUser.is_premium,
          is_bot: tgUser.is_bot,
          added_to_attachment_menu: tgUser.added_to_attachment_menu,
          allows_write_to_pm: tgUser.allows_write_to_pm,
      };
    } else {
      globalLogger.warn("[validateTelegramAuthWithApi] Validation unsuccessful or no user data returned from API.", result);
      return null;
    }
  } catch (error) {
    globalLogger.error("[validateTelegramAuthWithApi] Error during API validation call:", error);
    return null;
  }
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
    async (userToAuth: WebAppUser): Promise<AuthResult> => {
      debugLogger.log("[handleAuthentication] Started for user ID:", userToAuth?.id);
      
      if (!userToAuth?.id) {
         globalLogger.error("[handleAuthentication] Invalid user data: missing id.");
         throw new Error("Invalid user data: missing id.");
      }
      const userIdStr = userToAuth.id.toString();

      try {
         let userFromDb = await dbFetchUserData(userIdStr);
         debugLogger.log(`[handleAuthentication] Fetched user ${userIdStr} from DB. Exists: ${!!userFromDb}`);

         if (!userFromDb) {
            debugLogger.log(`[handleAuthentication] User ${userIdStr} not found in DB, creating...`);
            userFromDb = await dbCreateOrUpdateUser(userIdStr, userToAuth);
             if (!userFromDb) { 
                 globalLogger.error(`[handleAuthentication] Failed to create user ${userIdStr} in DB (returned null).`);
                 throw new Error(`Failed to create user ${userIdStr} in database.`);
             }
             globalLogger.info(`[handleAuthentication] New user ${userIdStr} (${userToAuth.username || ''}) created in DB.`);
         } else {
            debugLogger.log(`[handleAuthentication] User ${userIdStr} found in DB. Checking for updates...`);
            const needsUpdate = (
                userFromDb.username !== userToAuth.username ||
                userFromDb.full_name !== `${userToAuth.first_name || ""} ${userToAuth.last_name || ""}`.trim() ||
                userFromDb.avatar_url !== userToAuth.photo_url ||
                userFromDb.language_code !== userToAuth.language_code
            );
            if(needsUpdate) {
                debugLogger.log(`[handleAuthentication] User ${userIdStr} data differs, updating...`);
                userFromDb = await dbCreateOrUpdateUser(userIdStr, userToAuth);
                 if (!userFromDb) { 
                     globalLogger.error(`[handleAuthentication] Failed to update user ${userIdStr} in DB (returned null).`);
                     throw new Error(`Failed to update user ${userIdStr} in database.`);
                 }
                 globalLogger.info(`[handleAuthentication] User ${userIdStr} (${userToAuth.username || ''}) updated in DB.`);
            } else {
                 debugLogger.log(`[handleAuthentication] User ${userIdStr} data is up-to-date.`);
            }
         }
         debugLogger.log(`[handleAuthentication] Successful for user ${userIdStr}. dbUser.user_id: ${userFromDb.user_id}, username: ${userFromDb.username}`);
         return { 
            tgUserToSet: userToAuth, 
            dbUserToSet: userFromDb, 
            isAuthenticatedToSet: true 
        };

      } catch (err) {
         globalLogger.error(`[handleAuthentication] Auth FAILED for user ${userToAuth.id}:`, err);
         const authError = err instanceof Error ? err : new Error("Authentication failed due to an unknown error in handleAuthentication.");
         throw authError; 
      }
    },
    [] 
  );

  useEffect(() => {
    let isMounted = true;
    debugLogger.log("[useTelegram Effect Main Init] Running, isMounted:", isMounted);
    
    // Force reset of auth states at the beginning of this effect's execution
    setIsLoading(true);
    setIsAuthenticating(true);
    setError(null);
    setIsAuthenticated(false);
    setDbUser(null); 
    setTgUser(null);

    const initialize = async () => {
      debugLogger.log("[useTelegram initialize async fn] Started");
      if (!isMounted) {
          debugLogger.log("[useTelegram initialize async fn] Aborted: component unmounted");
          return;
      }
      
      let authCandidate: WebAppUser | null = null;
      let inTgContextReal = false;
      let tempTgWebApp: TelegramWebApp | null = null;

      if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
        const telegram = (window as any).Telegram.WebApp;
        tempTgWebApp = telegram;
        inTgContextReal = !!telegram.initData; 
        
        debugLogger.log("[useTelegram initialize] Telegram WebApp context detected.", {
            initDataExists: !!telegram.initData,
            initDataUnsafeUserExists: !!telegram.initDataUnsafe?.user,
            initDataUnsafeUserId: telegram.initDataUnsafe?.user?.id,
        });
        telegram.ready(); 

        if (telegram.initData && inTgContextReal) {
            debugLogger.log("[useTelegram initialize] Validating Telegram initData via API...");
            const validatedUser = await validateTelegramAuthWithApi(telegram.initData); // Use API validation
            if (validatedUser) {
                authCandidate = validatedUser;
                globalLogger.info("[useTelegram initialize] Telegram auth validated successfully via API. Candidate:", authCandidate.id);
            } else {
                globalLogger.warn("[useTelegram initialize] Telegram initData validation FAILED via API.");
                 if (isMounted) setError(new Error("Telegram data validation failed. User data might be compromised."));
            }
        } else if (telegram.initDataUnsafe?.user?.id && !inTgContextReal && process.env.NODE_ENV === 'development') {
           // Only use initDataUnsafe if initData is missing AND in development.
           // Still less secure, but can be useful for local non-Telegram testing IF MOCK_USER is off.
           globalLogger.warn("[useTelegram initialize] Using initDataUnsafe as fallback (initData not present/validated, DEV mode). THIS IS LESS SECURE.");
           authCandidate = telegram.initDataUnsafe.user;
        }
      }

      if (!authCandidate && MOCK_USER) {
          globalLogger.warn(`[useTelegram initialize] No auth candidate from Telegram (or validation failed). ${inTgContextReal ? "Falling back to" : "Using"} MOCK_USER.`);
          authCandidate = MOCK_USER;
          inTgContextReal = false; 
      }
      
      if (isMounted) { 
        setTgWebApp(tempTgWebApp);
        setIsInTelegramContext(inTgContextReal);
      }
      
      if (authCandidate) {
        try {
          debugLogger.log(`[useTelegram initialize] Calling handleAuthentication for user: ${authCandidate.id}`);
          const authData = await handleAuthentication(authCandidate);
          if (isMounted) {
            setTgUser(authData.tgUserToSet);
            setDbUser(authData.dbUserToSet); 
            setIsAuthenticated(authData.isAuthenticatedToSet);
            if(error) setError(null); // Clear previous errors on success ONLY if an error was set
            globalLogger.info(`[useTelegram initialize] States set after successful auth. dbUser.user_id: ${authData.dbUserToSet?.user_id}, isAuthenticated: ${authData.isAuthenticatedToSet}`);
          }
        } catch (authProcessError: any) {
          debugLogger.error("[useTelegram initialize] Error during handleAuthentication or state setting:", authProcessError);
          if (isMounted) {
            setError(authProcessError);
            setTgUser(authCandidate); 
            setDbUser(null);          
            setIsAuthenticated(false); 
          }
        } finally {
          if (isMounted) {
            setIsAuthenticating(false); 
            debugLogger.log("[useTelegram initialize] Auth process finished (setIsAuthenticating(false)).");
          }
        }
      } else { 
        if (isMounted) {
           if (!error) { 
             const noAuthError = new Error("No authentication candidate: Not in Telegram, MOCK_USER disabled, or Telegram data missing/invalid/validation_failed.");
             setError(noAuthError);
             globalLogger.warn(`[useTelegram Initialize] ${noAuthError.message}`);
           }
          // Ensure states are reset if no auth candidate
          setTgUser(null);
          setDbUser(null);
          setIsAuthenticated(false);
          setIsAuthenticating(false);
        }
      }
    };

    initialize();

    return () => {
      debugLogger.log("[useTelegram Effect Main Init Cleanup] Setting isMounted=false");
      isMounted = false;
    };
  // Added MOCK_USER_ID_STR to dependencies to re-run if MOCK_USER config changes (e.g. via HMR)
  // handleAuthentication itself has its DB function dependencies.
  }, [handleAuthentication, MOCK_USER_ID_STR]); 

  useEffect(() => {
    if (!isAuthenticating) { 
      setIsLoading(false);
      globalLogger.log(`[useTelegram Effect isLoading] isAuthenticating is false. Setting isLoading to false. dbUser.user_id: ${dbUser?.user_id}, isAuthenticated: ${isAuthenticated}, error: ${error?.message}`);
    }
  }, [dbUser, isAuthenticated, isAuthenticating, error]);

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
        dbUserId: baseData.dbUser?.user_id,
        isAuthenticated: baseData.isAuthenticated,
        tgUserId: baseData.user?.id,
        error: baseData.error?.message
    });
    return baseData;
  }, [
      tgWebApp, tgUser, dbUser, isInTelegramContext, isAuthenticated, isAuthenticating, isAdmin, 
      isLoading, error, safeWebAppCall
  ]);
}