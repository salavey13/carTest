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
    globalLogger.warn("HOOK INIT: Using mock Telegram user for development. Ensure NEXT_PUBLIC_USE_MOCK_USER is 'false' or unset in production.");
}

async function validateTelegramAuthWithApi(initDataString: string): Promise<ValidatedUserData | null> {
  globalLogger.log("[validateTelegramAuthWithApi] Attempting validation...");
  if (!initDataString) {
    globalLogger.warn("[validateTelegramAuthWithApi] FAILURE: initDataString is empty.");
    return null;
  }
  try {
    globalLogger.log("[validateTelegramAuthWithApi] Calling Next.js API route '/api/validate-telegram-auth' with initData (first 50 chars):", initDataString.substring(0, 50));
    const response = await fetch('/api/validate-telegram-auth', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: initDataString }),
    });

    const result = await response.json(); 
    globalLogger.log("[validateTelegramAuthWithApi] API response status:", response.status, "Response body:", result);
    
    if (!response.ok) { 
      const errorBody = result?.error || JSON.stringify(result) || response.statusText;
      globalLogger.error(`[validateTelegramAuthWithApi] FAILURE: Validation API failed. Status: ${response.status}`, `Error: ${errorBody}`);
      throw new Error(`Telegram data validation API failed: ${errorBody}`);
    }

    if (result.isValid && result.user) {
      globalLogger.info("[validateTelegramAuthWithApi] SUCCESS: Telegram data validated via API. User:", {id: result.user?.id, username: result.user?.username});
      const tgUser = result.user as WebAppInitData['user'];
      if (!tgUser || typeof tgUser.id !== 'number') {
          globalLogger.error("[validateTelegramAuthWithApi] CRITICAL FAILURE: Validated user data is malformed (missing or invalid id). User from API:", tgUser);
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
    } else if (result.isValid && !result.user) {
        globalLogger.warn("[validateTelegramAuthWithApi] PARTIAL SUCCESS/WARNING: Validation successful via API but no user data returned. Hash bypass might be active with missing user param.", result);
        return null; // Treat as not fully authenticated if user object isn't there
    } else {
      globalLogger.warn("[validateTelegramAuthWithApi] FAILURE: Validation unsuccessful or no user data returned from API. Result:", result);
      return null;
    }
  } catch (error) {
    globalLogger.error("[validateTelegramAuthWithApi] CRITICAL FAILURE: Error during API validation call or response processing:", error);
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
      globalLogger.log(`[handleAuthentication] STEP 1: Started for user: ${userToAuth?.id}, Username: ${userToAuth?.username}`);
      
      if (!userToAuth?.id || typeof userToAuth.id !== 'number') {
         globalLogger.error("[handleAuthentication] CRITICAL FAILURE: Invalid user data: missing id or id is not a number. UserToAuth:", userToAuth);
         throw new Error("Invalid user data: missing id or id is not a number.");
      }
      const userIdStr = userToAuth.id.toString();
      globalLogger.log(`[handleAuthentication] STEP 2: User ID ${userIdStr} is valid. Proceeding to DB operations.`);

      try {
         globalLogger.log(`[handleAuthentication] STEP 3: Fetching user ${userIdStr} from DB...`);
         let userFromDb = await dbFetchUserData(userIdStr);
         globalLogger.log(`[handleAuthentication] STEP 4: Fetched user ${userIdStr} from DB. User exists: ${!!userFromDb}. DB Record (if any):`, userFromDb);

         if (!userFromDb) {
            globalLogger.log(`[handleAuthentication] STEP 5A: User ${userIdStr} not found in DB. Attempting to create... User data for creation:`, userToAuth);
            userFromDb = await dbCreateOrUpdateUser(userIdStr, userToAuth);
             if (!userFromDb) { 
                 globalLogger.error(`[handleAuthentication] CRITICAL FAILURE: Failed to create user ${userIdStr} in DB (dbCreateOrUpdateUser returned null).`);
                 throw new Error(`Failed to create user ${userIdStr} in database.`);
             }
             globalLogger.info(`[handleAuthentication] SUCCESS (New User): User ${userIdStr} (${userToAuth.username || 'N/A'}) created in DB. DB Record:`, userFromDb);
         } else {
            globalLogger.log(`[handleAuthentication] STEP 5B: User ${userIdStr} found in DB. Checking if data needs update...`);
            const needsUpdate = (
                userFromDb.username !== userToAuth.username ||
                userFromDb.full_name !== `${userToAuth.first_name || ""} ${userToAuth.last_name || ""}`.trim() ||
                userFromDb.avatar_url !== userToAuth.photo_url ||
                userFromDb.language_code !== userToAuth.language_code
            );
            globalLogger.log(`[handleAuthentication] STEP 6B: Needs update for ${userIdStr}? ${needsUpdate}. Comparing:`, {
                dbUsername: userFromDb.username, tgUsername: userToAuth.username,
                dbFullName: userFromDb.full_name, tgFullName: `${userToAuth.first_name || ""} ${userToAuth.last_name || ""}`.trim(),
                dbAvatar: userFromDb.avatar_url, tgAvatar: userToAuth.photo_url,
                dbLang: userFromDb.language_code, tgLang: userToAuth.language_code,
            });

            if(needsUpdate) {
                globalLogger.log(`[handleAuthentication] STEP 7B: User ${userIdStr} data differs. Attempting to update... User data for update:`, userToAuth);
                userFromDb = await dbCreateOrUpdateUser(userIdStr, userToAuth);
                 if (!userFromDb) { 
                     globalLogger.error(`[handleAuthentication] CRITICAL FAILURE: Failed to update user ${userIdStr} in DB (dbCreateOrUpdateUser returned null).`);
                     throw new Error(`Failed to update user ${userIdStr} in database.`);
                 }
                 globalLogger.info(`[handleAuthentication] SUCCESS (User Update): User ${userIdStr} (${userToAuth.username || 'N/A'}) updated in DB. DB Record:`, userFromDb);
            } else {
                 globalLogger.log(`[handleAuthentication] STEP 7B (No Update): User ${userIdStr} data is up-to-date. No DB write needed.`);
            }
         }
         globalLogger.log(`[handleAuthentication] FINAL SUCCESS: Auth processed for user ${userIdStr}. Final DB User ID: ${userFromDb.user_id}, Username: ${userFromDb.username}`);
         return { 
            tgUserToSet: userToAuth, 
            dbUserToSet: userFromDb, 
            isAuthenticatedToSet: true 
        };

      } catch (err) {
         globalLogger.error(`[handleAuthentication] CRITICAL FAILURE for user ${userToAuth.id} during DB operations or final return:`, err);
         const authError = err instanceof Error ? err : new Error("Authentication failed due to an unknown error in handleAuthentication.");
         throw authError; 
      }
    },
    [] 
  );

  useEffect(() => {
    let isMounted = true;
    globalLogger.log("[useTelegram EFFECT START] Initializing Telegram integration. isMounted:", isMounted);
    
    setIsLoading(true);
    setIsAuthenticating(true);
    setError(null);
    setIsAuthenticated(false);
    setDbUser(null); 
    setTgUser(null);
    setIsInTelegramContext(false);
    globalLogger.log("[useTelegram EFFECT STATE RESET] All states reset to initial values.");

    const initialize = async () => {
      globalLogger.log("[useTelegram initialize ASYNC FN START] Starting async initialization. isMounted:", isMounted);
      if (!isMounted) {
          globalLogger.warn("[useTelegram initialize ASYNC FN ABORT] Aborted: component unmounted before async logic could run fully.");
          return;
      }
      
      let authCandidate: WebAppUser | null = null;
      let inTgContextReal = false;
      let tempTgWebApp: TelegramWebApp | null = null; 

      try { 
        globalLogger.log("[useTelegram initialize TRY BLOCK START] Checking for window.Telegram.WebApp...");
        if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
          const telegram = (window as any).Telegram.WebApp;
          if(isMounted) {
            setTgWebApp(telegram);
            globalLogger.log("[useTelegram initialize] Telegram WebApp object found and set to state (tgWebApp).");
          } else {
            globalLogger.warn("[useTelegram initialize] Telegram WebApp object found, but component unmounted before setTgWebApp could be called.");
          }
          tempTgWebApp = telegram; 
          inTgContextReal = !!telegram.initData; 
          
          globalLogger.log("[useTelegram initialize] Telegram WebApp context detected.", {
              initDataExists: !!telegram.initData,
              initDataUnsafeUserExists: !!telegram.initDataUnsafe?.user,
              initDataUnsafeUserId: telegram.initDataUnsafe?.user?.id,
              initDataStringFirst50: telegram.initData?.substring(0,50)
          });
          
          if (isMounted) telegram.ready(); // Call ready() only if mounted to avoid errors.

          if (telegram.initData && inTgContextReal) {
              globalLogger.log("[useTelegram initialize] Validating REAL Telegram initData via API...");
              const validatedUser = await validateTelegramAuthWithApi(telegram.initData); 
              if (validatedUser) {
                  authCandidate = validatedUser;
                  globalLogger.info(`[useTelegram initialize] REAL Telegram auth validated successfully via API. Candidate User ID: ${authCandidate.id}`);
              } else {
                  globalLogger.warn("[useTelegram initialize] REAL Telegram initData validation FAILED via API or returned no user.");
                   if (isMounted && !error) { // Set error only if not already set
                     const validationError = new Error("Telegram data validation failed. User data might be compromised or API issue.");
                     setError(validationError);
                     globalLogger.error("[useTelegram initialize] Set error state due to validation failure:", validationError.message);
                   }
              }
          } else if (telegram.initDataUnsafe?.user?.id && process.env.NODE_ENV === 'development' && !inTgContextReal ) {
             globalLogger.warn("[useTelegram initialize] Using initDataUnsafe.user as fallback (initData NOT present, DEV mode). THIS IS INSECURE and for DEV ONLY.");
             authCandidate = telegram.initDataUnsafe.user;
          } else {
            globalLogger.log("[useTelegram initialize] No REAL Telegram initData or not in DEV mode for unsafe fallback.");
          }
        } else {
          globalLogger.log("[useTelegram initialize] window.Telegram.WebApp not found. Not in Telegram context or script not loaded.");
        }

        if (!authCandidate && MOCK_USER) {
            globalLogger.warn(`[useTelegram initialize] NO Telegram auth candidate. Using MOCK_USER as NEXT_PUBLIC_USE_MOCK_USER is true. Mock User ID: ${MOCK_USER.id}`);
            authCandidate = MOCK_USER;
            inTgContextReal = false; // Explicitly false if we fall back to mock user
        } else if (!authCandidate) {
            globalLogger.log("[useTelegram initialize] No authCandidate from Telegram and MOCK_USER is disabled or not defined.");
        }
        
        if (isMounted) { 
          const finalInTgContext = inTgContextReal && !!authCandidate && authCandidate !== MOCK_USER;
          setIsInTelegramContext(finalInTgContext);
          globalLogger.log(`[useTelegram initialize] Setting isInTelegramContext to: ${finalInTgContext}. (inTgContextReal: ${inTgContextReal}, authCandidateExists: ${!!authCandidate}, isNotMock: ${authCandidate !== MOCK_USER})`);
        }
        
        if (authCandidate) {
          globalLogger.log(`[useTelegram initialize] Auth Candidate found (ID: ${authCandidate.id}, Username: ${authCandidate.username}). Proceeding to handleAuthentication.`);
          try { 
            const authData = await handleAuthentication(authCandidate);
            if (isMounted) {
              setTgUser(authData.tgUserToSet);
              setDbUser(authData.dbUserToSet); 
              setIsAuthenticated(authData.isAuthenticatedToSet);
              if(authData.isAuthenticatedToSet && error) { // Clear error if auth succeeds now
                  setError(null); 
                  globalLogger.info(`[useTelegram initialize] Cleared previous error because authentication is now successful.`);
              }
              globalLogger.info(`[useTelegram initialize] STATES SET after successful auth. TG User ID: ${authData.tgUserToSet?.id}, DB User ID: ${authData.dbUserToSet?.user_id}, isAuthenticated: ${authData.isAuthenticatedToSet}`);
            } else {
              globalLogger.warn(`[useTelegram initialize] Component unmounted during/after handleAuthentication for ${authCandidate.id}. State updates aborted.`);
            }
          } catch (authProcessError: any) { 
            globalLogger.error(`[useTelegram initialize] Error during handleAuthentication or subsequent state setting for ${authCandidate.id}:`, authProcessError);
            if (isMounted) {
              if(!error) setError(authProcessError); // Set error only if not already set
              setTgUser(authCandidate); 
              setDbUser(null);          
              setIsAuthenticated(false); 
              globalLogger.warn(`[useTelegram initialize] Set states after FAILED auth. TG User: ${authCandidate.id} (kept for display), DB User: null, isAuthenticated: false`);
            }
          }
        } else { 
           globalLogger.warn(`[useTelegram initialize] No authCandidate available (Telegram or Mock). Cannot proceed with authentication.`);
           if (isMounted) {
             if (!error) { 
               const noAuthCandidateError = new Error("No user data available for authentication (Not in Telegram, MOCK_USER disabled, or Telegram data invalid/validation_failed).");
               setError(noAuthCandidateError);
               globalLogger.error("[useTelegram initialize] Set error state due to no auth candidate:", noAuthCandidateError.message);
             }
            // Ensure these are null/false if no candidate
            setTgUser(null);
            setDbUser(null);
            setIsAuthenticated(false);
          }
        }
      } catch (outerError: any) { 
        globalLogger.error("[useTelegram initialize] CRITICAL OUTER ERROR during initialization process:", outerError);
        if (isMounted && !error) {
          setError(outerError);
        }
      } finally { 
        if (isMounted) {
          setIsAuthenticating(false); 
          globalLogger.log("[useTelegram initialize ASYNC FN FINALLY] Auth process finished (setIsAuthenticating(false)). Final State Hint: isAuth:", isAuthenticated, "err:", error?.message);
        } else {
          globalLogger.warn("[useTelegram initialize ASYNC FN FINALLY] Component unmounted before finally block could set isAuthenticating to false.");
        }
      }
    };

    initialize();

    return () => {
      globalLogger.log("[useTelegram EFFECT CLEANUP] Main effect cleanup. Setting isMounted=false.");
      isMounted = false;
    };
  }, [handleAuthentication]); 

  useEffect(() => {
    // This effect runs AFTER the main initialization (specifically after isAuthenticating becomes false)
    if (!isAuthenticating) { 
      setIsLoading(false); // Set isLoading to false once authentication process is fully complete (success or fail)
      globalLogger.log(`[useTelegram EFFECT (isLoading)] isAuthenticating is false. Setting isLoading to false. Final hook state: TGUser: ${tgUser?.id}, DBUser: ${dbUser?.user_id}, isAuth: ${isAuthenticated}, inTG: ${isInTelegramContext}, Error: ${error?.message}`);
    } else {
      globalLogger.log(`[useTelegram EFFECT (isLoading)] isAuthenticating is still true. isLoading remains true.`);
    }
  }, [isAuthenticating, tgUser, dbUser, isAuthenticated, isInTelegramContext, error]); // Added all relevant final-state dependencies

  const isAdmin = useCallback(() => {
    if (!dbUser) {
      // globalLogger.debug("[isAdmin Check] No dbUser, returning false.");
      return false;
    }
    const isAdminStatus = dbUser.status === "admin" || dbUser.role === "vprAdmin" || dbUser.role === "admin";
    // globalLogger.debug(`[isAdmin Check] dbUser found. Status: ${dbUser.status}, Role: ${dbUser.role}. Determined isAdmin: ${isAdminStatus}`);
    return isAdminStatus;
  }, [dbUser]);

  const safeWebAppCall = useCallback(
    <T extends (...args: any[]) => any>(methodName: keyof TelegramWebApp, ...args: Parameters<T>): ReturnType<T> | undefined => {
        if (tgWebApp && typeof tgWebApp[methodName] === 'function') {
            try {
                 // debugLogger.log(`Safe Calling tgWebApp.${String(methodName)} with args:`, args);
                return (tgWebApp[methodName] as T)(...args);
            } catch (callError) {
                 globalLogger.error(`Error calling tgWebApp.${String(methodName)}:`, callError);
                 return undefined;
            }
        } else {
            // globalLogger.warn(`Attempted to call tgWebApp.${String(methodName)} but WebApp context is not available or method is not a function.`);
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
    // globalLogger.log("[useTelegram useMemo] Recalculated. isLoading:", isLoading, "isAuthenticating:", isAuthenticating, "isAuthenticated:", isAuthenticated, "error:", error?.message);
    return baseData;
  }, [
      tgWebApp, tgUser, dbUser, isInTelegramContext, isAuthenticated, isAuthenticating, isAdmin, 
      isLoading, error, safeWebAppCall
  ]);
}