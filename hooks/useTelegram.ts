"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { debugLogger } from "@/lib/debugLogger"; // Keep for specific, fine-grained client debugs if needed
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
    globalLogger.warn("HOOK_TELEGRAM_INIT: Using MOCK Telegram user for development. Ensure NEXT_PUBLIC_USE_MOCK_USER is 'false' or unset in production.");
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
      // Do not throw here, let the main hook handle the null return and set error state.
      return null;
    }

    if (result.isValid && result.user) {
      globalLogger.info("[HOOK_TELEGRAM validateApi FN_SUCCESS] SUCCESS: Telegram data validated via API. User ID:", result.user?.id, "Username:", result.user?.username);
      const tgUser = result.user as WebAppInitData['user'];
      if (!tgUser || typeof tgUser.id !== 'number') {
          globalLogger.error("[HOOK_TELEGRAM validateApi FN_ERROR] CRITICAL FAILURE: Validated user data from API is malformed (missing or invalid id). User from API:", tgUser);
          return null; // Malformed data is a failure.
      }
      // Successfully validated and user data is present and seems correct
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
        return null; // Treat as not fully authenticated if user object isn't there, even if API says "isValid".
    } else {
      // This means result.isValid was false, or some other unexpected structure
      globalLogger.warn("[HOOK_TELEGRAM validateApi FN_WARN] FAILURE: API validation unsuccessful (isValid:false or missing) or no user data returned. Result:", result);
      return null;
    }
  } catch (error) {
    globalLogger.error("[HOOK_TELEGRAM validateApi FN_ERROR] CRITICAL FAILURE: Error during API validation call or response processing (e.g., network error, JSON parse error). Error:", error);
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
  const [startParam, setStartParam] = useState<string | null>(null);

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
         let userFromDb = await dbFetchUserData(userIdStr);
         globalLogger.log(`[HOOK_TELEGRAM handleAuth FN_INFO] STEP 4: Fetched user ${userIdStr} from DB. User exists in DB: ${!!userFromDb}. DB Record (if any):`, userFromDb ? {id: userFromDb.user_id, username: userFromDb.username, status: userFromDb.status} : null);

         if (!userFromDb) {
            globalLogger.log(`[HOOK_TELEGRAM handleAuth FN_INFO] STEP 5A: User ${userIdStr} NOT found in DB. Attempting to CREATE... User data for creation:`, userToAuth);
            userFromDb = await dbCreateOrUpdateUser(userIdStr, userToAuth);
             if (!userFromDb) { 
                 globalLogger.error(`[HOOK_TELEGRAM handleAuth FN_ERROR] CRITICAL FAILURE: Failed to CREATE user ${userIdStr} in DB (dbCreateOrUpdateUser returned null).`);
                 throw new Error(`Failed to create user ${userIdStr} in database during authentication.`);
             }
             globalLogger.info(`[HOOK_TELEGRAM handleAuth FN_SUCCESS] SUCCESS (New User Created): User ${userIdStr} (${userToAuth.username || 'N/A'}) created in DB. DB Record:`, userFromDb ? {id: userFromDb.user_id, username: userFromDb.username, status: userFromDb.status} : null);
         } else {
            globalLogger.log(`[HOOK_TELEGRAM handleAuth FN_INFO] STEP 5B: User ${userIdStr} FOUND in DB. Checking if data needs update...`);
            const needsUpdate = (
                userFromDb.username !== userToAuth.username ||
                userFromDb.full_name !== `${userToAuth.first_name || ""} ${userToAuth.last_name || ""}`.trim() ||
                userFromDb.avatar_url !== userToAuth.photo_url ||
                userFromDb.language_code !== userToAuth.language_code
            );
            globalLogger.log(`[HOOK_TELEGRAM handleAuth FN_INFO] STEP 6B: Needs update for ${userIdStr}? ${needsUpdate}. Comparing:`, {
                db: { u: userFromDb.username, f: userFromDb.full_name, a: userFromDb.avatar_url, l: userFromDb.language_code },
                tg: { u: userToAuth.username, f: `${userToAuth.first_name || ""} ${userToAuth.last_name || ""}`.trim(), a: userToAuth.photo_url, l: userToAuth.language_code },
            });

            if(needsUpdate) {
                globalLogger.log(`[HOOK_TELEGRAM handleAuth FN_INFO] STEP 7B: User ${userIdStr} data differs. Attempting to UPDATE... User data for update:`, userToAuth);
                userFromDb = await dbCreateOrUpdateUser(userIdStr, userToAuth);
                 if (!userFromDb) { 
                     globalLogger.error(`[HOOK_TELEGRAM handleAuth FN_ERROR] CRITICAL FAILURE: Failed to UPDATE user ${userIdStr} in DB (dbCreateOrUpdateUser returned null).`);
                     throw new Error(`Failed to update user ${userIdStr} in database during authentication.`);
                 }
                 globalLogger.info(`[HOOK_TELEGRAM handleAuth FN_SUCCESS] SUCCESS (User Updated): User ${userIdStr} (${userToAuth.username || 'N/A'}) updated in DB. DB Record:`, userFromDb ? {id: userFromDb.user_id, username: userFromDb.username, status: userFromDb.status} : null);
            } else {
                 globalLogger.log(`[HOOK_TELEGRAM handleAuth FN_INFO] STEP 7B (No Update): User ${userIdStr} data is up-to-date. No DB write needed.`);
            }
         }
         globalLogger.info(`[HOOK_TELEGRAM handleAuth FN_FINAL_SUCCESS] Auth & DB operations successful for user ${userIdStr}. Final DB User ID: ${userFromDb.user_id}, Username: ${userFromDb.username}`);
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
    },
    [] 
  );

  useEffect(() => {
    let isMounted = true;
    globalLogger.info("[HOOK_TELEGRAM EFFECT_MAIN_INIT] START. isMounted:", isMounted);
    
    // Reset all relevant states at the beginning of each effect run
    setIsLoading(true);
    setIsAuthenticating(true);
    setError(null);
    setIsAuthenticated(false);
    setDbUser(null); 
    setTgUser(null);
    setIsInTelegramContext(false); // Assume not in TG context until proven otherwise
    setStartParam(null); // Reset startParam
    globalLogger.log("[HOOK_TELEGRAM EFFECT_MAIN_INIT] STEP 1: All relevant states reset to initial values.");

    const initialize = async () => {
      globalLogger.log("[HOOK_TELEGRAM initialize ASYNC_FN_START] STEP 2: Starting async initialization. isMounted:", isMounted);
      if (!isMounted) {
          globalLogger.warn("[HOOK_TELEGRAM initialize ASYNC_FN_ABORT] Aborted: component unmounted before async logic could run fully.");
          setIsAuthenticating(false); // Ensure this is false if we abort early
          setIsLoading(false);
          return;
      }
      
      let authCandidate: WebAppUser | null = null;
      let inTgContextReal = false; // Is there any Telegram.WebApp.initData at all?
      let tempTgWebApp: TelegramWebApp | null = null; 
      let rawStartParam: string | null = null;

      try { 
        globalLogger.log("[HOOK_TELEGRAM initialize TRY_BLOCK_START] STEP 3: Checking for window.Telegram.WebApp...");
        if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
          const telegram = (window as any).Telegram.WebApp;
          tempTgWebApp = telegram; // Store for later use if needed outside this block
          if(isMounted) {
            setTgWebApp(telegram);
            globalLogger.log("[HOOK_TELEGRAM initialize] STEP 3.1: Telegram WebApp object FOUND and set to state (tgWebApp).");
          } else {
            globalLogger.warn("[HOOK_TELEGRAM initialize] STEP 3.1 (WARN): Telegram WebApp object found, but component unmounted before setTgWebApp could be called.");
          }
          
          inTgContextReal = !!telegram.initData && telegram.initData.length > 0; 
          rawStartParam = telegram.initDataUnsafe?.start_param || null;
          if (isMounted && rawStartParam) {
            setStartParam(rawStartParam);
            globalLogger.info(`[HOOK_TELEGRAM initialize] STEP 3.1.1: start_param found: "${rawStartParam}" and set to state.`);
          }
          
          globalLogger.log("[HOOK_TELEGRAM initialize] STEP 3.2: Telegram WebApp context details:", {
              rawInitDataExists: inTgContextReal,
              initDataUnsafeUserExists: !!telegram.initDataUnsafe?.user,
              initDataUnsafeUserId: telegram.initDataUnsafe?.user?.id,
              initDataStringFirst60: telegram.initData?.substring(0,60) || "N/A",
              platform: telegram.platform,
              startParam: rawStartParam
          });
          
          if (isMounted) {
            telegram.ready(); 
            globalLogger.log("[HOOK_TELEGRAM initialize] STEP 3.3: Called telegram.ready()");

            // If in a real Telegram context (initData is present), expand the Web App.
            // This typically disables the swipe-down-to-minimize gesture.
            if (inTgContextReal && telegram.expand) {
                telegram.expand();
                globalLogger.info("[HOOK_TELEGRAM initialize] STEP 3.3.1: Called telegram.expand() to maximize Web App and potentially disable swipe-down gesture.");
            }
          }

          if (inTgContextReal) { // initData is present and non-empty
              globalLogger.log("[HOOK_TELEGRAM initialize] STEP 4A: REAL Telegram initData found. Validating via API...");
              const validatedUserFromApi = await validateTelegramAuthWithApi(telegram.initData); 
              if (validatedUserFromApi) {
                  authCandidate = validatedUserFromApi;
                  globalLogger.info(`[HOOK_TELEGRAM initialize] STEP 4A.1: REAL Telegram auth validated successfully via API. Auth Candidate User ID: ${authCandidate.id}`);
              } else {
                  globalLogger.warn("[HOOK_TELEGRAM initialize] STEP 4A.2: REAL Telegram initData validation FAILED via API or returned no user. Error will be set.");
                   if (isMounted && !error) { 
                     const validationError = new Error("Telegram data validation failed via API. User data might be compromised or API issue.");
                     setError(validationError);
                     globalLogger.error("[HOOK_TELEGRAM initialize] Set error state due to API validation failure:", validationError.message);
                   }
              }
          } else if (telegram.initDataUnsafe?.user?.id && process.env.NODE_ENV === 'development') {
             // This case means initData was empty or not present, but initDataUnsafe.user exists in DEV
             globalLogger.warn("[HOOK_TELEGRAM initialize] STEP 4B: Using initDataUnsafe.user as fallback (REAL initData was missing/empty, DEV mode). INSECURE - DEV ONLY.");
             authCandidate = telegram.initDataUnsafe.user;
             inTgContextReal = true; // Still consider it "in context" for dev if initDataUnsafe.user is used
          } else {
            globalLogger.log("[HOOK_TELEGRAM initialize] STEP 4C: No REAL Telegram initData (or it's empty) AND not in DEV mode for unsafe fallback, or initDataUnsafe.user missing.");
          }
        } else {
          globalLogger.log("[HOOK_TELEGRAM initialize] STEP 3 (FAIL): window.Telegram.WebApp not found. Not in Telegram context or script not loaded.");
        }

        // Fallback to MOCK_USER if no candidate yet and MOCK_USER is enabled
        if (!authCandidate && MOCK_USER) {
            globalLogger.warn(`[HOOK_TELEGRAM initialize] STEP 5: NO auth candidate from Telegram. Using MOCK_USER as NEXT_PUBLIC_USE_MOCK_USER is true. Mock User ID: ${MOCK_USER.id}`);
            authCandidate = MOCK_USER;
            inTgContextReal = false; // MOCK_USER means we are NOT in a real TG context for auth purposes
        } else if (!authCandidate) {
            globalLogger.log("[HOOK_TELEGRAM initialize] STEP 5 (SKIP): No authCandidate from Telegram and MOCK_USER is disabled or not defined.");
        }
        
        // Determine final isInTelegramContext based on whether we used a real, validated TG user
        if (isMounted) { 
          // finalInTgContext is true if:
          // 1. We started with real initData (inTgContextReal was true at that point)
          // 2. We have an authCandidate (meaning validation was successful or unsafe dev fallback gave a user)
          // 3. That authCandidate is NOT the MOCK_USER (ensuring it's from Telegram)
          const finalInTgContext = inTgContextReal && !!authCandidate && authCandidate !== MOCK_USER;
          setIsInTelegramContext(finalInTgContext);
          globalLogger.log(`[HOOK_TELEGRAM initialize] STEP 6: Setting final isInTelegramContext to: ${finalInTgContext}. Conditions: inTgContextRealWasInitially: ${inTgContextReal}, authCandidateExists: ${!!authCandidate}, authCandidateIsNotMock: ${authCandidate !== MOCK_USER}`);
        }
        
        // If we have any authCandidate (from valid TG, unsafe dev TG, or Mock)
        if (authCandidate) {
          globalLogger.log(`[HOOK_TELEGRAM initialize] STEP 7: Auth Candidate found (ID: ${authCandidate.id}, Username: ${authCandidate.username}). Proceeding to handleAuthentication.`);
          try { 
            const authData = await handleAuthentication(authCandidate); // This can throw
            if (isMounted) {
              setTgUser(authData.tgUserToSet);
              setDbUser(authData.dbUserToSet); 
              setIsAuthenticated(authData.isAuthenticatedToSet);
              globalLogger.info(`[HOOK_TELEGRAM initialize] STEP 7.1 (SUCCESS): States SET after successful handleAuthentication. TG User ID: ${authData.tgUserToSet?.id}, DB User ID: ${authData.dbUserToSet?.user_id}, isAuthenticated: ${authData.isAuthenticatedToSet}`);
              if(authData.isAuthenticatedToSet && error) { 
                  setError(null); 
                  globalLogger.info(`[HOOK_TELEGRAM initialize] STEP 7.2: Cleared previous error because authentication is now successful.`);
              }
            } else {
              globalLogger.warn(`[HOOK_TELEGRAM initialize] STEP 7.1 (WARN): Component unmounted during/after handleAuthentication for ${authCandidate.id}. State updates aborted.`);
            }
          } catch (authProcessError: any) { 
            globalLogger.error(`[HOOK_TELEGRAM initialize] STEP 7.3 (ERROR): Error DURING handleAuthentication or subsequent state setting for candidate ${authCandidate.id}:`, authProcessError.message, authProcessError.stack);
            if (isMounted) {
              if(!error) setError(authProcessError); 
              setTgUser(authCandidate); // Keep TG user for display even if DB/auth fails
              setDbUser(null);          
              setIsAuthenticated(false); 
              globalLogger.warn(`[HOOK_TELEGRAM initialize] STEP 7.4: Set states after FAILED handleAuthentication. TG User: ${authCandidate.id} (kept for display), DB User: null, isAuthenticated: false. Error state was set.`);
            }
          }
        } else { 
           globalLogger.warn(`[HOOK_TELEGRAM initialize] STEP 7 (NO_CANDIDATE): No authCandidate available (from any source). Cannot proceed with authentication.`);
           if (isMounted) {
             if (!error) { // Only set error if one isn't already set (e.g. from API validation failure)
               const noAuthCandidateError = new Error("No user data available for authentication. Not in Telegram, MOCK_USER disabled, or Telegram data invalid/validation_failed.");
               setError(noAuthCandidateError);
               globalLogger.error("[HOOK_TELEGRAM initialize] Set error state due to NO auth candidate:", noAuthCandidateError.message);
             }
            // Ensure these are null/false if no candidate
            setTgUser(null);
            setDbUser(null);
            setIsAuthenticated(false);
            globalLogger.log("[HOOK_TELEGRAM initialize] States set to reflect NO authentication candidate.");
          }
        }
      } catch (outerError: any) { 
        globalLogger.error("[HOOK_TELEGRAM initialize] STEP ERROR (OUTER_CATCH): CRITICAL OUTER ERROR during main initialization try_block:", outerError.message, outerError.stack);
        if (isMounted && !error) { // Set error only if not already set
          setError(outerError);
        }
      } finally { 
        if (isMounted) {
          setIsAuthenticating(false); 
          globalLogger.info(`[HOOK_TELEGRAM initialize ASYNC_FN_FINALLY] STEP 8: isAuthenticating set to false. Final State Hint: isAuth: ${isAuthenticated}, TGUser: ${tgUser?.id}, DBUser: ${dbUser?.id}, Err: ${error?.message}, StartParam: ${startParam}`);
        } else {
          globalLogger.warn("[HOOK_TELEGRAM initialize ASYNC_FN_FINALLY] (WARN) Component unmounted before finally block could set isAuthenticating to false.");
        }
      }
    };

    initialize();

    return () => {
      globalLogger.info("[HOOK_TELEGRAM EFFECT_MAIN_INIT_CLEANUP] Cleanup. Setting isMounted=false.");
      isMounted = false;
    };
  }, [handleAuthentication]); 

  useEffect(() => {
    // This effect runs AFTER the main initialization (specifically after isAuthenticating becomes false)
    globalLogger.log(`[HOOK_TELEGRAM EFFECT_ISLOADING_CHECK] isAuthenticating: ${isAuthenticating}, isLoading: ${isLoading}`);
    if (!isAuthenticating && isLoading) { // Only change isLoading if it's currently true and auth finished
      setIsLoading(false); 
      globalLogger.info(`[HOOK_TELEGRAM EFFECT_ISLOADING_SET] isAuthenticating is false. Setting isLoading to false. Final Hook State Snapshot: TGUser: ${tgUser?.id}, DBUser: ${dbUser?.user_id}, isAuthenticated: ${isAuthenticated}, isInTGContext: ${isInTelegramContext}, Error: ${error?.message}, StartParam: ${startParam}`);
    } else if (isAuthenticating && !isLoading) { // Should not happen if logic is correct, but as a safe guard
        setIsLoading(true);
        globalLogger.warn(`[HOOK_TELEGRAM EFFECT_ISLOADING_SET] isAuthenticating is true, but isLoading was false. Correcting isLoading to true.`);
    }
  }, [isAuthenticating, isLoading, tgUser, dbUser, isAuthenticated, isInTelegramContext, error, startParam]);

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
        startParam, // Add startParam to the returned object
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
    // globalLogger.log("[HOOK_TELEGRAM useMemo] Recalculated final context data. isLoading:", finalContextData.isLoading, "isAuthenticating:", finalContextData.isAuthenticating, "isAuthenticated:", finalContextData.isAuthenticated, "error:", finalContextData.error?.message);
    return finalContextData;
  }, [
      tgWebApp, tgUser, dbUser, isInTelegramContext, isAuthenticated, isAuthenticating, isAdmin, 
      isLoading, error, startParam, safeWebAppCall
  ]);
}