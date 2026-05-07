"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { debugLogger } from "@/lib/debugLogger"; 
import { logger as globalLogger } from "@/lib/logger"; 
import { isAllowedMockContext } from "@/lib/telegram-mock-context";
import { getTelegramLaunchParamsFromWindow } from "@/lib/telegram-launch-params";
import { 
  fetchDbUserAction,
  upsertTelegramUserAction
} from "@/contexts/actions";
import {
  attachVisibilityExpandRecovery,
  safeExpand,
  safeReady,
} from "@/lib/telegramViewport";

import type { TelegramWebApp, WebAppUser, WebAppInitData } from "@/types/telegram";
import type { Database } from "@/types/database.types";

const DEFAULT_THEME_PARAMS = {
  bg_color: '#000000',
  text_color: '#ffffff',
  hint_color: '#888888',
  link_color: '#007aff',
  button_color: '#007aff',
  button_text_color: '#ffffff',
  secondary_bg_color: '#1c1c1d',
  header_bg_color: '#000000',
  accent_text_color: '#007aff',
  section_bg_color: '#1c1c1d',
  section_header_text_color: '#8e8e93',
  subtitle_text_color: '#8e8e93',
  destructive_text_color: '#ff3b30'
};

type DatabaseUser = Database["public"]["Tables"]["users"]["Row"] | null;
interface AuthResult {
    tgUserToSet: WebAppUser | null;
    dbUserToSet: DatabaseUser;
    isAuthenticatedToSet: boolean;
}
interface ValidatedUserData extends WebAppUser {}

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
    globalLogger.warn("HOOK_TELEGRAM_INIT: MOCK_USER configured; activation is gated by preview/dev context.");
} else {
    globalLogger.info("HOOK_TELEGRAM_INIT: MOCK_USER is NOT active.");
}

async function validateTelegramAuthWithApi(initDataString: string): Promise<ValidatedUserData | null> {
  globalLogger.log("[HOOK_TELEGRAM validateApi FN_ENTRY] Attempting validation via API.");
  if (!initDataString) {
    globalLogger.warn("[HOOK_TELEGRAM validateApi FN_WARN] FAILURE: initDataString is empty. Cannot validate.");
    return null;
  }
  try {
    globalLogger.log(`[HOOK_TELEGRAM validateApi FN_CALL] Calling API '/api/validate-telegram-auth'. initData (first 60 chars): "${initDataString.substring(0, 60)}..."`);
    const response = await fetch('/api/validate-telegram-auth', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: initDataString }),
    });

    const result = await response.json(); 
    globalLogger.log("[HOOK_TELEGRAM validateApi FN_RESPONSE] API Response Status:", response.status, "Parsed API Response Body:", result);
    
    if (!response.ok) { 
      const errorBody = result?.error || JSON.stringify(result) || response.statusText;
      globalLogger.error(`[HOOK_TELEGRAM validateApi FN_ERROR] FAILURE: Validation API call failed. Status: ${response.status}`, `Error: ${errorBody}`);
      return null;
    }

    if (result.isValid && result.user) {
      globalLogger.info("[HOOK_TELEGRAM validateApi FN_SUCCESS] SUCCESS: Telegram data validated via API. User ID:", result.user?.id, "Username:", result.user?.username);
      const tgUser = result.user as WebAppInitData['user'];
      if (!tgUser || typeof tgUser.id !== 'number') {
          globalLogger.error("[HOOK_TELEGRAM validateApi FN_ERROR] CRITICAL FAILURE: Validated user data from API is malformed (missing or invalid id). User from API:", tgUser);
          return null; 
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
        globalLogger.warn("[HOOK_TELEGRAM validateApi FN_WARN] PARTIAL SUCCESS/WARNING: API Validation successful (isValid:true) but NO user data returned. Hash bypass with missing user param on API side possible. Result:", result);
        return null; 
    } else {
      globalLogger.warn("[HOOK_TELEGRAM validateApi FN_WARN] FAILURE: API validation unsuccessful (isValid:false or missing) or no user data returned. Result:", result);
      return null;
    }
  } catch (error) {
    globalLogger.error("[HOOK_TELEGRAM validateApi FN_ERROR] CRITICAL FAILURE: Error during API validation call or response processing (e.g., network error, JSON parse error). Error:", error);
    return null;
  }
}

export function useTelegram() {
  const[tgWebApp, setTgWebApp] = useState<TelegramWebApp | null>(null);
  const[tgUser, setTgUser] = useState<WebAppUser | null>(null); 
  const [dbUser, setDbUser] = useState<DatabaseUser>(null); 
  const [isInTelegramContext, setIsInTelegramContext] = useState(false);
  const [isLoading, setIsLoading] = useState(true); 
  const[isAuthenticating, setIsAuthenticating] = useState(true); 
  const [error, setError] = useState<Error | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false); 
  const[startParam, setStartParam] = useState<string | null>(null);
  const isMountedRef = useRef(false);

  const handleAuthentication = useCallback(
    async (userToAuth: WebAppUser): Promise<AuthResult> => {
      globalLogger.log(`[HOOK_TELEGRAM handleAuth FN_ENTRY] STEP 1: Auth process started for TG User ID: ${userToAuth?.id}, Username: ${userToAuth?.username}`);
      
      if (!userToAuth?.id || typeof userToAuth.id !== 'number') {
         globalLogger.error("[HOOK_TELEGRAM handleAuth FN_ERROR] CRITICAL FAILURE: Invalid user data: missing id or id is not a number. UserToAuth:", userToAuth);
         throw new Error("Invalid user data to authenticate: missing id or id is not a number.");
      }
      const userIdStr = userToAuth.id.toString();
      globalLogger.log(`[HOOK_TELEGRAM handleAuth FN_INFO] STEP 2: User ID ${userIdStr} is valid. Proceeding to DB operations.`);

      try {
         globalLogger.log(`[HOOK_TELEGRAM handleAuth FN_INFO] STEP 3: Fetching user ${userIdStr} from DB...`);
         let userFromDb = await fetchDbUserAction(userIdStr);
         globalLogger.log(`[HOOK_TELEGRAM handleAuth FN_INFO] STEP 4: Fetched user ${userIdStr} from DB. User exists in DB: ${!!userFromDb}.`);

         // ИЗМЕНЕНИЕ: Нормализуем данные из Telegram, приводя undefined к null
         const tgUsername = userToAuth.username || null;
         const tgFullName = `${userToAuth.first_name || ""} ${userToAuth.last_name || ""}`.trim() || null;
         const tgPhoto = userToAuth.photo_url || null;
         const tgLang = userToAuth.language_code || null;

         if (!userFromDb) {
            globalLogger.log(`[HOOK_TELEGRAM handleAuth FN_INFO] STEP 5A: User ${userIdStr} NOT found in DB. Attempting to CREATE... User data for creation:`, userToAuth);
            userFromDb = await upsertTelegramUserAction({
              userId: userIdStr,
              username: tgUsername,
              fullName: tgFullName,
              avatarUrl: tgPhoto,
              languageCode: tgLang,
            });
             if (!userFromDb) { 
                 globalLogger.error(`[HOOK_TELEGRAM handleAuth FN_ERROR] CRITICAL FAILURE: Failed to CREATE user ${userIdStr} in DB.`);
                 throw new Error(`Failed to create user ${userIdStr} in database during authentication.`);
             }
             globalLogger.info(`[HOOK_TELEGRAM handleAuth FN_SUCCESS] SUCCESS (New User Created): User ${userIdStr} created in DB.`);
         } else {
            globalLogger.log(`[HOOK_TELEGRAM handleAuth FN_INFO] STEP 5B: User ${userIdStr} FOUND in DB. Checking if data needs update...`);
            
            // ИЗМЕНЕНИЕ: Теперь мы безопасно сравниваем null с null
            const needsUpdate = (
                userFromDb.username !== tgUsername ||
                userFromDb.full_name !== tgFullName ||
                userFromDb.avatar_url !== tgPhoto ||
                userFromDb.language_code !== tgLang
            );
            
            globalLogger.log(`[HOOK_TELEGRAM handleAuth FN_INFO] STEP 6B: Needs update for ${userIdStr}? ${needsUpdate}. Comparing:`, {
                db: { u: userFromDb.username, f: userFromDb.full_name, a: userFromDb.avatar_url, l: userFromDb.language_code },
                tg: { u: tgUsername, f: tgFullName, a: tgPhoto, l: tgLang },
            });

            if(needsUpdate) {
                globalLogger.log(`[HOOK_TELEGRAM handleAuth FN_INFO] STEP 7B: User ${userIdStr} data differs. Attempting to UPDATE...`);
                userFromDb = await upsertTelegramUserAction({
                  userId: userIdStr,
                  username: tgUsername,
                  fullName: tgFullName,
                  avatarUrl: tgPhoto,
                  languageCode: tgLang,
                });
                 if (!userFromDb) { 
                     globalLogger.error(`[HOOK_TELEGRAM handleAuth FN_ERROR] CRITICAL FAILURE: Failed to UPDATE user ${userIdStr} in DB.`);
                     throw new Error(`Failed to update user ${userIdStr} in database during authentication.`);
                 }
                 globalLogger.info(`[HOOK_TELEGRAM handleAuth FN_SUCCESS] SUCCESS (User Updated): User ${userIdStr} updated in DB.`);
            } else {
                 globalLogger.log(`[HOOK_TELEGRAM handleAuth FN_INFO] STEP 7B (No Update): User ${userIdStr} data is up-to-date. No DB write needed.`);
            }
         }
         globalLogger.info(`[HOOK_TELEGRAM handleAuth FN_FINAL_SUCCESS] Auth & DB operations successful for user ${userIdStr}. Final DB Username: ${userFromDb.username}`);
         return { 
            tgUserToSet: userToAuth, 
            dbUserToSet: userFromDb, 
            isAuthenticatedToSet: true 
        };

      } catch (err) {
         globalLogger.error(`[HOOK_TELEGRAM handleAuth FN_ERROR] CRITICAL FAILURE for TG user ${userToAuth.id} during DB operations or final return step:`, err);
         const authError = err instanceof Error ? err : new Error("Authentication failed due to an unknown error in handleAuthentication DB part.");
         throw authError; 
      }
    },[] 
  );

  useEffect(() => {
    isMountedRef.current = true;
    const canUpdateState = () => isMountedRef.current;
    let detachVisibilityRecovery: (() => void) | undefined;
    globalLogger.info("[HOOK_TELEGRAM EFFECT_MAIN_INIT] START. isMountedRef.current:", canUpdateState());
    
    setIsLoading(true);
    setIsAuthenticating(true);
    setError(null);
    setIsAuthenticated(false);
    setDbUser(null); 
    setTgUser(null);
    setIsInTelegramContext(false); 
    setStartParam(null); 
    globalLogger.log("[HOOK_TELEGRAM EFFECT_MAIN_INIT] STEP 1: All relevant states reset to initial values.");

    const initialize = async () => {
      globalLogger.log("[HOOK_TELEGRAM initialize ASYNC_FN_START] STEP 2: Starting async initialization. isMountedRef.current:", canUpdateState());
      if (!canUpdateState()) {
          globalLogger.warn("[HOOK_TELEGRAM initialize ASYNC_FN_ABORT] Aborted: component unmounted before async logic could run fully.");
          if (canUpdateState()) {
            setIsAuthenticating(false); 
            setIsLoading(false);
          }
          return;
      }
      
      let authCandidate: WebAppUser | null = null;
      let inTgContextReal = false; 
      let rawStartParam: string | null = null;

      try { 
        globalLogger.log("[HOOK_TELEGRAM initialize TRY_BLOCK_START] STEP 3: Checking for window.Telegram.WebApp...");
        const launchParams = getTelegramLaunchParamsFromWindow();
        const telegram = typeof window !== "undefined" ? (window as any).Telegram?.WebApp : null;
        const initDataForValidation = telegram?.initData || launchParams.initData || "";

        if (telegram) {
          if (canUpdateState()) {
            setTgWebApp(telegram);
            globalLogger.log("[HOOK_TELEGRAM initialize] STEP 3.1: Telegram WebApp object FOUND and set to state (tgWebApp).");
          }
          
          rawStartParam = telegram.initDataUnsafe?.start_param || launchParams.startParam || null;
          if (canUpdateState() && rawStartParam) {
            setStartParam(rawStartParam);
            globalLogger.info(`[HOOK_TELEGRAM initialize] STEP 3.1.1: start_param found: "${rawStartParam}" and set to state.`);
          }
          
          if (canUpdateState()) {
            safeReady(telegram);
            globalLogger.log("[HOOK_TELEGRAM initialize] STEP 3.3: Called telegram.ready()");
            if (initDataForValidation && telegram.expand) {
              const expanded = await safeExpand(telegram, { attempts: 3, delayMs: 120 });
              if (!canUpdateState()) {
                return;
              }
              if (expanded) {
                globalLogger.info("[HOOK_TELEGRAM initialize] STEP 3.3.1: Called telegram.expand() to maximize Web App.");
              } else {
                globalLogger.warn("[HOOK_TELEGRAM initialize] STEP 3.3.1_WARN: expand() did not confirm success after retries.");
              }
              detachVisibilityRecovery = attachVisibilityExpandRecovery(telegram, { attempts: 2, delayMs: 150 });
            }
          }
        } else {
          rawStartParam = launchParams.startParam;
          globalLogger.log("[HOOK_TELEGRAM initialize] STEP 3 (FALLBACK): window.Telegram.WebApp not found; checking launch params from URL.");
          if (canUpdateState() && rawStartParam) {
            setStartParam(rawStartParam);
            globalLogger.info(`[HOOK_TELEGRAM initialize] STEP 3.1.1_FALLBACK: start_param found in URL: "${rawStartParam}" and set to state.`);
          }
        }

        inTgContextReal = initDataForValidation.length > 0;

        if (initDataForValidation) {
            globalLogger.log("[HOOK_TELEGRAM initialize] STEP 4A: REAL Telegram initData found. Validating via API...");
            const validatedUserFromApi = await validateTelegramAuthWithApi(initDataForValidation);
            if (validatedUserFromApi) {
                authCandidate = validatedUserFromApi;
                globalLogger.info(`[HOOK_TELEGRAM initialize] STEP 4A.1: REAL Telegram auth validated successfully via API. Auth Candidate User ID: ${authCandidate.id}`);
            } else {
                globalLogger.warn("[HOOK_TELEGRAM initialize] STEP 4A.2: REAL Telegram initData validation FAILED via API or returned no user.");
                if (MOCK_USER && isAllowedMockContext()) {
                  globalLogger.warn("[HOOK_TELEGRAM initialize] STEP 4A.3: Validation failed, but preview/dev mock context is allowed. Falling back to MOCK_USER without blocking.");
                } else if (canUpdateState()) {
                  const validationError = new Error("Telegram data validation failed. Please open this page through the Telegram App to continue.");
                  setError((prev) => prev ?? validationError);
                }
            }
        } else if (telegram?.initDataUnsafe?.user?.id && process.env.NODE_ENV === 'development') {
           globalLogger.warn("[HOOK_TELEGRAM initialize] STEP 4B: Using initDataUnsafe.user as fallback. INSECURE - DEV ONLY.");
           authCandidate = telegram.initDataUnsafe.user;
           inTgContextReal = true;
        }

        // Preview/Dev safety net: Allows mockuser bypass ONLY when the URL contains
        // the developer handle (salavey13) or NEXT_PUBLIC_IS_PREVIEW=true. On live
        // production without this marker, TG auth is strictly enforced.
        if (!authCandidate && MOCK_USER && isAllowedMockContext()) {
            globalLogger.warn(`[HOOK_TELEGRAM initialize] STEP 5: NO verified Telegram auth candidate. Preview/dev context allowed; using MOCK_USER. Mock User ID: ${MOCK_USER.id}`);
            authCandidate = MOCK_USER;
            inTgContextReal = false; 
            if (canUpdateState()) setError(null);
        } else if (!authCandidate && MOCK_USER) {
            globalLogger.warn("[HOOK_TELEGRAM initialize] STEP 5: MOCK_USER configured but denied because current URL/env is not an allowed preview/dev context.");
        }
        
        if (canUpdateState()) { 
          const finalInTgContext = inTgContextReal && !!authCandidate && authCandidate !== MOCK_USER;
          setIsInTelegramContext(finalInTgContext);
        }
        
        if (authCandidate) {
          globalLogger.log(`[HOOK_TELEGRAM initialize] STEP 7: Auth Candidate found (ID: ${authCandidate.id}). Proceeding to handleAuthentication.`);
          try { 
            const authData = await handleAuthentication(authCandidate); 
            if (canUpdateState()) {
              setTgUser(authData.tgUserToSet);
              setDbUser(authData.dbUserToSet); 
              setIsAuthenticated(authData.isAuthenticatedToSet);
              if (authData.isAuthenticatedToSet) setError(null); 
            }
          } catch (authProcessError: any) { 
            globalLogger.error(`[HOOK_TELEGRAM initialize] STEP 7.3 (ERROR): Error DURING handleAuthentication:`, authProcessError.message);
            if (canUpdateState()) {
              setError((prev) => prev ?? authProcessError); 
              setTgUser(authCandidate); 
              setDbUser(null);          
              setIsAuthenticated(false); 
            }
          }
        } else { 
           globalLogger.warn(`[HOOK_TELEGRAM initialize] STEP 7 (NO_CANDIDATE): No authCandidate available.`);
           if (canUpdateState()) {
             const noAuthCandidateError = new Error("No user data available for authentication.");
             setError((prev) => prev ?? noAuthCandidateError);
            setTgUser(null);
            setDbUser(null);
            setIsAuthenticated(false);
          }
        }
      } catch (outerError: any) { 
        globalLogger.error("[HOOK_TELEGRAM initialize] STEP ERROR (OUTER_CATCH): CRITICAL OUTER ERROR:", outerError.message);
        if (canUpdateState()) { 
          setError((prev) => prev ?? outerError);
        }
      } finally { 
        if (canUpdateState()) {
          setIsAuthenticating(false); 
        }
      }
    };

    initialize();

    return () => {
      globalLogger.info("[HOOK_TELEGRAM EFFECT_MAIN_INIT_CLEANUP] Cleanup. Setting isMounted=false.");
      isMountedRef.current = false;
      detachVisibilityRecovery?.();
    };
  }, [handleAuthentication]); 

  useEffect(() => {
    if (!isAuthenticating && isLoading) { 
      setIsLoading(false); 
    } else if (isAuthenticating && !isLoading) { 
      setIsLoading(true);
    }
  },[isAuthenticating, isLoading, tgUser, dbUser, isAuthenticated, isInTelegramContext, error, startParam]);

  const isAdmin = useCallback(() => {
    if (!dbUser) {
      return false;
    }
    const isAdminStatus = dbUser.status === "admin" || dbUser.role === "vprAdmin" || dbUser.role === "admin";
    return isAdminStatus;
  }, [dbUser]);

  const safeWebAppCall = useCallback(
    <T extends (...args: any[]) => any>(methodName: keyof TelegramWebApp, ...args: Parameters<T>): ReturnType<T> | undefined => {
        if (tgWebApp && typeof tgWebApp[methodName] === 'function') {
            try {
                return (tgWebApp[methodName] as T)(...args);
            } catch (callError) {
                 globalLogger.error(`[HOOK_TELEGRAM safeWebAppCall] Error calling tgWebApp.${String(methodName)}:`, callError);
                 return undefined;
            }
        } else {
            return undefined;
        }
    }, [tgWebApp] 
  );

  return useMemo(() => {
    const finalContextData = {
        tg: tgWebApp, 
        user: tgUser,
        dbUser,
        isInTelegramContext,
        isAuthenticated,
        isAuthenticating, 
        isAdmin, 
        isLoading, 
        error,
        startParam, 
        openLink: (url: string) => safeWebAppCall('openLink', url),
        close: () => safeWebAppCall('close'),
        showPopup: (params: any) => safeWebAppCall('showPopup', params), 
        sendData: (data: string) => safeWebAppCall('sendData', data),
        getInitData: () => tgWebApp?.initDataUnsafe ?? null, 
        expand: () => safeWebAppCall('expand'),
        setHeaderColor: (color: string) => safeWebAppCall('setHeaderColor', color),
        setBackgroundColor: (color: string) => safeWebAppCall('setBackgroundColor', color),
        platform: tgWebApp?.platform ?? 'unknown',
        themeParams: tgWebApp?.themeParams ?? DEFAULT_THEME_PARAMS,
        initData: tgWebApp?.initData, 
        initDataUnsafe: tgWebApp?.initDataUnsafe,
        colorScheme: tgWebApp?.colorScheme ?? 'dark',
    };
    return finalContextData;
  },[
      tgWebApp, tgUser, dbUser, isInTelegramContext, isAuthenticated, isAuthenticating, isAdmin, 
      isLoading, error, startParam, safeWebAppCall
  ]);
}